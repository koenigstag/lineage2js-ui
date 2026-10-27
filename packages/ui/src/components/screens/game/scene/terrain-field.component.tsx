import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Vector3, type ShaderMaterial } from "three";
import { TERRAIN_DRAW_DISTANCE, mapKey } from "../../../../config/world-assets";
import { ktx2Loader } from "../../../../utils/world/static-mesh-cache";
import {
  buildTerrainChunk,
  terrainChunkCount,
  type TerrainChunk,
  type TerrainNeighbourField,
  type TerrainNeighbours,
} from "../../../../utils/world/terrain-geometry";
import { createTerrainMaterial } from "../../../../utils/world/terrain-material";
import { useHeightmaps, type MapHeightfield } from "../../../../utils/world/use-heightmaps";
import type { LoadedMapScene } from "../../../../utils/world/use-map-scenes";

interface TerrainFieldProps {
  scenes: LoadedMapScene[];
  /** Left-click on the ground -- fired with the raycast hit point, three.js space. */
  onGroundClick?: (event: ThreeEvent<MouseEvent>) => void;
}

/** How far the camera moves before the chunk set is reconsidered. */
const RECOMPUTE_AFTER = 30;

/**
 * The ground the retail client draws: the map's own heightmap, painted with the
 * layers the map names.
 *
 * This is what the geodata wireframe stood in for. The two describe different
 * things and both are needed -- geodata is the walkable surface the server
 * agrees to, this is what the world looks like -- and they do not coincide:
 * the walkable plane sits a constant ~32 units above the visible ground (see
 * packages/assets-server/README.md). Movement still resolves against geodata;
 * only the picture comes from here.
 *
 * Chunks are built lazily and only near the camera. A whole map is 130k
 * triangles, so a 3x3 window built eagerly would be over a million before
 * anything else is drawn.
 */
export function TerrainField({ scenes, onGroundClick }: TerrainFieldProps) {
  const heightmaps = useHeightmaps(scenes);

  const [cameraAt, setCameraAt] = useState(() => new Vector3());
  const lastPublished = useRef(new Vector3(Infinity, Infinity, Infinity));
  useFrame(({ camera }) => {
    if (camera.position.distanceTo(lastPublished.current) < RECOMPUTE_AFTER) return;
    lastPublished.current.copy(camera.position);
    setCameraAt(camera.position.clone());
  });

  // Keyed once rather than scanned three times per map: a neighbour is needed
  // by its heightmap *and* by its own Z origin, which only its scene carries.
  const sceneByKey = useMemo(
    () => new Map(scenes.map((entry) => [mapKey(entry.mapX, entry.mapY), entry.scene])),
    [scenes]
  );

  function neighbourField(x: number, y: number): TerrainNeighbourField | null {
    const key = mapKey(x, y);
    const heights = heightmaps.get(key)?.heights;
    const terrain = sceneByKey.get(key)?.terrain;
    return heights && terrain ? { heights, originZ: terrain.toWorld.origin[2] } : null;
  }

  return (
    <>
      {scenes.map(({ mapX, mapY, scene }) => {
        const key = mapKey(mapX, mapY);
        const heightfield = heightmaps.get(key);
        if (!scene.terrain || !heightfield) return null;
        // The row of quads along this map's far edge is built from the next
        // map's first row -- the only way the two ever meet, since neither
        // map's samples cover the gap. See TerrainNeighbours.
        const neighbours = {
          nextX: neighbourField(mapX + 1, mapY),
          nextY: neighbourField(mapX, mapY + 1),
          nextXY: neighbourField(mapX + 1, mapY + 1),
        };
        return (
          <MapTerrain
            key={key}
            scene={scene}
            heightfield={heightfield}
            neighbours={neighbours}
            cameraAt={cameraAt}
            onGroundClick={onGroundClick}
          />
        );
      })}
    </>
  );
}

interface MapTerrainProps {
  scene: LoadedMapScene["scene"];
  heightfield: MapHeightfield;
  neighbours: TerrainNeighbours;
  cameraAt: Vector3;
  onGroundClick?: (event: ThreeEvent<MouseEvent>) => void;
}

function MapTerrain({ scene, heightfield, neighbours, cameraAt, onGroundClick }: MapTerrainProps) {
  const terrain = scene.terrain!;
  const { heights, quads } = heightfield;

  // One material per map: every chunk of it paints the same eight layers, and
  // the textures are the expensive part.
  const [, redraw] = useState(0);
  const material = useMemo<ShaderMaterial>(
    () => createTerrainMaterial(terrain, ktx2Loader(), () => redraw((n) => n + 1)),
    [terrain]
  );
  useEffect(() => () => material.dispose(), [material]);

  // Chunks are built once and kept for as long as the map is loaded -- the
  // geometry does not change, and rebuilding on every camera step would undo
  // the point of building lazily.
  const built = useRef(new Map<string, TerrainChunk>());
  useEffect(() => {
    const cache = built.current;
    return () => {
      for (const chunk of cache.values()) chunk.geometry.dispose();
      cache.clear();
    };
  }, [terrain, heights]);

  const visible = useMemo(() => {
    const perSide = terrainChunkCount(terrain);
    const cache = built.current;
    const chunks: TerrainChunk[] = [];

    for (let chunkY = 0; chunkY < perSide; chunkY++) {
      for (let chunkX = 0; chunkX < perSide; chunkX++) {
        // Only the last row and column reach into a neighbour, and only those
        // have to be rebuilt when one arrives -- so the key says which
        // neighbours were there, and every interior chunk keeps a stable one.
        const lastX = chunkX === perSide - 1;
        const lastY = chunkY === perSide - 1;
        const edge =
          (lastX && neighbours.nextX ? "x" : "") +
          (lastY && neighbours.nextY ? "y" : "") +
          (lastX && lastY && neighbours.nextXY ? "d" : "");
        const key = `${chunkX}_${chunkY}_${edge}`;
        let chunk = cache.get(key);
        if (!chunk) {
          // Built to be measured, then kept -- a chunk's own extent is only
          // known once its vertices are, and building is cheap next to the
          // fetch that produced the heightmap.
          chunk = buildTerrainChunk(terrain, heights, chunkX, chunkY, quads, neighbours);
          cache.set(key, chunk);
        }
        if (chunk.center.distanceTo(cameraAt) <= TERRAIN_DRAW_DISTANCE + chunk.radius) chunks.push(chunk);
      }
    }

    return chunks;
    // The neighbour arrays, not the object around them: that is rebuilt every
    // render, while the heightmaps behind it are cached.
  }, [terrain, heights, quads, neighbours.nextX, neighbours.nextY, neighbours.nextXY, cameraAt]);

  return (
    <>
      {visible.map((chunk) => (
        <mesh
          key={`${chunk.chunkX}_${chunk.chunkY}`}
          geometry={chunk.geometry}
          material={material}
          onPointerDown={onGroundClick && handleGroundPointerDown}
        />
      ))}
    </>
  );

  function handleGroundPointerDown(event: ThreeEvent<PointerEvent>) {
    // Left button only; the right one is the camera orbit. Native "click" only
    // fires after a pointerdown/up pair with no drag between, which a camera
    // orbit swallows -- pointerdown cannot be.
    if (event.nativeEvent.button !== 0) return;
    event.stopPropagation();
    onGroundClick?.(event as unknown as ThreeEvent<MouseEvent>);
  }
}
