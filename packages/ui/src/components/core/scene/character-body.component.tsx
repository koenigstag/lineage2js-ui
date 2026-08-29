import { CharacterModel, DEFAULT_SKIN_COLOR } from "./character-model.component";
import { GltfCharacterModel, type CharacterAnimation } from "./gltf-character-model.component";
import { useCharacterModel } from "../../../utils/models/character-model";
import { DEFAULT_APPEARANCE, getHairColor, type CharacterAppearance } from "../../../config/character-appearance";

/**
 * The Kamael wing -- singular, and the one body part no choice of the
 * character's own governs.
 *
 * @deprecated Invented placeholder tone, like the rest of the flat tints --
 * the converted bodies carry no textures yet. Light grey with a touch of
 * pink, which is what the wing reads as in the client.
 */
const WING_COLOR = "#d6c8ca";

export interface CharacterBodyProps {
  /**
   * Converted retail body to render, from config/character-models.ts.
   * Undefined -- or a URL that doesn't load -- falls back to the placeholder
   * body, which is also all a mob, a summon or an unconfigured model server
   * ever gets.
   */
  modelUrl?: string;
  animation?: CharacterAnimation;
  /** When the gesture being animated last started, so a repeat replays it -- see GltfCharacterModel. */
  animationStartedAt?: number;
  /** World units/second while moving, so the walk/run cycle keeps pace. */
  speed?: number;
  x: number;
  /** World-up (three.js Y) foot position. Defaults to 0 (flat-floor scenes). */
  y?: number;
  z: number;
  angleToCenter: number;
  color: string;
  skinColor?: string;
  /** Placeholder-body proportions; the converted bodies carry their own. Defaults to 1. */
  heightScale?: number;
  /** Placeholder-body proportions; the converted bodies carry their own. Defaults to 1. */
  widthScale?: number;
  /** Draped cloak hanging from the shoulder (Kamael, which has no converted body). Defaults to false. */
  hasCape?: boolean;
  /**
   * Face/hair/hair-colour choices. Drives which textures the body wears, and
   * the hair tint underneath them; the placeholder body ignores it entirely.
   */
  appearance?: CharacterAppearance;
  nickname?: string;
  selected?: boolean;
  onSelect?: () => void;
  /** CSS cursor shown while hovering the model, e.g. "crosshair" for an attackable mob. Unset leaves the browser default. */
  cursor?: string;
  isDead?: boolean;
}

/**
 * One creature body: the converted retail model when there is one and it has
 * loaded, and the procedural placeholder otherwise.
 *
 * The fallback isn't only for missing files -- mobs and summons aren't
 * humanoid, an NPC of no particular race has no body to borrow, and no model
 * server is configured by default -- so the placeholder stays a first-class
 * path rather than a broken-image state, and the real body simply swaps in
 * once it arrives.
 */
export function CharacterBody({ modelUrl, animation, animationStartedAt, speed, isDead, ...body }: CharacterBodyProps) {
  const asset = useCharacterModel(modelUrl);
  const appearance = body.appearance ?? DEFAULT_APPEARANCE;
  // The rig a body's textures are filed under is the name of the file it came
  // from -- morc.glb is textured out of textures/morc/.
  const rig = modelUrl?.split("/").pop()?.replace(/.glb$/i, "");

  if (!asset) {
    return <CharacterModel {...body} isDead={isDead} />;
  }

  return (
    <GltfCharacterModel
      asset={asset}
      skinColor={body.skinColor ?? DEFAULT_SKIN_COLOR}
      outfitColor={body.color}
      hairColor={getHairColor(appearance.hairColor)}
      wingColor={WING_COLOR}
      rig={rig}
      appearance={appearance}
      x={body.x}
      y={body.y}
      z={body.z}
      angleToCenter={body.angleToCenter}
      animation={isDead ? "death" : animation}
      animationStartedAt={animationStartedAt}
      speed={speed}
      nickname={body.nickname}
      selected={body.selected}
      onSelect={body.onSelect}
      cursor={body.cursor}
    />
  );
}
