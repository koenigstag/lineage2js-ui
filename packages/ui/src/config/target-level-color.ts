// Simplified 3-tier "con color" for a targeted creature's nameplate, based on
// the level difference to your own character -- classic L2 has ~6 finer
// tiers (blue/light-blue/white/yellow/orange/red); this starts with just the
// three the request asked for and can be split further later if wanted.
//
// Thresholds are a starting point, not sourced from a real client table --
// tune freely.
export const TARGET_LEVEL_COLOR_CONFIG = {
  /** targetLevel - myLevel <= this -> weak target. */
  lowDiffThreshold: -9,
  /** targetLevel - myLevel >= this -> dangerous target. */
  highDiffThreshold: 9,
  lowColor: "#5b9bd5",
  normalColor: "#ffffff",
  highColor: "#e05050",
};

/** Con-color for a creature target's name, given your own and the target's level. */
export function getTargetLevelColor(myLevel: number, targetLevel: number): string {
  const { lowDiffThreshold, highDiffThreshold, lowColor, normalColor, highColor } = TARGET_LEVEL_COLOR_CONFIG;
  const diff = targetLevel - myLevel;
  if (diff <= lowDiffThreshold) return lowColor;
  if (diff >= highDiffThreshold) return highColor;
  return normalColor;
}
