import { SkeletonModel } from "./skeleton-model.component";
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
  isDead?: boolean;
}

/** Player variant (race/baseClass/sex) -> visual, rendered via SkeletonModel. Used by char-select/char-create directly, and by CreatureModel's player branch. */
export function PlayerModel({ variant, nickname, selected, onSelect, isDead, ...position }: PlayerModelProps) {
  const visual = getPlayerVisualFromVariant(variant);
  return <SkeletonModel {...position} {...visual} nickname={nickname} selected={selected} onSelect={onSelect} isDead={isDead} />;
}
