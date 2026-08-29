import { Canvas } from "@react-three/fiber";
import { Campfire } from "./campfire.component";
import { PlayerModel } from "../../../core/scene/player-model.component";
import type { RaceNames, BaseClass, SexNames } from "../../../../config/character-races";
import { DaySky } from "../../../core/scene/day-sky.component";
import {
  CLIENT_AMBIENT_INTENSITY,
  CLIENT_FOG_FAR,
  CLIENT_FOG_NEAR,
  CLIENT_SUN_DIRECTION,
  CLIENT_SUN_INTENSITY,
  FILL_GROUND_COLOR,
  FILL_INTENSITY,
  FILL_SKY_COLOR,
  SELECT_ARC_RADIUS,
  SELECT_ARC_SPREAD,
} from "../../../../config/client-scene-lighting";

const SKY_SIZE: [number, number] = [70, 45];
const SKY_Z = -25;

/** How far along its own direction to put the sun. Any distance does, for a light with no falloff. */
const SUN_DISTANCE = 14;

/** The middle of the ring: characters stand a radius away from it and turn to face it. */
const ARC_CENTER_Z = -3;

/**
 * How far behind that middle the campfire sits.
 *
 * It only has to be inside the ring, not at its centre -- what put the bodies
 * in the fire before was a centre four units in front of it, which is past
 * where the arc's own ends come round. Set deeper than the middle it reads as
 * a fire the group has gathered at, and being further from the camera it
 * stops sitting on the bottom edge of the frame.
 */
const FIRE_INSET = 2;

// Kept as constants rather than inline in the Canvas props because the
// characters' facing is derived from the camera position below -- the two
// can't be allowed to drift apart.
// Framed for the client's ring rather than the tighter circle this scene used
// to stand people in: they are a radius of SELECT_ARC_RADIUS out, so the
// camera sits closer than the distance alone suggests and looks past the fire
// at the arc behind it, or the group ends up a thin band under empty sky.
const CAMERA_POSITION: [x: number, y: number, z: number] = [0, 3.2, 2.6];
const CAMERA_TARGET: [x: number, y: number, z: number] = [0, 1.5, -5.5];

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
        <fog attach="fog" args={["#8fa8c8", CLIENT_FOG_NEAR, CLIENT_FOG_FAR]} />

        <ambientLight intensity={CLIENT_AMBIENT_INTENSITY} />
        <hemisphereLight args={[FILL_SKY_COLOR, FILL_GROUND_COLOR, FILL_INTENSITY]} />
        <directionalLight
          position={CLIENT_SUN_DIRECTION.map((axis) => axis * SUN_DISTANCE) as [number, number, number]}
          intensity={CLIENT_SUN_INTENSITY}
          color="#fff4e0"
        />

        <DaySky size={SKY_SIZE} z={SKY_Z} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <circleGeometry args={[12, 48]} />
          <meshStandardMaterial color="#0e0d0c" roughness={1} />
        </mesh>

        {/* Built around its own origin, so the ring's centre is a group around it. */}
        <group position={[0, 0, ARC_CENTER_Z - FIRE_INSET]}>
          <Campfire />
        </group>

        {characters.map((character, index) => {
          // The client's own arc: seven slots -- the account's character cap --
          // on a ring of SELECT_ARC_RADIUS spanning SELECT_ARC_SPREAD. Its
          // steps are even at about 13.5 degrees except across the middle,
          // where the client doubles it exactly, so the positions are laid out
          // as eight and the middle one skipped. That keeps the line from the
          // viewer to the centre of the ring clear.
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
