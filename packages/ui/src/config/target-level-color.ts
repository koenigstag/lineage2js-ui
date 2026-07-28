// "Con color" for a targeted creature's nameplate, based on the level
// difference to your own character -- the classic L2 blue/light-blue/white/
// yellow/orange/red 6-tier scheme (from deep-blue "trivial" up to red
// "extremely dangerous"). Ordered by ascending maxDiff -- the first tier
// whose maxDiff the actual diff doesn't exceed wins.
//
// Thresholds are a reasonable approximation, not pulled from a verified
// client table -- tune freely per tier.
export interface TargetLevelColorTier {
  /** targetLevel - myLevel at or below this value uses this tier's color. */
  maxDiff: number;
  color: string;
}

export const TARGET_LEVEL_COLOR_TIERS: TargetLevelColorTier[] = [
  { maxDiff: -9, color: "#3a6ea8" }, // deep blue -- far weaker, trivial
  { maxDiff: -3, color: "#6fa8dc" }, // blue -- weaker
  { maxDiff: 2, color: "#ffffff" }, // white -- even challenge
  { maxDiff: 5, color: "#f5d76e" }, // yellow -- harder
  { maxDiff: 8, color: "#e08a3c" }, // orange -- dangerous
  { maxDiff: Infinity, color: "#e05050" }, // red -- extremely dangerous
];

/** Con-color for a creature target's name, given your own and the target's level. */
export function getTargetLevelColor(myLevel: number, targetLevel: number): string {
  const diff = targetLevel - myLevel;
  const tier = TARGET_LEVEL_COLOR_TIERS.find((t) => diff <= t.maxDiff);
  return (tier ?? TARGET_LEVEL_COLOR_TIERS[TARGET_LEVEL_COLOR_TIERS.length - 1]).color;
}
