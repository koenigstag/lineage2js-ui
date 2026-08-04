import { CharacterModel } from "./character-model.component";
import { getPlayerVisualFromVariant, type PlayerVariant } from "../../../config/character-races";

interface PlayerModelProps {
  variant: PlayerVariant;
  x: number;
  y?: number;
  z: number;
  angleToCenter: number;
  nickname?: string;
  selected?: boolean;
  onSelect?: () => void;
}

/** Player variant (race/baseClass/sex) -> visual, rendered via CharacterModel. Used by char-select/char-create directly, and by CreatureModel's player branch. */
export function PlayerModel({ variant, nickname, selected, onSelect, ...position }: PlayerModelProps) {
  const visual = getPlayerVisualFromVariant(variant);
  return <CharacterModel {...position} {...visual} nickname={nickname} selected={selected} onSelect={onSelect} />;
}
