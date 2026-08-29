import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, type Sprite } from "three";
import { l2ToThree } from "../../../../utils/coords";
import { ARRIVE_EPSILON, interpolatedCreaturePosition } from "../../../../utils/creature-movement";
import type { WorldCreatureSnapshot } from "../../../../stores/GameStore";

const DIAMETER_M = 0.75;
// Lifts the disc's center off the ground so it reads as a standing ring
// rather than a coin half-buried in the terrain -- half the diameter, so the
// bottom edge still grazes the ground regardless of size.
const GROUND_OFFSET_M = DIAMETER_M / 2;

function createMarkerTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  const cx = size / 2;
  const cy = size / 2;

  // No hard-edged disc/rim -- just a glow fading out over the full texture,
  // soft by construction (a continuous gradient, not a stroked boundary).
  const fill = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2);
  fill.addColorStop(0, "rgba(70, 140, 255, 0.8)");
  fill.addColorStop(0.6, "rgba(70, 140, 255, 0.35)");
  fill.addColorStop(1, "rgba(70, 140, 255, 0)");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, size, size);

  return new CanvasTexture(canvas);
}

interface MoveTargetMarkerProps {
  /** The local player's own creature snapshot, if a live session exists. */
  realPlayer: WorldCreatureSnapshot | undefined;
}

/**
 * Marks the local player's current click-to-move destination: a flat,
 * semi-transparent blue disc standing upright at the target point, always
 * turned to face the camera -- a three.js sprite always is, the same trick
 * NicknameLabel relies on for the same reason.
 *
 * Position and visibility are set imperatively every frame (see useFrame
 * below), the same reason AnimatedCreature drives its own group that way
 * instead of via props: realPlayer only updates on GameStore.creatures' own
 * ~150ms poll, which is exactly the lag that would otherwise leave the
 * marker hanging around for up to a beat after the body -- rendered every
 * frame off the same interpolatedCreaturePosition used below -- has visibly
 * reached it. Cancelling (GameStore.cancelCurrentAction) hides it exactly
 * the same way a normal arrival does: both just end the move segment, and
 * this only ever looks at distance to go, not why the segment ended.
 */
export function MoveTargetMarker({ realPlayer }: MoveTargetMarkerProps) {
  const texture = useMemo(() => createMarkerTexture(), []);
  const spriteRef = useRef<Sprite>(null);

  useEffect(() => {
    return () => texture.dispose();
  }, [texture]);

  useFrame(() => {
    const sprite = spriteRef.current;
    if (!sprite) {
      return;
    }

    const moveTo = realPlayer?.isMoving ? realPlayer.moveTo : undefined;
    if (!realPlayer || !moveTo) {
      sprite.visible = false;
      return;
    }

    const current = interpolatedCreaturePosition(realPlayer);
    const remaining = Math.hypot(moveTo.x - current.x, moveTo.y - current.y);
    if (remaining <= ARRIVE_EPSILON) {
      sprite.visible = false;
      return;
    }

    const pos = l2ToThree(moveTo.x, moveTo.y, moveTo.z);
    sprite.position.set(pos.x, pos.y + GROUND_OFFSET_M, pos.z);
    sprite.visible = true;
  });

  return (
    <sprite ref={spriteRef} visible={false} scale={[DIAMETER_M, DIAMETER_M, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} opacity={0.7} />
    </sprite>
  );
}
