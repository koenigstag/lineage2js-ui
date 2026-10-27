import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Matrix4, Vector3 } from "three";
import { getMapAssetUrl, mapKey } from "../../../../config/world-assets";
import { L2_TO_THREE_SCALE } from "../../../../utils/coords";
import { DEFAULT_HOUR, resolveLighting, type ResolvedLighting } from "../../../../utils/world/map-lighting";
import type { MapTerrainDeco } from "../../../../utils/world/map-scene.types";
import { loadStaticMesh, type StaticMeshPart } from "../../../../utils/world/static-mesh-cache";
import { decoSectorCount, scatterDecoSector } from "../../../../utils/world/terrain-deco";
import { useHeightmaps, type MapHeightfield } from "../../../../utils/world/use-heightmaps";
import type { LoadedMapScene } from "../../../../utils/world/use-map-scenes";
import { useWorldEnv } from "../../../../utils/world/use-world-env";

interface TerrainDecoFieldProps {
  scenes: LoadedMapScene[];
  /** Game hour, 0..24. Grass is lit like any other mesh -- see decoLight. */
  hour?: number;
}

/** How far the camera moves before the visible sector set is reconsidered. */
const RECOMPUTE_AFTER = 20;

/**
 * The grass the client grows on its own terrain.
 *
 * Nothing in a map places these: a decoration layer names a mesh and a
 * density image, and the client scatters from them at load. This does the
 * same scatter (see scatterDecoSector) and draws the result, one sector at a
 * time, only where the layer's own fadeout radius says it would be visible --
 * 300 to 1500 units for a dense layer, against the ground's 13000. A whole
 * map would be thirty to forty thousand blades; a view is a few hundred.
 */
export function TerrainDecoField({ scenes, hour = DEFAULT_HOUR }: TerrainDecoFieldProps) {
  const heightmaps = useHeightmaps(scenes);
  const env = useWorldEnv();
  const lighting = useMemo(() => resolveLighting(env, hour), [env, hour]);

  const [cameraAt, setCameraAt] = useState(() => new Vector3());
  const lastPublished = useRef(new Vector3(Infinity, Infinity, Infinity));
  useFrame(({ camera }) => {
    if (camera.position.distanceTo(lastPublished.current) < RECOMPUTE_AFTER) return;
    lastPublished.current.copy(camera.position);
    setCameraAt(camera.position.clone());
  });

  return (
    <>
      {scenes.flatMap(({ mapX, mapY, scene }) => {
        const key = mapKey(mapX, mapY);
        const heightfield = heightmaps.get(key);
        if (!scene.terrain?.deco?.length || !heightfield) return [];
        return scene.terrain.deco.map((deco, index) => (
          <DecoLayer
            key={`${key}_${index}`}
            mapX={mapX}
            mapY={mapY}
            scene={scene}
            deco={deco}
            layerIndex={index}
            heightfield={heightfield}
            lighting={lighting}
            cameraAt={cameraAt}
          />
        ));
      })}
    </>
  );
}

interface DecoLayerProps {
  mapX: number;
  mapY: number;
  scene: LoadedMapScene["scene"];
  deco: MapTerrainDeco;
  layerIndex: number;
  heightfield: MapHeightfield;
  lighting: ResolvedLighting;
  cameraAt: Vector3;
}

