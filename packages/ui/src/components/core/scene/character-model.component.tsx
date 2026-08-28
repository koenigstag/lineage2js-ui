import { DoubleSide } from "three";
import { NicknameLabel } from "./nickname-label.component";

/**
 * @deprecated Invented placeholder tone, not ported from any real art source
 * -- same status as character-races.ts's own colour tables. Only reached for a
 * creature with no race-specific tone of its own (mobs, npcs, summons).
 */
export const DEFAULT_SKIN_COLOR = "#d8b98a";

interface CharacterModelProps {
  x: number;
  /** World-up (three.js Y) foot position. Defaults to 0 (flat-floor scenes). */
  y?: number;
  z: number;
  angleToCenter: number;
  color: string;
  skinColor?: string;
  /** Vertical scale of the body (head/torso), e.g. shorter for dwarves. Defaults to 1. */
  heightScale?: number;
  /** Horizontal scale of the body, e.g. wider for dwarves, narrower for elves. Defaults to 1. */
  widthScale?: number;
  /** Draped cloak hanging from the shoulder (Kamael). Defaults to false. */
  hasCape?: boolean;
  nickname?: string;
  selected?: boolean;
  onSelect?: () => void;
  /** CSS cursor shown while hovering the model, e.g. "crosshair" for an attackable mob. Unset leaves the browser default. */
  cursor?: string;
  /** Tips the body over to lie flat on the ground instead of standing. Defaults to false. */
  isDead?: boolean;
}

/**
 * Simple procedural humanoid placeholder -- no character art exists yet.
 * Purely presentational: geometry/pose/label/click, decides nothing about
 * what color/scale to use -- that's PlayerModel/CreatureModel's job.
 */
export function CharacterModel({
  x,
  y = 0,
  z,
  angleToCenter,
  color,
  skinColor = DEFAULT_SKIN_COLOR,
  heightScale = 1,
  widthScale = 1,
  hasCape = false,
  nickname,
  selected = false,
  onSelect,
  cursor,
  isDead = false,
}: CharacterModelProps) {
  return (
    <group position={[x, y, z]} rotation={[0, angleToCenter, 0]}>
      {nickname && <NicknameLabel text={nickname} position={[0, 1.95 * heightScale, 0]} />}

      {/*
        Tips the whole body over to lie flat on the ground instead of
        standing -- a separate inner group so the tip happens in the
        character's own local frame (always "forward", regardless of
        angleToCenter, which the outer group already applied). The body's
        meshes are all built centered on the local Y axis (x≈z≈0), so
        rotating 90° around local X naturally lands them at y≈0 (ground
        level), spread out along Z instead of up along Y -- no extra
        position offset needed.
      */}
      <group rotation={isDead ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
        <group scale={[widthScale, heightScale, widthScale]}>
          <mesh
            position={[0, 0.9, 0]}
            onClick={
              onSelect &&
              ((event) => {
                event.stopPropagation();
                onSelect();
              })
            }
            // Ground-click (geo-terrain-tile.component.tsx) acts on
            // "pointerdown", not "click" -- and only stops its own
            // propagation once ITS handler runs, so without a pointerdown
            // handler here too, a pointerdown that hits this creature first
            // still falls through untouched to whatever ground mesh sits
            // behind/below it (nothing at this level "consumes" the ray for
            // that event type), firing a move-to-point order instead of --
            // or racing ahead of -- the click-based select just below.
            // Stopping propagation here (no other action -- onClick still
            // owns select/act) keeps a click on a creature from ever
            // reaching the ground underneath it.
            onPointerDown={
              onSelect &&
              ((event) => {
                event.stopPropagation();
              })
            }
            onPointerOver={
              cursor
                ? (event) => {
                    event.stopPropagation();
                    document.body.style.cursor = cursor;
                  }
                : undefined
            }
            onPointerOut={cursor ? () => (document.body.style.cursor = "auto") : undefined}
          >
            <capsuleGeometry args={[0.24, 0.85, 4, 8]} />
            <meshStandardMaterial color={color} roughness={0.7} />
          </mesh>
          {/* Counter-scale so the head stays a sphere instead of stretching into
              an ellipsoid along with the parent group's non-uniform scale. */}
          <mesh position={[0, 1.52, 0]} scale={[1 / widthScale, 1 / heightScale, 1 / widthScale]}>
            <sphereGeometry args={[0.21, 16, 16]} />
            <meshStandardMaterial color={skinColor} roughness={0.8} />
            {/* "Nose" -- the capsule+sphere body is otherwise rotationally
                symmetric, so this is the only visual cue for which way
                angleToCenter (local +Z, after the group's yaw rotation) actually
                points. Sits just outside the head sphere's 0.21 radius. */}
            <mesh position={[0, 0, 0.2]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshBasicMaterial color="#1a1a1a" />
            </mesh>
          </mesh>

          {hasCape && (
            <mesh position={[0.24, 0.95, -0.1]} rotation={[0.15, 0, 0.05]}>
              <planeGeometry args={[0.24, 0.85]} />
              <meshStandardMaterial color="#d4c2c8" roughness={0.85} side={DoubleSide} />
            </mesh>
          )}

          {selected && (
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.34, 0.42, 32]} />
              <meshBasicMaterial color="#ffd27a" transparent opacity={0.85} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
