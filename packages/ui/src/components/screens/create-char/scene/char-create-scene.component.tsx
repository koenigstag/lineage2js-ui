import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Object3D } from "three";
import { CharacterMarker } from "../../../core/scene/character-marker.component";
import { SkyLayer } from "../../login/atmosphere/sky-layer.component";
import { StarField } from "../../login/atmosphere/star-field.component";
import { RACES, getSkinColor, getBodyScale, type Race } from "../../../../config/character-races";
import { RACE_GALLERY, colorForVariant, type GalleryVariant } from "./race-gallery.utils";
import { CameraRig } from "./camera-rig.component";

const SKY_SIZE: [number, number] = [300, 100];
const SKY_Z = -50;

const VARIANT_SPACING = 1.3;
const CLASS_GAP_EXTRA = 0.9;
// Wide enough that a group's close-up camera shot never shows a
// neighboring group (see CameraRig).
const GROUP_SPACING = 10;

function groupXForRace(race: Race): number {
  return RACES.indexOf(race) * GROUP_SPACING;
}

// Lateral offsets for a group's variants: normal spacing within the same
// class, an extra gap where it switches from Fighter to Mystic, centered on 0.
function variantOffsets(variants: GalleryVariant[]): number[] {
  const offsets: number[] = [0];
  for (let i = 1; i < variants.length; i++) {
    const gap = VARIANT_SPACING + (variants[i].baseClass !== variants[i - 1].baseClass ? CLASS_GAP_EXTRA : 0);
    offsets.push(offsets[i - 1] + gap);
  }
  const mid = (offsets[0] + offsets[offsets.length - 1]) / 2;
  return offsets.map((offset) => offset - mid);
}

interface MoonLightProps {
  groupX: number;
}

// Directional lights aim at their `target` object's world position -- the
// default target sits at the world origin, which put distant groups (large
// groupX) at a steep side angle instead of front-lit. Giving the light its
// own target object that tracks groupX keeps the light aimed at whichever
// group the camera is currently on.
function MoonLight({ groupX }: MoonLightProps) {
  const target = useMemo(() => new Object3D(), []);
  target.position.set(groupX, 1.5, 0);

  return (
    <>
      <primitive object={target} />
      <directionalLight position={[groupX + 2, 9, 8]} target={target} intensity={1.4} color="#d8e4ff" />
    </>
  );
}

export interface CharCreateSceneProps {
  race: Race;
}

/** Character-creation backdrop: camera focuses on the selected race's group of class/sex placeholders. */
export function CharCreateScene({ race }: CharCreateSceneProps) {
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [groupXForRace(RACES[0]), 2.4, 7], fov: 45, near: 0.1, far: 150 }}
        onCreated={({ camera }) => camera.lookAt(groupXForRace(RACES[0]), 1.6, 0)}
      >
        <CameraRig targetX={groupXForRace(race)} />

        <ambientLight intensity={0.7} color="#5a6a8a" />
        <MoonLight groupX={groupXForRace(race)} />

        <SkyLayer size={SKY_SIZE} z={SKY_Z} />
        <StarField size={SKY_SIZE} z={SKY_Z + 1} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(RACES.length - 1) * GROUP_SPACING * 0.5, 0, 0]}>
          <planeGeometry args={[RACES.length * GROUP_SPACING + 200, 200]} />
          <meshStandardMaterial color="#0e0d0c" roughness={1} />
        </mesh>

        {RACE_GALLERY.map((group) => {
          const groupX = groupXForRace(group.race);
          const offsets = variantOffsets(group.variants);

          return (
            <group key={group.race}>
              {group.variants.map((variant, variantIndex) => {
                const x = groupX + offsets[variantIndex];
                const bodyScale = getBodyScale(variant.race, variant.baseClass, variant.sex);

                return (
                  <CharacterMarker
                    key={`${variant.race}-${variant.baseClass}-${variant.sex}`}
                    x={x}
                    z={0}
                    angleToCenter={0}
                    color={colorForVariant(variant)}
                    skinColor={getSkinColor(variant.race)}
                    heightScale={bodyScale.height}
                    widthScale={bodyScale.width}
                    hasCape={variant.race === "kamael"}
                  />
                );
              })}
            </group>
          );
        })}
      </Canvas>
    </div>
  );
}
