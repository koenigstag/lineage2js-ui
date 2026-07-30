import { DoubleSide } from "three";
import { NicknameLabel } from "./nickname-label.component";

interface CharacterMarkerProps {
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
}

/** Simple procedural humanoid placeholder -- no character art exists yet. */
export function CharacterMarker({
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
}: CharacterMarkerProps) {
  return (
    <group position={[x, y, z]} rotation={[0, angleToCenter, 0]}>
      {nickname && <NicknameLabel text={nickname} position={[0, 1.95 * heightScale, 0]} />}

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
  );
}
