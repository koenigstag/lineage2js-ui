import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import type { Camera } from "three";
import { observer } from "mobx-react-lite";
import { CharacterModel } from "../../../core/scene/character-model.component";
import { l2HeadingToThreeYaw, l2ToThree, threeToL2 } from "../../../../utils/coords";
import { heightAtWorld } from "../../../../utils/geodata/geo-tile-height";
import { useGeoTiles } from "../../../../utils/geodata/use-geo-tiles";
import { interpolatedCreaturePosition } from "../../../../utils/creature-movement";
import { useGameStore } from "../../../../stores/StoreContext";
import type { WorldCreatureSnapshot } from "../../../../stores/GameStore";
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
// Below this, a touch drag is still treated as a potential tap (move/select)
// rather than committing to a camera-orbit drag -- avoids hijacking taps on
// finger jitter, matching how a native "click" tolerates tiny movement.
const TOUCH_ORBIT_THRESHOLD_PX = 8;

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
  /** Present once a live session exists -- see GameScene's own realPlayer. */
  realPlayer: WorldCreatureSnapshot | undefined;
  /** Only used while realPlayer is absent (local WASD/click test rig). */
  fallbackWorldX: number;
  fallbackWorldY: number;
  fallbackGroundHeightM: number;
  orbitRef: MutableRefObject<OrbitState>;
}

/**
 * Orbits the camera around the followed character every frame, at the
 * drag-controlled azimuth/pitch. Recomputes realPlayer's interpolated
 * position every frame (see interpolatedCreaturePosition) rather than once
 * per GameScene render, so the camera doesn't lag/step along with
 * gameStore.creatures' own ~150ms poll cadence while the same interpolation
 * already makes the rendered body (GameCreaturesField) move smoothly.
 */
