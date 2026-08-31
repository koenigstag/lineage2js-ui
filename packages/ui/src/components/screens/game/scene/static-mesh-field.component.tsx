import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { Matrix4 } from "three";
import { actorMatrix } from "../../../../utils/world/actor-transform";
import {
  getCachedStaticMesh,
  initStaticMeshTextures,
  loadStaticMesh,
  type StaticMeshPart,
} from "../../../../utils/world/static-mesh-cache";
import type { LoadedMapScene } from "../../../../utils/world/use-map-scenes";
import type { MapActor } from "../../../../utils/world/map-scene.types";

interface StaticMeshFieldProps {
  scenes: LoadedMapScene[];
}

interface MeshPlacements {
  name: string;
  actors: MapActor[];
}

/**
 * The client's own scenery -- trees, rocks, walls, buildings -- placed where
 * the retail client places it.
 *
 * Every actor that shares a mesh is drawn in one instanced call, which is what
 * makes this affordable: one map's 797 actors resolve to 131 distinct meshes,
 * and 64 copies of the same stone is normal. Meshes are cached across maps too
 * (see static-mesh-cache), since neighbouring maps draw from the same packages.
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

  // Actors grouped by mesh across every loaded map. Grouping across maps
  // rather than within one is the point -- a forest that spans a map border is
  // still one instanced draw.
  const placements = useMemo<MeshPlacements[]>(() => {
    const byMesh = new Map<string, MapActor[]>();
    for (const { scene } of scenes) {
      for (const actor of scene.actors) {
        const name = scene.meshes[actor.mesh];
        if (!name) continue;
        const list = byMesh.get(name);
        if (list) list.push(actor);
        else byMesh.set(name, [actor]);
      }
    }
    return [...byMesh].map(([name, actors]) => ({ name, actors }));
  }, [scenes]);

  return (
    <>
      {placements.map(({ name, actors }) => (
        <InstancedStaticMesh key={name} name={name} actors={actors} />
      ))}
    </>
  );
}

function InstancedStaticMesh({ name, actors }: MeshPlacements) {
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

  // Recomputed when the actor set changes, which is when a map loads or is
  // evicted -- not per frame. The meshes themselves never move.
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
            // the view. Computing real bounds is the better fix; until the
            // meshes are worth culling individually, drawing them all is
            // cheaper than getting it wrong.
            mesh.computeBoundingSphere();
          }}
        />
      ))}
    </>
  );
}
