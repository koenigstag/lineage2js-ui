import { CharacterBody } from "./character-body.component";
import type { CharacterAnimation } from "./gltf-character-model.component";
import { getCharacterModelUrl } from "../../../config/character-models";
import { getPlayerVisualFromVariant, type PlayerVariant } from "../../../config/character-races";

interface PlayerModelProps {
  variant: PlayerVariant;
  x: number;
  y?: number;
  z: number;
  angleToCenter: number;
  animation?: CharacterAnimation;
  /** World units/second while moving, so the walk/run cycle keeps pace. */
  speed?: number;
  nickname?: string;
  selected?: boolean;
  onSelect?: () => void;
  isDead?: boolean;
}

/** Player variant (race/baseClass/sex) -> that race's converted body, or the placeholder for the races without one. Used by char-select/char-create directly, and by CreatureModel's player branch. */
export function PlayerModel({ variant, nickname, selected, onSelect, isDead, animation, speed, ...position }: PlayerModelProps) {
  const visual = getPlayerVisualFromVariant(variant);
  return (
    <CharacterBody
      {...position}
      {...visual}
      modelUrl={getCharacterModelUrl(variant)}
      animation={animation}
      speed={speed}
      nickname={nickname}
      selected={selected}
      onSelect={onSelect}
      isDead={isDead}
    />
  );
}
