import { CharacterModel, DEFAULT_SKIN_COLOR } from "./character-model.component";
import { GltfCharacterModel, type CharacterAnimation } from "./gltf-character-model.component";
import { useCharacterModel } from "../../../utils/models/character-model";

export interface CharacterBodyProps {
  /**
   * Converted retail body to render, from config/character-models.ts.
   * Undefined -- or a URL that doesn't load -- falls back to the placeholder
   * body, which is also all orcs, Kamael, and non-humanoid creatures ever get.
   */
  modelUrl?: string;
  animation?: CharacterAnimation;
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
  nickname?: string;
  selected?: boolean;
  onSelect?: () => void;
  /** CSS cursor shown while hovering the model, e.g. "crosshair" for an attackable mob. Unset leaves the browser default. */
  cursor?: string;
  isDead?: boolean;
}

/**
 * @deprecated Invented placeholder tone, not ported from any real art source
 * -- the converted bodies have no textures yet, so hair is tinted flat like
 * skin and outfit are (see character-races.ts's own colour tables).
 */
const HAIR_COLOR = "#3a2a20";

/**
 * One creature body: the converted retail model when there is one and it has
 * loaded, and the procedural placeholder otherwise.
 *
 * The fallback isn't only for missing files -- orcs and Kamael have no model
 * in the source project at all, mobs and summons aren't humanoid, and no model
 * server is configured by default -- so the placeholder stays a first-class
 * path rather than a broken-image state, and the real body simply swaps in
 * once it arrives.
 */
export function CharacterBody({ modelUrl, animation, speed, isDead, ...body }: CharacterBodyProps) {
  const asset = useCharacterModel(modelUrl);

  if (!asset) {
    return <CharacterModel {...body} isDead={isDead} />;
  }

  return (
    <GltfCharacterModel
      asset={asset}
      skinColor={body.skinColor ?? DEFAULT_SKIN_COLOR}
      outfitColor={body.color}
      hairColor={HAIR_COLOR}
      x={body.x}
      y={body.y}
      z={body.z}
      angleToCenter={body.angleToCenter}
      animation={isDead ? "death" : animation}
      speed={speed}
      nickname={body.nickname}
      selected={body.selected}
      onSelect={body.onSelect}
      cursor={body.cursor}
    />
  );
}
