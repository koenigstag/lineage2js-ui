import { useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Camera } from "three";
import { l2ToThree } from "../../../../utils/coords";
import { GeoTerrainField } from "./geo-terrain-field.component";

const MOVE_SPEED = 400; // L2 world units / second
// Camera rig offsets are in three.js meters (post-conversion), matching the
// human/character scale used by the other r3f scenes in this app.
const CAMERA_HEIGHT_M = 6;
const CAMERA_BACK_OFFSET_M = 6;

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
 * Dev-only harness: a WASD-movable test position driving geodata tile
 * streaming, so loading/eviction behavior can be watched without a real
 * player-position feed from the server yet.
 */
export function GeoTerrainDebugScene() {
  const [position, setPosition] = useState({ x: 0, y: 0 });

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

      setPosition((prev) => {
        let { x, y } = prev;
        const step = MOVE_SPEED * dt;
        if (keys.has("w")) y -= step;
        if (keys.has("s")) y += step;
        if (keys.has("a")) x -= step;
        if (keys.has("d")) x += step;
        return x === prev.x && y === prev.y ? prev : { x, y };
      });

      raf = requestAnimationFrame(tick);
    });

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas camera={{ position: [0, CAMERA_HEIGHT_M, CAMERA_BACK_OFFSET_M], fov: 60, near: 0.1, far: 2000 }}>
        <ambientLight intensity={0.8} />
        <CameraFollow worldX={position.x} worldY={position.y} />
        <GeoTerrainField worldX={position.x} worldY={position.y} />
      </Canvas>
    </div>
  );
}
