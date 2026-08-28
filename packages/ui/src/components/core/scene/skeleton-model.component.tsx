import { useEffect, useMemo } from "react";
import { DoubleSide, MeshStandardMaterial, SkinnedMesh, type BufferGeometry } from "three";
import { NicknameLabel } from "./nickname-label.component";
import { HUMANOID_IDLE_POSE, type HumanoidPose } from "../../../utils/skeleton/humanoid-rig";
import {
  buildHumanoidGeometry,
  buildHumanoidSkeleton,
  buildSkeletonBinding,
} from "../../../utils/skeleton/humanoid-mesh";

export interface SkeletonModelProps {
  x: number;
  /** World-up (three.js Y) foot position. Defaults to 0 (flat-floor scenes). */
  y?: number;
  z: number;
  angleToCenter: number;
  color: string;
  skinColor?: string;
  /** Vertical scale of the body, e.g. shorter for dwarves. Defaults to 1. */
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
  /** Bone rotations layered on the rest pose -- see HumanoidPose. Defaults to a standing idle. */
  pose?: HumanoidPose;
}

/**
 * Body geometry is identical for everyone wearing the same two colours, and
 * costs about a thousand vertices to generate, so it's built once per colour
 * pair and shared. Skeletons are not shared -- every character poses its own.
 */
const geometryCache = new Map<string, BufferGeometry>();

function sharedGeometry(color: string, skinColor: string): BufferGeometry {
  const key = `${color}|${skinColor}`;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = buildHumanoidGeometry(buildHumanoidSkeleton(), color, skinColor);
    geometryCache.set(key, geometry);
  }
  return geometry;
}

/**
 * Procedural humanoid: one skinned mesh over a real bone hierarchy (see
 * utils/skeleton/humanoid-rig.ts and humanoid-mesh.ts). Used for players and
 * NPCs; mobs still render the older capsule placeholder, see CreatureModel.
 *
 * Same props and the same outward behaviour as the capsule it replaces:
 * position/facing, race scaling, cape, selection ring, nickname, the dead
 * pose, and the click/cursor handling.
 *
 * Picking is one invisible capsule around the body rather than the body mesh
 * itself: the hit volume should be the character, not whichever forearm
 * happened to be under the cursor, and it stays the same size whatever pose
 * the rig is in.
 */
export function SkeletonModel({
  x,
  y = 0,
  z,
  angleToCenter,
  color,
  skinColor = "#d8b98a",
  heightScale = 1,
  widthScale = 1,
  hasCape = false,
  nickname,
  selected = false,
  onSelect,
  cursor,
  isDead = false,
  pose = HUMANOID_IDLE_POSE,
}: SkeletonModelProps) {
  const body = useMemo(() => {
    const rig = buildHumanoidSkeleton();
    const mesh = new SkinnedMesh(
      sharedGeometry(color, skinColor),
      new MeshStandardMaterial({ vertexColors: true, roughness: 0.75 })
    );
    // The root bone has to live in the scene graph for the skeleton to be
    // updated each frame; hanging it off the mesh keeps the pair together.
    mesh.add(rig.root);
    mesh.bind(buildSkeletonBinding(rig));
    // Picking goes through the invisible capsule below -- see the doc comment.
    mesh.raycast = () => null;
    return { mesh, rig };
  }, [color, skinColor]);

  useEffect(() => () => (body.mesh.material as MeshStandardMaterial).dispose(), [body]);

  // Rest rotations first, then whatever the pose asks for, so a pose only has
  // to name the bones it actually moves.
  useMemo(() => {
    for (const bone of body.rig.bones) {
      const rotation = pose[bone.name];
      bone.rotation.set(rotation?.[0] ?? 0, rotation?.[1] ?? 0, rotation?.[2] ?? 0);
    }
  }, [body, pose]);

  return (
    <group position={[x, y, z]} rotation={[0, angleToCenter, 0]}>
      {nickname && <NicknameLabel text={nickname} position={[0, 1.95 * heightScale, 0]} />}

      {/* Tipped over in the character's own local frame, same as the capsule
          placeholder did -- the outer group has already applied the facing. */}
      <group rotation={isDead ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
        <group scale={[widthScale, heightScale, widthScale]}>
          <primitive object={body.mesh} />

          {/* Invisible pick volume -- see this component's own doc comment. */}
          <mesh
            position={[0, 0.9, 0]}
            visible={false}
            onClick={
              onSelect &&
              ((event) => {
                event.stopPropagation();
                onSelect();
              })
            }
            // Ground-click acts on "pointerdown" (geo-terrain-tile.component.tsx)
            // and only stops propagation once its own handler runs, so without
            // this a pointerdown on a creature still falls through to the ground
            // behind it and fires a move order.
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
            <capsuleGeometry args={[0.3, 1.1, 4, 8]} />
          </mesh>

          {hasCape && (
            <mesh position={[0.24, 0.95, -0.1]} rotation={[0.15, 0, 0.05]} raycast={() => null}>
              <planeGeometry args={[0.24, 0.85]} />
              <meshStandardMaterial color="#d4c2c8" roughness={0.85} side={DoubleSide} />
            </mesh>
          )}

          {selected && (
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <ringGeometry args={[0.34, 0.42, 32]} />
              <meshBasicMaterial color="#ffd27a" transparent opacity={0.85} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
