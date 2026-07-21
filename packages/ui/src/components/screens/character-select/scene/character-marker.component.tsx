import { NicknameLabel } from "./nickname-label.component";

interface CharacterMarkerProps {
  x: number;
  z: number;
  angleToCenter: number;
  color: string;
  nickname: string;
  selected: boolean;
  onSelect: () => void;
}

/** Simple procedural humanoid placeholder standing in the campfire circle -- no character art exists yet. */
export function CharacterMarker({ x, z, angleToCenter, color, nickname, selected, onSelect }: CharacterMarkerProps) {
  return (
    <group position={[x, 0, z]} rotation={[0, angleToCenter, 0]}>
      <NicknameLabel text={nickname} position={[0, 1.95, 0]} />

      <mesh
        position={[0, 0.9, 0]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <capsuleGeometry args={[0.24, 0.85, 4, 8]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.52, 0]}>
        <sphereGeometry args={[0.21, 16, 16]} />
        <meshStandardMaterial color="#d8b98a" roughness={0.8} />
      </mesh>

      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.34, 0.42, 32]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}
