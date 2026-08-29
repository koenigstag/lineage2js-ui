import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Object3D } from "three";
import { PlayerModel } from "../../../core/scene/player-model.component";
import { RACES, getBodyScale, type RaceNames, type BaseClass, type SexNames } from "../../../../config/character-races";
import type { CharacterAppearance } from "../../../../config/character-appearance";
import { getCharacterModelUrl } from "../../../../config/character-models";
import { CLIENT_DATA_CORRECTION, getHeadHeight, useCharacterModel } from "../../../../utils/models/character-model";
import {
  CLIENT_AMBIENT_INTENSITY,
  CLIENT_FOG_FAR,
  CLIENT_FOG_NEAR,
  CLIENT_SUN_DIRECTION,
  CLIENT_SUN_INTENSITY,
  FILL_GROUND_COLOR,
  FILL_INTENSITY,
  FILL_SKY_COLOR,
} from "../../../../config/client-scene-lighting";
import { DaySky } from "../../../core/scene/day-sky.component";
import { RACE_GALLERY } from "./race-gallery.utils";
import { CameraRig, type CameraFocus } from "./camera-rig.component";

const SKY_SIZE: [number, number] = [300, 100];
const SKY_Z = -50;

// Wide enough that a group's close-up camera shot never shows a
// neighboring group (see CameraRig).
const GROUP_SPACING = 10;

/**
 * The three shots creation narrows down through. Each choice moves in one
 * step: the race's whole line-up, then the chosen class's two bodies, then
 * the face -- which is where the remaining choices (face, hair, hair colour)
 * are made, so it is framed close enough to judge them.
 *
 * All three scale with CLIENT_DATA_CORRECTION, not LEGACY_SCENE_SCALE: GROUP_SHOT
 * and CLASS_SHOT frame RACE_GALLERY's own slot positions (corrected by that
 * same factor, see race-gallery.utils.ts), and FACE_SHOT frames getHeadHeight()'s
 * output, which is CHARACTER_MODEL_SCALE-derived and therefore *also* shrank
 * by exactly CLIENT_DATA_CORRECTION when that scale was corrected -- using
 * LEGACY_SCENE_SCALE here (as this first did) mismatches both, which is what
 * put the close-up shot's camera through some heads and off in empty space
 * for others.
 */
const GROUP_SHOT = { height: 2.4 * CLIENT_DATA_CORRECTION, distance: 7 * CLIENT_DATA_CORRECTION, lookHeight: 1.6 * CLIENT_DATA_CORRECTION };
const CLASS_SHOT = { height: 2 * CLIENT_DATA_CORRECTION, distance: 4.4 * CLIENT_DATA_CORRECTION, lookHeight: 1.25 * CLIENT_DATA_CORRECTION };
const FACE_SHOT = { distance: 0.95 * CLIENT_DATA_CORRECTION, above: 0.02 * CLIENT_DATA_CORRECTION };
/**
 * Where the placeholder body's head sits, for the races and setups with no
 * converted model to measure. Not scaled: this describes CharacterModel's
 * own procedural capsule, which was never wrong and never changed -- see
 * LEGACY_SCENE_SCALE's own comment.
 */
const PLACEHOLDER_HEAD_HEIGHT = 1.64;

function groupXForRace(race: RaceNames): number {
  return RACES.indexOf(race) * GROUP_SPACING;
}


interface SunLightProps {
  groupX: number;
}

/** How far along its own direction to put the sun. Any distance does, for a light with no falloff. */
const SUN_DISTANCE = 12;

// The client's own sun, at the angle its lobby level sets (see
// config/client-scene-lighting). Directional lights aim at their `target`
// object's world position, and the default target sits at the world origin --
// which for a distant group (large groupX) would swing the light round to the
// side. Giving it a target that tracks groupX keeps the angle the same for
// every race, which is what the client gets for free by having one sun over
// six places in one level.
function SunLight({ groupX }: SunLightProps) {
  const target = useMemo(() => new Object3D(), []);
  target.position.set(groupX, 1.5, 0);
  const [dx, dy, dz] = CLIENT_SUN_DIRECTION;

  return (
    <>
      <primitive object={target} />
      <directionalLight
        position={[groupX + dx * SUN_DISTANCE, 1.5 + dy * SUN_DISTANCE, dz * SUN_DISTANCE]}
        target={target}
        intensity={CLIENT_SUN_INTENSITY}
        color="#fff4e0"
      />
    </>
  );
}

export interface CharCreateSceneProps {
  race: RaceNames;
  /** Unset until chosen -- the camera stays on the whole group while it is. */
  baseClass: BaseClass | null;
  /** Unset until chosen, by a select or by clicking one of the bodies. */
  sex: SexNames | null;
  appearance: CharacterAppearance;
  onSelectVariant: (race: RaceNames, baseClass: BaseClass, sex: SexNames) => void;
}

