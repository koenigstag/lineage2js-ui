import { CharacterBody } from "./character-body.component";
import type { CharacterAnimation } from "./gltf-character-model.component";
import { getCharacterModelUrl } from "../../../config/character-models";
import { getPlayerVisualFromVariant, type PlayerVariant } from "../../../config/character-races";
import { getHairColor, type CharacterAppearance } from "../../../config/character-appearance";

interface PlayerModelProps {
  variant: PlayerVariant;
  /**
   * Face/hair/hair-colour choices, when the caller has them. Only the colour
   * reaches the body today: retail varies face and hair style by swapping the
   * texture on one head mesh, and the converted rigs carry no textures yet
   * (see assets-server/scripts/convert-client-rigs.ts). Left undefined --
   * which is every caller working from a character list, since the packet
   * carries the indices but nothing renders them -- the body keeps the
   * default tone.
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

/** Player variant (race/baseClass/sex) -> that race's converted body, or the placeholder for the races without one. Used by char-select/char-create directly, and by CreatureModel's player branch. */
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
      hairColor={appearance && getHairColor(appearance.hairColor)}
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
