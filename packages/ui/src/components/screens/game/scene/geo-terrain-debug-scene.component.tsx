import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Camera } from "three";
import { CharacterModel } from "../../../core/scene/character-model.component";
import { l2ToThree, threeToL2 } from "../../../../utils/coords";
import { heightAtWorld } from "../../../../utils/geodata/geo-tile-height";
import { useGeoTiles } from "../../../../utils/geodata/use-geo-tiles";
import { GeoTerrainField } from "./geo-terrain-field.component";
import { GameCreaturesField } from "./game-creatures-field.component";

const MOVE_SPEED = 400; // L2 world units / second
// Once within this distance of a click-to-move target, stop instead of
// jittering back and forth around it.
const ARRIVE_EPSILON = 8; // L2 units

// Orbit camera rig -- all in three.js meters/radians (post-conversion),
// matching the human/character scale used by the other r3f scenes in this app.
const CAMERA_DISTANCE_M = 8;
const CAMERA_LOOK_HEIGHT_M = 1.4; // roughly chest height on the character
const DEFAULT_AZIMUTH = 0;
const DEFAULT_PITCH = 0.5; // radians above horizontal
const MIN_PITCH = 0.15;
const MAX_PITCH = 1.45; // just under looking straight down
const ORBIT_SENSITIVITY = 0.005; // radians per pixel dragged
const GROUND_GRID_SIZE_M = 120;

interface TestCharacterState {
  x: number;
  y: number;
  yaw: number;
}

interface MoveTarget {
  x: number;
  y: number;
}

interface OrbitState {
  azimuth: number;
  pitch: number;
}

interface CameraFollowProps {
  worldX: number;
  worldY: number;
  groundHeightM: number;
  orbitRef: MutableRefObject<OrbitState>;
}

