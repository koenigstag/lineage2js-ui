import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Matrix4, Vector3 } from "three";
import { L2_TO_THREE_SCALE } from "../../../../utils/coords";
import { actorMatrix } from "../../../../utils/world/actor-transform";
import {
  getCachedStaticMesh,
  initStaticMeshTextures,
  loadStaticMesh,
  meshTable,
  type MeshInfo,
  type StaticMeshPart,
} from "../../../../utils/world/static-mesh-cache";
import type { LoadedMapScene } from "../../../../utils/world/use-map-scenes";
import type { MapActor } from "../../../../utils/world/map-scene.types";

interface StaticMeshFieldProps {
  scenes: LoadedMapScene[];
}

/**
 * How far a mesh is fetched from: a flat floor, plus a multiple of the mesh's
 * own radius. A pebble is not worth a request from across the map; the crater
 * shell around the Dark Elf village is 14000 client units across and has to be
 * there long before you can see its far side.
 */
const LOAD_DISTANCE = 120;
const LOAD_DISTANCE_PER_RADIUS = 6;

/**
 * When a mesh drops to the next of the client's own LOD meshes, again in
 * multiples of its radius.
 *
 * These are tuning values, not the client's. The client stores `lodRange1` and
 * `lodRange2` per mesh -- 2/3 or 3.5/3.5 on everything measured -- but those
 * are multipliers into a distance formula that is not in the package, so what
 * is taken from the data is the *chain* (which mesh is the simpler one) rather
 * than when to switch. Switching on apparent size keeps it resolution
 * independent: a tree of radius 19 (three.js units) drops to LOD1 at ~150 and
 * to its four-triangle billboard at ~380.
 */
const LOD_DISTANCE_PER_RADIUS = [8, 20];

/** How far the camera moves before the buckets are recomputed. */
const RECOMPUTE_AFTER = 20;

interface Placement {
  /** The mesh actually drawn -- the base mesh, or one of its LODs. */
  name: string;
  actors: MapActor[];
}

interface ActorEntry {
  actor: MapActor;
  /** Base mesh name; the LOD chain hangs off the table. */
  name: string;
  /** Where it stands, in three.js space, so distance is a subtraction. */
  at: Vector3;
}

/**
 * The client's own scenery -- trees, rocks, walls, buildings -- placed where
 * the retail client places it.
 *
 * Every actor that shares a mesh *at the same level of detail* is drawn in one
 * instanced call, which is what makes this affordable: one map's 797 actors
 * resolve to 131 distinct meshes, and 64 copies of the same stone is normal.
 * Meshes are cached across maps too (see static-mesh-cache), since neighbouring
 * maps draw from the same packages.
 *
 * What is drawn is chosen by distance, twice over: a mesh is not fetched at all
 * until something using it is near enough to matter, and once fetched it is
 * drawn at whichever of the client's LOD meshes suits its apparent size. The
 * scene files themselves stay per map -- they are tens of kilobytes, and an
 * actor belongs to exactly one map by construction (see useMapScenes).
 *
 * Nothing here is a hard requirement: with no mesh server configured every
 * mesh resolves to nothing and the field renders empty, exactly as the world
 * looked before it existed.
 */
export function StaticMeshField({ scenes }: StaticMeshFieldProps) {
  // KTX2 has to be told what the GPU can decode before it can transcode
  // anything, and only the renderer knows.
  const renderer = useThree((state) => state.gl);
  useEffect(() => initStaticMeshTextures(renderer), [renderer]);

  const [table, setTable] = useState<Record<string, MeshInfo>>({});
  useEffect(() => {
    let cancelled = false;
    void meshTable().then((loaded) => {
      if (!cancelled) setTable(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Every actor of every loaded map, with its world position resolved once.
  // Rebuilt only when a map arrives or is evicted.
  const entries = useMemo<ActorEntry[]>(() => {
    const all: ActorEntry[] = [];
    for (const { scene } of scenes) {
      for (const actor of scene.actors) {
        const name = scene.meshes[actor.mesh];
        if (!name) continue;
        const at = new Vector3().setFromMatrixPosition(actorMatrix(actor, new Matrix4()));
        all.push({ actor, name, at });
      }
    }
    return all;
  }, [scenes]);

  // The camera is read every frame but only published when it has moved far
  // enough to change anything -- rebucketing fifteen thousand actors is cheap,
  // sixty times a second is not.
  const [cameraAt, setCameraAt] = useState(() => new Vector3());
  const lastPublished = useRef(new Vector3(Infinity, Infinity, Infinity));
  useFrame(({ camera }) => {
    if (camera.position.distanceTo(lastPublished.current) < RECOMPUTE_AFTER) return;
    lastPublished.current.copy(camera.position);
    setCameraAt(camera.position.clone());
  });

  const placements = useMemo<Placement[]>(() => {
    const byMesh = new Map<string, MapActor[]>();

    for (const entry of entries) {
      const info = table[entry.name];
      // Until the table lands, a mesh has no known size -- treat it as small
      // and let the flat floor decide, rather than holding everything back.
      const radius = (info?.radius ?? 0) * L2_TO_THREE_SCALE;
      const distance = entry.at.distanceTo(cameraAt);
      if (distance > LOAD_DISTANCE + radius * LOAD_DISTANCE_PER_RADIUS) continue;

      const name = lodFor(entry.name, info, distance, radius);
      const list = byMesh.get(name);
      if (list) list.push(entry.actor);
      else byMesh.set(name, [entry.actor]);
    }

    return [...byMesh].map(([name, actors]) => ({ name, actors }));
  }, [entries, table, cameraAt]);

  return (
    <>
      {placements.map(({ name, actors }) => (
        <InstancedStaticMesh key={name} name={name} actors={actors} />
      ))}
    </>
  );
}

/** The client's simplest mesh that still suits this distance. */
function lodFor(name: string, info: MeshInfo | undefined, distance: number, radius: number): string {
  const lods = info?.lods;
  if (!lods || radius <= 0) return name;

  for (let level = lods.length - 1; level >= 0; level--) {
    const threshold = LOD_DISTANCE_PER_RADIUS[Math.min(level, LOD_DISTANCE_PER_RADIUS.length - 1)];
    if (distance > radius * threshold) return lods[level];
  }
  return name;
}

function InstancedStaticMesh({ name, actors }: Placement) {
  const [parts, setParts] = useState<StaticMeshPart[] | null>(() => getCachedStaticMesh(name) ?? null);

  useEffect(() => {
    let cancelled = false;
    void loadStaticMesh(name).then((loaded) => {
      if (!cancelled) setParts(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  // Recomputed when the actor set changes, which is when a map loads, is
  // evicted, or the camera crosses a LOD boundary -- not per frame. The meshes
  // themselves never move.
  const matrices = useMemo(() => actors.map((actor) => actorMatrix(actor, new Matrix4())), [actors]);

  if (!parts) return null;

  return (
    <>
      {parts.map((part, index) => (
        <instancedMesh
          key={index}
          args={[part.geometry, part.material, matrices.length]}
          frustumCulled={false}
          ref={(mesh) => {
            if (!mesh) return;
            for (let i = 0; i < matrices.length; i++) {
              mesh.setMatrixAt(i, matrices[i]);
            }
            mesh.instanceMatrix.needsUpdate = true;
            // The bounding box three computes for an InstancedMesh comes from
            // the geometry alone, not the instances, so leaving frustum
            // culling on would cull the whole draw the moment the origin left
            // the view. Distance now bounds what is drawn instead.
            mesh.computeBoundingSphere();
          }}
        />
      ))}
    </>
  );
}