function DecoLayer({ mapX, mapY, scene, deco, layerIndex, heightfield, lighting, cameraAt }: DecoLayerProps) {
  const terrain = scene.terrain!;
  const [density, setDensity] = useState<Uint8Array | null>(null);
  const [parts, setParts] = useState<StaticMeshPart[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const url = getMapAssetUrl(mapX, mapY, deco.file);
    if (url) {
      void loadDensity(url).then((map) => {
        if (!cancelled) setDensity(map);
      });
    }
    const name = scene.meshes[deco.mesh];
    if (name) {
      void loadStaticMesh(name).then((loaded) => {
        if (!cancelled) setParts(loaded);
      });
    }
    return () => {
      cancelled = true;
    };
  }, [mapX, mapY, deco.file, deco.mesh, scene.meshes]);

  // Sectors are grown once and kept: the scatter is deterministic, so the
  // same sector always comes back the same, and re-running it on every
  // camera step would undo the point of growing lazily.
  const grown = useRef(new Map<string, Matrix4[]>());
  useEffect(() => {
    const cache = grown.current;
    return () => cache.clear();
  }, [terrain, deco, density]);

  const matrices = useMemo(() => {
    if (!density) return [];

    // The layer's own far radius, which is what the client fades it out by.
    // Grass is drawn far closer than the ground it sits on: 1500 units
    // against the ground's 13000, so this is a small neighbourhood.
    const reach = deco.fade[1] * L2_TO_THREE_SCALE;
    const { origin, xAxis, yAxis } = terrain.toWorld;
    const sectorSpan = (terrain.heightmap.width - 1) / decoSectorCount();
    // Centre to corner, not corner to corner -- a sector only has to be
    // *within* reach to be worth growing, and growing one is the expensive
    // part.
    const sectorRadius = (sectorSpan * Math.abs(xAxis[0]) * L2_TO_THREE_SCALE * Math.SQRT2) / 2;
    const cache = grown.current;
    const all: Matrix4[] = [];

    for (let sectorY = 0; sectorY < decoSectorCount(); sectorY++) {
      for (let sectorX = 0; sectorX < decoSectorCount(); sectorX++) {
        // L2 y is three's z, with no sign flip -- see l2ToThree. Getting that
        // backwards puts every sector on the wrong side of the camera, which
        // reads as grass drawn only in the distance and never underfoot.
        const cx = ((sectorX + 0.5) * sectorSpan - origin[0]) * xAxis[0] * L2_TO_THREE_SCALE;
        const cz = ((sectorY + 0.5) * sectorSpan - origin[1]) * yAxis[1] * L2_TO_THREE_SCALE;
        if (Math.hypot(cx - cameraAt.x, cz - cameraAt.z) > reach + sectorRadius) continue;

        const sectorKey = `${sectorX}_${sectorY}`;
        let instances = cache.get(sectorKey);
        if (!instances) {
          instances = scatterDecoSector(
            terrain,
            deco,
            density,
            heightfield.heights,
            heightfield.quads,
            sectorX,
            sectorY
          );
          cache.set(sectorKey, instances);
        }

        // Then per blade, which is the test the client actually applies: a
        // sector is 2048 units across and the radius can be 300, so taking a
        // whole sector because its centre is near draws grass a long way past
        // where it should have faded out.
        for (const matrix of instances) {
          const dx = matrix.elements[12] - cameraAt.x;
          const dz = matrix.elements[14] - cameraAt.z;
          if (dx * dx + dz * dz <= reach * reach) all.push(matrix);
        }
      }
    }

    return all;
  }, [terrain, deco, density, heightfield, cameraAt]);

  // Grass is a static mesh and is lit like one. The client lights it from the
  // terrain vertex underneath instead (DisregardTerrainLighting is false on
  // every layer), which this does not have on the CPU -- the ground's light
  // lives in its shader. The two agree on open ground and part company in a
  // shadow, where a blade stays lit.
  const color = useMemo(
    () => new Color().copy(lighting.meshAmbient).add(lighting.meshSun).multiplyScalar(2),
    [lighting]
  );

  if (!parts || !matrices.length) return null;

  return (
    <>
      {parts.map((part, index) => (
        <instancedMesh
          key={index}
          args={[part.geometry, part.material, matrices.length]}
          frustumCulled={false}
          renderOrder={deco.drawOrder}
          ref={(mesh) => {
            if (!mesh) return;
            for (let i = 0; i < matrices.length; i++) {
              mesh.setMatrixAt(i, matrices[i]);
              mesh.setColorAt(i, color);
            }
            mesh.instanceMatrix.needsUpdate = true;
            if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
            mesh.computeBoundingSphere();
          }}
        />
      ))}
    </>
  );
}

const densityCache = new Map<string, Promise<Uint8Array | null>>();

/**
 * A density image as plain bytes.
 *
 * The scatter reads it on the CPU, one texel per quad, so what is wanted is
 * the samples rather than a texture -- but it travels as a PNG because the
 * map is nearly all zeroes and deflate takes 64kB down to about ten.
 */
function loadDensity(url: string): Promise<Uint8Array | null> {
  const cached = densityCache.get(url);
  if (cached) return cached;

  const request = (async () => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const bitmap = await createImageBitmap(await response.blob());
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
      const out = new Uint8Array(bitmap.width * bitmap.height);
      for (let i = 0; i < out.length; i++) out[i] = data[i * 4];
      bitmap.close();
      return out;
    } catch {
      // A map baked before the layers were read simply grows nothing.
      return null;
    }
  })();

  densityCache.set(url, request);
  return request;
}