/** Character-creation backdrop: the camera closes in on the selected race, then class, then face as the choices are made. */
export function CharCreateScene({ race, baseClass, sex, appearance, onSelectVariant }: CharCreateSceneProps) {
  const initialX = groupXForRace(RACES[0]);

  // The body the face shot aims at, loaded here only to find out where its
  // head is. Same cached asset the model itself renders from, so this is a
  // map lookup rather than a second download, and null until it arrives --
  // or for good, when no model server is configured.
  const focusedBody = useCharacterModel(
    baseClass !== null && sex !== null ? getCharacterModelUrl({ race, baseClass, sex }) : undefined
  );

  const focus: CameraFocus = useMemo(() => {
    const groupX = groupXForRace(race);
    const group = RACE_GALLERY.find((candidate) => candidate.race === race);
    if (!group || baseClass === null) {
      return { position: [groupX, GROUP_SHOT.height, GROUP_SHOT.distance], lookAt: [groupX, GROUP_SHOT.lookHeight, 0] };
    }

    // z carried through, not just x: CLIENT_SLOTS puts some slots (every
    // race's index 3 among them) well off z=0 -- up to 1.43 -- and FACE_SHOT's
    // distance is only ~0.47, so a shot that assumed z=0 for everyone was
    // landing the camera behind where that body actually stands, looking
    // through the back of its head rather than at the front of its face.
    const inClass = group.variants
      .map((variant, index) => ({ variant, x: groupX + group.slots[index].x, z: group.slots[index].z }))
      .filter((entry) => entry.variant.baseClass === baseClass);
    // A race whose templates dropped the chosen class out from under the
    // selection: fall back to the group shot rather than aiming at nothing.
    if (inClass.length === 0) {
      return { position: [groupX, GROUP_SHOT.height, GROUP_SHOT.distance], lookAt: [groupX, GROUP_SHOT.lookHeight, 0] };
    }

    if (sex === null) {
      const centre = inClass.reduce((sum, entry) => sum + entry.x, 0) / inClass.length;
      const centreZ = inClass.reduce((sum, entry) => sum + entry.z, 0) / inClass.length;
      return {
        position: [centre, CLASS_SHOT.height, centreZ + CLASS_SHOT.distance],
        lookAt: [centre, CLASS_SHOT.lookHeight, centreZ],
      };
    }

    const chosen = inClass.find((entry) => entry.variant.sex === sex) ?? inClass[0];
    // Bodies differ in height by race and build -- a dwarf's face sits at
    // 1.19 and an orc's at 1.89 -- so the shot is framed off this body's own
    // head rather than one fixed height. The placeholder's proportions stand
    // in until the model has loaded, and for good where there is no model.
    const headHeight = focusedBody
      ? getHeadHeight(focusedBody)
      : PLACEHOLDER_HEAD_HEIGHT * getBodyScale(race, baseClass, chosen.variant.sex).height;
    return {
      position: [chosen.x, headHeight + FACE_SHOT.above, chosen.z + FACE_SHOT.distance],
      lookAt: [chosen.x, headHeight, chosen.z],
    };
  }, [race, baseClass, sex, focusedBody]);

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Canvas
        gl={{ alpha: true, antialias: true }}
        camera={{ position: [initialX, GROUP_SHOT.height, GROUP_SHOT.distance], fov: 45, near: 0.1, far: 150 }}
      >
        <CameraRig focus={focus} cut={race} />

        <fog attach="fog" args={["#8fa8c8", CLIENT_FOG_NEAR, CLIENT_FOG_FAR]} />

        <ambientLight intensity={CLIENT_AMBIENT_INTENSITY} />
        <hemisphereLight args={[FILL_SKY_COLOR, FILL_GROUND_COLOR, FILL_INTENSITY]} />
        <SunLight groupX={groupXForRace(race)} />

        <DaySky size={SKY_SIZE} z={SKY_Z} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(RACES.length - 1) * GROUP_SPACING * 0.5, 0, 0]}>
          <planeGeometry args={[RACES.length * GROUP_SPACING + 200, 200]} />
          <meshStandardMaterial color="#0e0d0c" roughness={1} />
        </mesh>

        {RACE_GALLERY.map((group) => {
          const groupX = groupXForRace(group.race);
          const focused = group.race === race;

          return (
            <group key={group.race}>
              {group.variants.map((variant, variantIndex) => {
                const selected = focused && variant.baseClass === baseClass && variant.sex === sex;
                // Once the shot is a face, the neighbouring body stands close
                // enough to intrude on it. Nothing is lost by dropping it:
                // there is no picking a different one from this distance, and
                // it comes back the moment the choice is widened again.
                if (focused && sex !== null && baseClass !== null && !selected) return null;

                return (
                  <PlayerModel
                    key={`${variant.race}-${variant.baseClass}-${variant.sex}`}
                    x={groupX + group.slots[variantIndex].x}
                    z={group.slots[variantIndex].z}
                    angleToCenter={group.slots[variantIndex].yaw}
                    variant={variant}
                    appearance={focused ? appearance : undefined}
                    selected={selected}
                    onSelect={() => onSelectVariant(variant.race, variant.baseClass, variant.sex)}
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