function CameraFollow({ realPlayer, fallbackWorldX, fallbackWorldY, fallbackGroundHeightM, orbitRef }: CameraFollowProps) {
  useFrame(({ camera }: { camera: Camera }) => {
    let target;
    let groundHeightM;
    if (realPlayer) {
      const l2Pos = interpolatedCreaturePosition(realPlayer);
      target = l2ToThree(l2Pos.x, l2Pos.y, l2Pos.z);
      groundHeightM = target.y;
    } else {
      target = l2ToThree(fallbackWorldX, fallbackWorldY, 0);
      groundHeightM = fallbackGroundHeightM;
    }

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
 * The main game scene: camera, geodata terrain, and every nearby creature
 * (see GameCreaturesField, which already renders the local player with
 * real race/class colors via PlayerModel, and mobs/NPCs tinted by NpcRace).
 *
 * Once a live session has put us in gameStore.creatures (via gameStore.me),
 * the camera and geodata streaming follow the server-reported player
 * position -- world coordinates are absolute, with raw L2J region 20_18.l2j
 * covering world origin. Before that (no session yet -- e.g. testing this
 * scene standalone), it falls back to a local WASD/click-to-move test
 * character starting at world origin, same as before. Either way, holding
 * the right mouse button and dragging orbits the camera, like the retail L2
 * client.
 *
 * Left-click on the ground sends a real move-to request to the server (see
 * GameStore.moveTo) once a live session exists; the server's own
 * MoveToLocation reply is what actually animates us, same as any other
 * creature. WASD still only drives the local fallback test character (not
 * wired to the server -- see TODO.md) and is inert once a real player is
 * present.
 */
export const GameScene = observer(function GameScene() {
  const gameStore = useGameStore();
  const [character, setCharacter] = useState<TestCharacterState>({ x: 0, y: 0, yaw: 0 });
  // Refs, not state: only read inside the rAF/useFrame loops below, so
  // updating them shouldn't itself trigger a render.
  const moveTargetRef = useRef<MoveTarget | null>(null);
  const orbitRef = useRef<OrbitState>({ azimuth: DEFAULT_AZIMUTH, pitch: DEFAULT_PITCH });
  // Set true once an in-progress single-finger touch drag crosses the orbit
  // threshold -- GeoTerrainTile's ground-click defers its move/select action
  // on touch until pointerup, then checks this to tell a tap from a drag.
  const orbitDragActiveRef = useRef(false);

  const realPlayer = gameStore.me !== undefined ? gameStore.creatures.get(gameStore.me) : undefined;
  const worldX = realPlayer?.x ?? character.x;
  const worldY = realPlayer?.y ?? character.y;
  const yaw = realPlayer ? l2HeadingToThreeYaw(realPlayer.heading) : character.yaw;

  const tiles = useGeoTiles(worldX, worldY);

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
    console.log("[click-debug] three point", event.point.toArray(), "-> L2 target", target, "player L2 now", realPlayer && { x: realPlayer.x, y: realPlayer.y, z: realPlayer.z });
    if (realPlayer) {
      gameStore.moveTo(target.x, target.y, target.z);
    } else {
      moveTargetRef.current = { x: target.x, y: target.y };
    }
  }

  /**
   * Right-button drag rotates the camera around the character; released
   * anywhere, even off-canvas. Also handles a single-finger touch drag the
   * same way -- but since touch has no separate button for "orbit" vs "tap
   * to move/select", a drag only actually starts rotating (and marks
   * orbitDragActiveRef, which GeoTerrainTile's ground-click checks) once
   * total movement crosses TOUCH_ORBIT_THRESHOLD_PX. A tap that never
   * crosses it falls through untouched to the normal tap handling.
   */
  function handleOrbitPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const isTouch = event.pointerType === "touch";
    if (event.button !== 2 && !isTouch) {
      return;
    }
    // Only for the mouse/right-click case -- calling preventDefault() on a
    // touch pointerdown suppresses the browser's synthesized click for that
    // touch entirely (per the Pointer Events spec), which would break
    // tap-to-select/act on creatures (CharacterModel's onClick relies on
    // that native click). Touch scrolling/panning is disabled instead via
    // this wrapper's touchAction: "none" CSS below.
    if (!isTouch) {
      event.preventDefault();
    }
    let lastX = event.clientX;
    let lastY = event.clientY;
    let totalMoved = 0;

    function onMove(moveEvent: PointerEvent) {
      const dx = moveEvent.clientX - lastX;
      const dy = moveEvent.clientY - lastY;
      lastX = moveEvent.clientX;
      lastY = moveEvent.clientY;

      if (isTouch) {
        totalMoved += Math.hypot(dx, dy);
        if (totalMoved < TOUCH_ORBIT_THRESHOLD_PX) {
          return;
        }
        orbitDragActiveRef.current = true;
      }

      orbitRef.current = {
        azimuth: orbitRef.current.azimuth - dx * ORBIT_SENSITIVITY,
        // Inverted vs. dx on purpose -- matches the retail L2 client's
        // vertical camera-drag convention (drag down to look from above,
        // drag up to look from below), the opposite of a naive 1:1 mapping.
        pitch: clamp(orbitRef.current.pitch + dy * ORBIT_SENSITIVITY, MIN_PITCH, MAX_PITCH),
      };
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (isTouch) {
        // Deferred a tick so GeoTerrainTile's own pointerup listener (which
        // reads this same ref to resolve its deferred tap) still sees this
        // gesture's value before it's cleared for the next one.
        setTimeout(() => {
          orbitDragActiveRef.current = false;
        }, 0);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  const groundHeight = heightAtWorld(tiles, worldX, worldY) ?? 0;
  const characterPos = l2ToThree(worldX, worldY, realPlayer ? realPlayer.z : groundHeight);

  return (
    <div
      // Disables native scroll/pan/pinch-zoom for touch gestures on this
      // element -- the orbit drag and tap-to-move/select handling above
      // take over that whole gesture space instead.
      style={{ position: "absolute", inset: 0, touchAction: "none" }}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handleOrbitPointerDown}
    >
      <Canvas
        camera={{ position: [0, CAMERA_DISTANCE_M, CAMERA_DISTANCE_M], fov: 60, near: 0.1, far: 2000 }}
        onPointerMissed={() => console.log("[click-debug] pointer missed everything")}
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 10, 5]} intensity={0.6} />
        <CameraFollow
          realPlayer={realPlayer}
          fallbackWorldX={worldX}
          fallbackWorldY={worldY}
          fallbackGroundHeightM={characterPos.y}
          orbitRef={orbitRef}
        />

        {/* Reference ground plane -- gives the wireframe terrain a visible
            "down" and fills the gap while neighboring tiles are still loading.
            raycast={() => null} excludes it from pointer events so it can't
            steal ground-click hits meant for the terrain mesh underneath it. */}
        <gridHelper args={[GROUND_GRID_SIZE_M, 40, "#3a4a3f", "#25302a"]} raycast={() => null} />

        <GeoTerrainField tiles={tiles} onGroundClick={handleGroundClick} orbitDragActiveRef={orbitDragActiveRef} />

        {/* Local placeholder avatar -- only shown before a real player entry
            exists (no live session yet). Once gameStore.creatures has us,
            GameCreaturesField already renders this exact objectId via
            PlayerModel with our real race/class colors -- rendering both
            would double up. */}
        {!realPlayer && (
          <CharacterModel x={characterPos.x} y={characterPos.y} z={characterPos.z} angleToCenter={yaw} color="#5b8fd6" />
        )}

        {/* Real NPCs/mobs/other players from the live session, if connected -- see GameCreaturesField. */}
        <GameCreaturesField />
      </Canvas>
    </div>
  );
});
