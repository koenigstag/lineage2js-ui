import { Fragment, useMemo } from "react";
import { DoubleSide, Quaternion, Vector3 } from "three";
import { NicknameLabel } from "./nickname-label.component";
import {
  HEAD_RADIUS,
  HUMANOID_IDLE_POSE,
  humanoidChildren,
  type HumanoidBone,
  type HumanoidPose,
} from "../../../utils/skeleton/humanoid-rig";

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

/** Capsule geometry runs along +Y; every limb segment is rotated off that. */
const CAPSULE_AXIS = new Vector3(0, 1, 0);

interface LimbSegmentProps {
  /** The child bone's offset -- the segment spans from this bone's origin to there. */
  offset: [number, number, number];
  thickness: number;
  color: string;
}

/**
 * The stand-in limb for one bone: a capsule spanning from the bone's own
 * origin to the child it leads to. Drawn *inside* the parent bone on
 * purpose, so it swings with that bone's rotation -- rotating `upperArm.L`
 * has to move the upper arm, not just everything below the elbow.
 */
function LimbSegment({ offset, thickness, color }: LimbSegmentProps) {
  const { position, quaternion, cylinderLength } = useMemo(() => {
    const vector = new Vector3(...offset);
    const length = vector.length();
    return {
      position: vector.clone().multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(CAPSULE_AXIS, vector.clone().normalize()),
      // CapsuleGeometry's first two args are radius and the *cylinder*
      // length, with a hemisphere on each end -- so the straight part has to
      // give back what the caps add, or every limb overshoots its joint.
      cylinderLength: Math.max(0, length - thickness * 2),
    };
  }, [offset, thickness]);

  return (
    <mesh position={position} quaternion={quaternion} raycast={() => null}>
      <capsuleGeometry args={[thickness, cylinderLength, 4, 8]} />
      <meshStandardMaterial color={color} roughness={0.7} />
    </mesh>
  );
}

interface BoneNodeProps {
  bone: HumanoidBone;
  pose: HumanoidPose;
  color: string;
  skinColor: string;
  /** Undone on the head so it stays a sphere under a non-uniform body scale. */
  inverseScale: [number, number, number];
}

/**
 * One real THREE.Bone plus the placeholder geometry hanging off it, recursing
 * into its children. `<bone>` is r3f's element for THREE.Bone, so this builds
 * an actual bone hierarchy -- the thing an animation clip, an equipment
 * attachment point or a skinned mesh would later bind to -- rather than a
 * pile of nested groups that merely looks like one.
 */
function BoneNode({ bone, pose, color, skinColor, inverseScale }: BoneNodeProps) {
  const rotation = pose[bone.name] ?? [0, 0, 0];
  const children = humanoidChildren(bone.name);

  return (
    <bone position={bone.offset} rotation={rotation}>
      {bone.name === "head" && (
        <mesh position={[0, HEAD_RADIUS, 0]} scale={inverseScale} raycast={() => null}>
          <sphereGeometry args={[HEAD_RADIUS, 16, 16]} />
          <meshStandardMaterial color={skinColor} roughness={0.8} />
          {/* Keeps the placeholder's one directional cue: which way the
              character is actually facing. */}
          <mesh position={[0, 0, HEAD_RADIUS * 0.95]}>
            <sphereGeometry args={[0.028, 8, 8]} />
            <meshBasicMaterial color="#1a1a1a" />
          </mesh>
        </mesh>
      )}

      {children.map((child) => (
        <Fragment key={child.name}>
          {child.thickness !== undefined && (
            <LimbSegment
              offset={child.offset}
              thickness={child.thickness}
              // Hands read as skin, everything else as the outfit's tint --
              // enough to tell a body from its extremities without any real art.
              color={child.name.startsWith("hand.") ? skinColor : color}
            />
          )}
          <BoneNode bone={child} pose={pose} color={color} skinColor={skinColor} inverseScale={inverseScale} />
        </Fragment>
      ))}
    </bone>
  );
}

/**
 * Procedural humanoid built on a real bone hierarchy (see
 * utils/skeleton/humanoid-rig.ts) -- used for players and NPCs. Mobs still
 * render the older capsule placeholder, see CreatureModel.
 *
 * Same props and the same outward behaviour as CharacterModel, which it
 * replaces for those two kinds: position/facing, race scaling, cape,
 * selection ring, nickname, the dead pose, and the click/cursor handling.
 * The difference is underneath -- a rig that survives the day real geometry
 * shows up, instead of a capsule that gets deleted.
 *
 * Picking is one invisible capsule around the body rather than handlers on
 * twenty limbs: the hit volume should be the character, not whichever forearm
 * happened to be under the cursor, and it keeps selection working the same
 * whatever pose the rig is in.
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
  const root = useMemo(() => humanoidChildren(null)[0], []);
  const inverseScale: [number, number, number] = [1 / widthScale, 1 / heightScale, 1 / widthScale];

  return (
    <group position={[x, y, z]} rotation={[0, angleToCenter, 0]}>
      {nickname && <NicknameLabel text={nickname} position={[0, 1.95 * heightScale, 0]} />}

      {/* Tipped over in the character's own local frame, same as the capsule
          placeholder did -- the outer group has already applied the facing. */}
      <group rotation={isDead ? [Math.PI / 2, 0, 0] : [0, 0, 0]}>
        <group scale={[widthScale, heightScale, widthScale]}>
          <BoneNode bone={root} pose={pose} color={color} skinColor={skinColor} inverseScale={inverseScale} />

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
            // behind it and fires a move order. Stopping it here keeps a click on
            // a creature from ever reaching the terrain underneath.
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
