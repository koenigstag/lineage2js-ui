import { Canvas } from "@react-three/fiber";
import { Campfire } from "./campfire.component";
import { CharacterMarker } from "../../../core/scene/character-marker.component";
import { SkyLayer } from "../../login/atmosphere/sky-layer.component";
import { StarField } from "../../login/atmosphere/star-field.component";
import { getSkinColor, getBodyScale, type Race, type BaseClass, type Sex } from "../../../../config/character-races";
import { colorForVariant } from "../../create-char/scene/race-gallery.utils";

const SKY_SIZE: [number, number] = [70, 45];
const SKY_Z = -25;

const CIRCLE_RADIUS = 2.6;
const ARC_SPREAD = Math.PI * 0.85;

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
        camera={{ position: [0, 4.2, 7.5], fov: 42, near: 0.1, far: 60 }}
        onCreated={({ camera }) => camera.lookAt(0, 3, 0)}
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

          const race = character.race as Race;
          const baseClass = character.baseClass as BaseClass;
          const sex = character.sex as Sex;
          const bodyScale = getBodyScale(race, baseClass, sex);

          return (
            <CharacterMarker
              key={character.id}
              x={x}
              z={z}
              angleToCenter={angle + Math.PI / 2}
              color={colorForVariant({ race, baseClass, sex })}
              skinColor={getSkinColor(race)}
              heightScale={bodyScale.height}
              widthScale={bodyScale.width}
              hasCape={race === "KAMAEL"}
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
