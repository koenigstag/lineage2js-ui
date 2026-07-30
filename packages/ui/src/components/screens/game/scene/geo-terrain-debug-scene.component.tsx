import { useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Camera } from "three";
import { CharacterMarker } from "../../../core/scene/character-marker.component";
import { l2ToThree } from "../../../../utils/coords";
import { heightAtWorld } from "../../../../utils/geodata/geo-tile-height";
import { useGeoTiles } from "../../../../utils/geodata/use-geo-tiles";
import { GeoTerrainField } from "./geo-terrain-field.component";

const MOVE_SPEED = 400; // L2 world units / second
// Camera rig offsets and the ground grid are in three.js meters
// (post-conversion), matching the human/character scale used by the other
// r3f scenes in this app.
const CAMERA_HEIGHT_M = 6;
const CAMERA_BACK_OFFSET_M = 6;
const GROUND_GRID_SIZE_M = 120;

interface TestCharacterState {
  x: number;
  y: number;
  yaw: number;
}

interface CameraFollowProps {
  worldX: number;
  worldY: number;
}

/** Keeps the camera trailing above/behind the test position every frame. */
function CameraFollow({ worldX, worldY }: CameraFollowProps) {
  useFrame(({ camera }: { camera: Camera }) => {
    const target = l2ToThree(worldX, worldY, 0);
    camera.position.set(target.x, CAMERA_HEIGHT_M, target.z + CAMERA_BACK_OFFSET_M);
    camera.lookAt(target.x, 0, target.z);
  });
  return null;
}

/**
 * Dev-only harness: a WASD-movable test character driving geodata tile
 * streaming, so loading/eviction behavior can be watched without a real
 * player-position feed from the server yet. Stands a placeholder
 * CharacterMarker on the loaded terrain, snapped to its height.
 */
export function GeoTerrainDebugScene() {
  const [character, setCharacter] = useState<TestCharacterState>({ x: 0, y: 0, yaw: 0 });
  const tiles = useGeoTiles(character.x, character.y);

  useEffect(() => {
    const keys = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.key.toLowerCase());
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.key.toLowerCase());
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    let last = performance.now();
    let raf = requestAnimationFrame(function tick(now) {
      const dt = (now - last) / 1000;
      last = now;

      setCharacter((prev) => {
        let dx = 0;
        let dy = 0;
        if (keys.has("w")) dy -= 1;
        if (keys.has("s")) dy += 1;
        if (keys.has("a")) dx -= 1;
        if (keys.has("d")) dx += 1;

        if (dx === 0 && dy === 0) {
          return prev;
        }

        // Normalize so diagonal movement isn't faster than axis-aligned.
        const length = Math.hypot(dx, dy);
        const step = MOVE_SPEED * dt;

        // Angle doesn't depend on L2_TO_THREE_SCALE (cancels out in atan2),
        // so the raw (dx, dy) direction can go straight through l2ToThree.
        const facing = l2ToThree(dx, dy, 0);

        return {
          x: prev.x + (dx / length) * step,
          y: prev.y + (dy / length) * step,
          yaw: Math.atan2(facing.x, facing.z),
        };
      });

      raf = requestAnimationFrame(tick);
    });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  const groundHeight = heightAtWorld(tiles, character.x, character.y) ?? 0;
  const characterPos = l2ToThree(character.x, character.y, groundHeight);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas camera={{ position: [0, CAMERA_HEIGHT_M, CAMERA_BACK_OFFSET_M], fov: 60, near: 0.1, far: 2000 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 10, 5]} intensity={0.6} />
        <CameraFollow worldX={character.x} worldY={character.y} />

        {/* Reference ground plane -- gives the wireframe terrain a visible
            "down" and fills the gap while neighboring tiles are still loading. */}
        <gridHelper args={[GROUND_GRID_SIZE_M, 40, "#3a4a3f", "#25302a"]} />

        <GeoTerrainField tiles={tiles} />

        <CharacterMarker x={characterPos.x} y={characterPos.y} z={characterPos.z} angleToCenter={character.yaw} color="#5b8fd6" />
      </Canvas>
    </div>
  );
}
