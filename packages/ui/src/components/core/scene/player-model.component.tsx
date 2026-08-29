import { CharacterBody } from "./character-body.component";
import type { CharacterAnimation } from "./gltf-character-model.component";
import { getCharacterModelUrl } from "../../../config/character-models";
import { getPlayerVisualFromVariant, type PlayerVariant } from "../../../config/character-races";
import type { CharacterAppearance } from "../../../config/character-appearance";

interface PlayerModelProps {
  variant: PlayerVariant;
  /**
   * Face/hair/hair-colour choices, when the caller has them. Face and hair
   * colour are texture swaps in the client, so both reach the body through
   * applyCharacterTextures; left undefined the body wears the first of each.
   */
  appearance?: CharacterAppearance;
  x: number;
  y?: number;
  z: number;
  angleToCenter: number;
  animation?: CharacterAnimation;
  /** When the gesture being animated last started, so a repeat replays it -- see GltfCharacterModel. */
  animationStartedAt?: number;
  /** World units/second while moving, so the walk/run cycle keeps pace. */
  speed?: number;
  nickname?: string;
  selected?: boolean;
  onSelect?: () => void;
  isDead?: boolean;
}

/** Player variant (race/baseClass/sex) -> that race's converted body, or the placeholder when no model server is configured. Used by char-select/char-create directly, and by CreatureModel's player branch. */
export function PlayerModel({
  variant,
  appearance,
  nickname,
  selected,
  onSelect,
  isDead,
  animation,
  animationStartedAt,
  speed,
  ...position
}: PlayerModelProps) {
  const visual = getPlayerVisualFromVariant(variant);
  return (
    <CharacterBody
      {...position}
      {...visual}
      modelUrl={getCharacterModelUrl(variant)}
      appearance={appearance}
      animation={animation}
      animationStartedAt={animationStartedAt}
      speed={speed}
      nickname={nickname}
      selected={selected}
      onSelect={onSelect}
      isDead={isDead}
    />
  );
}
