import { Canvas } from "@react-three/fiber";
import { Campfire } from "./campfire.component";
import { PlayerModel } from "../../../core/scene/player-model.component";
import type { RaceNames, BaseClass, SexNames } from "../../../../config/character-races";
import {
  HALL_AMBIENT_COLOR,
  HALL_AMBIENT_INTENSITY,
  HALL_COLD_COLOR,
  HALL_COLD_INTENSITY,
  HALL_FOG_COLOR,
  HALL_FOG_FAR,
  HALL_BACKDROP_COLOR,
  HALL_FOG_NEAR,
  SELECT_ARC_RADIUS,
  SELECT_ARC_SPREAD,
  SELECT_FRONT_OFFSET,
} from "../../../../config/client-scene-lighting";

/** Stands in for the hall's far wall: no sky, because the client's own selection scene is indoors. */
const BACKDROP_SIZE: [number, number] = [70, 45];
const BACKDROP_Z = -25;

/**
 * A fill the hall's own ambient cannot give.
 *
 * The zone sets 20 of 255 and leans on ninety-two lights to do the rest; with
 * a handful standing in for them, that alone leaves the bodies unreadable.
 * Named separately so the client's number above stays the client's.
 */
const HALL_FILL_INTENSITY = 0.55;

/**
 * The arc's own centre, which the client puts in front of the ring rather
 * than at its middle -- see SELECT_FRONT_OFFSET. Characters stand a radius
 * away from it and turn to face it.
 */
const ARC_CENTER_Z = SELECT_FRONT_OFFSET;

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
        <fog attach="fog" args={[HALL_FOG_COLOR, HALL_FOG_NEAR, HALL_FOG_FAR]} />

        <ambientLight color={HALL_AMBIENT_COLOR} intensity={HALL_AMBIENT_INTENSITY + HALL_FILL_INTENSITY} />
        {/* The cold family, which in the hall washes down from above the arc. */}
        <pointLight position={[-4, 7, -3]} color={HALL_COLD_COLOR} intensity={HALL_COLD_INTENSITY} distance={22} decay={2} />
        <pointLight position={[4, 7, -3]} color={HALL_COLD_COLOR} intensity={HALL_COLD_INTENSITY} distance={22} decay={2} />
        {/* The warm family is the flames, and the campfire below already is one. */}

        <mesh position={[0, 0, BACKDROP_Z]} scale={[BACKDROP_SIZE[0], BACKDROP_SIZE[1], 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial color={HALL_BACKDROP_COLOR} />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <circleGeometry args={[12, 48]} />
          <meshStandardMaterial color="#0e0d0c" roughness={1} />
        </mesh>

        <Campfire />

        {characters.map((character, index) => {
          // The client's own arc: seven slots on a ring of SELECT_ARC_RADIUS
          // spanning SELECT_ARC_SPREAD, centred on the spot in front of them.
          // Its middle step is left empty there, so the positions are laid
          // out as eight and the middle one skipped -- which is also why a
          // character never stands between the viewer and that centre.
          const SLOTS = 8;
          const slot = index < SLOTS / 2 ? index : index + 1;
          const t = slot / SLOTS - 0.5;
          const angle = SELECT_ARC_SPREAD * t;
          const x = Math.sin(angle) * SELECT_ARC_RADIUS;
          const z = ARC_CENTER_Z - Math.cos(angle) * SELECT_ARC_RADIUS;

          // Turned to the middle of the ring, which is what every one of the
          // client's seven yaws does to within a degree -- and since the
          // camera looks from beyond that middle, it reads as facing the
          // viewer. A model's local forward is +Z, so a yaw of atan2(dx, dz)
          // points it along (dx, dz).
          const faceCamera = Math.atan2(-x, ARC_CENTER_Z - z);

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