/** Orbits the camera around the test character every frame, at the drag-controlled azimuth/pitch. */
function CameraFollow({ worldX, worldY, groundHeightM, orbitRef }: CameraFollowProps) {
  useFrame(({ camera }: { camera: Camera }) => {
    const target = l2ToThree(worldX, worldY, 0);
    const { azimuth, pitch } = orbitRef.current;

    const horizontalDistance = CAMERA_DISTANCE_M * Math.cos(pitch);
    camera.position.set(
      target.x + horizontalDistance * Math.sin(azimuth),
      groundHeightM + CAMERA_DISTANCE_M * Math.sin(pitch),
      target.z + horizontalDistance * Math.cos(azimuth)
    );
    camera.lookAt(target.x, groundHeightM + CAMERA_LOOK_HEIGHT_M, target.z);
  });
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Dev-only harness: WASD or left-click-to-move drives a test character
 * (streaming geodata tiles around it); holding the right mouse button and
 * dragging orbits the camera around it, like the retail L2 client. Stands a
 * placeholder CharacterModel on the loaded terrain, snapped to its height.
 */
export function GeoTerrainDebugScene() {
  const [character, setCharacter] = useState<TestCharacterState>({ x: 0, y: 0, yaw: 0 });
  const tiles = useGeoTiles(character.x, character.y);
  // Refs, not state: only read inside the rAF/useFrame loops below, so
  // updating them shouldn't itself trigger a render.
  const moveTargetRef = useRef<MoveTarget | null>(null);
  const orbitRef = useRef<OrbitState>({ azimuth: DEFAULT_AZIMUTH, pitch: DEFAULT_PITCH });

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
        let inputForward = 0; // W = +1, S = -1
        let inputRight = 0; // D = +1, A = -1
        if (keys.has("w")) inputForward += 1;
        if (keys.has("s")) inputForward -= 1;
        if (keys.has("d")) inputRight += 1;
        if (keys.has("a")) inputRight -= 1;

        let dx = 0;
        let dy = 0;
        let maxStep = MOVE_SPEED * dt;

        if (inputForward !== 0 || inputRight !== 0) {
          // Keyboard input always overrides a pending click-to-move order.
          moveTargetRef.current = null;

          // Camera-relative: "forward" is whatever direction the orbit
          // camera is currently looking (see CameraFollow's azimuth math),
          // not a fixed L2 world direction -- otherwise W/S would stop
          // matching the view the moment the camera gets rotated (only A/D
          // happened to look right before, and only by coincidence at the
          // default azimuth). Same three.js-forward -> L2 mapping l2ToThree
          // uses (x stays x, three z is -L2 y), just applied to a direction.
          const azimuth = orbitRef.current.azimuth;
          const sinAz = Math.sin(azimuth);
          const cosAz = Math.cos(azimuth);
          dx = inputForward * -sinAz + inputRight * cosAz;
          dy = inputForward * cosAz + inputRight * sinAz;
        } else if (moveTargetRef.current) {
          const toX = moveTargetRef.current.x - prev.x;
          const toY = moveTargetRef.current.y - prev.y;
          const dist = Math.hypot(toX, toY);
          if (dist <= ARRIVE_EPSILON) {
            moveTargetRef.current = null;
          } else {
            dx = toX / dist;
            dy = toY / dist;
            maxStep = Math.min(maxStep, dist); // don't overshoot the target
          }
        }

        if (dx === 0 && dy === 0) {
          return prev;
        }

        // Normalize so diagonal WASD movement isn't faster than axis-aligned
        // (click-to-move's dx/dy are already a unit vector, so this is a no-op there).
        const length = Math.hypot(dx, dy);

        // Angle doesn't depend on L2_TO_THREE_SCALE (cancels out in atan2),
        // so the raw (dx, dy) direction can go straight through l2ToThree.
        const facing = l2ToThree(dx, dy, 0);

        return {
          x: prev.x + (dx / length) * maxStep,
          y: prev.y + (dy / length) * maxStep,
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

  function handleGroundClick(event: ThreeEvent<MouseEvent>) {
    const target = threeToL2(event.point);
    moveTargetRef.current = { x: target.x, y: target.y };
  }

  /** Right-button drag rotates the camera around the character; released anywhere, even off-canvas. */
  function handleOrbitPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 2) {
      return;
    }
    event.preventDefault();
    let lastX = event.clientX;
    let lastY = event.clientY;

    function onMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - lastX;
      const dy = moveEvent.clientY - lastY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;
      orbitRef.current = {
        azimuth: orbitRef.current.azimuth - dx * ORBIT_SENSITIVITY,
        pitch: clamp(orbitRef.current.pitch - dy * ORBIT_SENSITIVITY, MIN_PITCH, MAX_PITCH),
      };
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const groundHeight = heightAtWorld(tiles, character.x, character.y) ?? 0;
  const characterPos = l2ToThree(character.x, character.y, groundHeight);

  return (
    <div
      style={{ position: "absolute", inset: 0 }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handleOrbitPointerDown}
    >
      <Canvas camera={{ position: [0, CAMERA_DISTANCE_M, CAMERA_DISTANCE_M], fov: 60, near: 0.1, far: 2000 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 10, 5]} intensity={0.6} />
        <CameraFollow worldX={character.x} worldY={character.y} groundHeightM={characterPos.y} orbitRef={orbitRef} />

        {/* Reference ground plane -- gives the wireframe terrain a visible
            "down" and fills the gap while neighboring tiles are still loading.
            raycast={() => null} excludes it from pointer events so it can't
            steal ground-click hits meant for the terrain mesh underneath it. */}
        <gridHelper args={[GROUND_GRID_SIZE_M, 40, "#3a4a3f", "#25302a"]} raycast={() => null} />

        <GeoTerrainField tiles={tiles} onGroundClick={handleGroundClick} />

        <CharacterModel x={characterPos.x} y={characterPos.y} z={characterPos.z} angleToCenter={character.yaw} color="#5b8fd6" />

        {/* Real NPCs/mobs/other players from the live session, if connected -- see GameCreaturesField. */}
        <GameCreaturesField />
      </Canvas>
    </div>
  );
}
