import { Canvas } from "@react-three/fiber";
import { Campfire } from "./campfire.component";
import { PlayerModel } from "../../../core/scene/player-model.component";
import { SkyLayer } from "../../login/atmosphere/sky-layer.component";
import { StarField } from "../../login/atmosphere/star-field.component";
import type { RaceNames, BaseClass, SexNames } from "../../../../config/character-races";

const SKY_SIZE: [number, number] = [70, 45];
const SKY_Z = -25;

const CIRCLE_RADIUS = 2.6;
const ARC_SPREAD = Math.PI * 0.85;

// Kept as constants rather than inline in the Canvas props because the
// characters' facing is derived from the camera position below -- the two
// can't be allowed to drift apart.
const CAMERA_POSITION: [x: number, y: number, z: number] = [0, 4.2, 7.5];
const CAMERA_TARGET: [x: number, y: number, z: number] = [0, 3, 0];

export interface CharSelectSceneProps {
  characters: Array<{ id: number; nickname: string; race: string; baseClass: string; sex: string }>;
  selectedCharacterId?: number;
  onSelect: (id: number) => void;
}

/** Diablo-style character select backdrop: a campfire with characters standing in a circle around it. */
export function CharSelectScene({ characters, selectedCharacterId, onSelect }: CharSelectSceneProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
      }}
    >
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: CAMERA_POSITION, fov: 42, near: 0.1, far: 60 }}
        onCreated={({ camera }) => camera.lookAt(...CAMERA_TARGET)}
      >
        <ambientLight intensity={0.45} color="#5a6a8a" />
        <directionalLight position={[3, 6, 2]} intensity={0.35} color="#a8c0ff" />

        <SkyLayer size={SKY_SIZE} z={SKY_Z} />
        <StarField size={SKY_SIZE} z={SKY_Z + 1} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <circleGeometry args={[12, 48]} />
          <meshStandardMaterial color="#0e0d0c" roughness={1} />
        </mesh>

        <Campfire />

        {characters.map((character, index) => {
          // Semicircle on the far side of the fire (away from the camera,
          // which sits at +Z) -- nothing ever stands between the camera and
          // the fire.
          const count = characters.length;
          const t = count > 1 ? index / (count - 1) - 0.5 : 0;
          const angle = (Math.PI * 3) / 2 + ARC_SPREAD * t;
          const x = Math.cos(angle) * CIRCLE_RADIUS;
          const z = Math.sin(angle) * CIRCLE_RADIUS;

          // Everyone turns towards the viewer rather than towards the fire
          // they're standing around: on a select screen the point is to see
          // the characters' faces. Aimed at the camera's own (x, z) instead
          // of just flat +Z, so the ones out at the ends of the arc read as
          // looking at the viewer too rather than past them -- at the middle
          // of the arc it comes out as 0 anyway, same as char-create's lone
          // centred model. A model's local forward is +Z, so a yaw of
          // atan2(dx, dz) points it along (dx, dz).
          const faceCamera = Math.atan2(CAMERA_POSITION[0] - x, CAMERA_POSITION[2] - z);

          const race = character.race as RaceNames;
          const baseClass = character.baseClass as BaseClass;
          const sex = character.sex as SexNames;

          return (
            <PlayerModel
              key={character.id}
              x={x}
              z={z}
              angleToCenter={faceCamera}
              variant={{ race, baseClass, sex }}
              nickname={character.nickname}
              selected={character.id === selectedCharacterId}
              onSelect={() => onSelect(character.id)}
            />
          );
        })}
      </Canvas>
    </div>
  );
}
