/**
 * L2 heading (0..65535, 65536 per full turn) pointing from (fromX, fromY)
 * toward (toX, toY) -- shared by L2Creature.setMovingTo (a mover's heading
 * derived from its own move segment) and AttackMutator (an attacker's
 * heading derived from the Attack packet's own attacker/target positions,
 * since the protocol carries no explicit heading field for it -- confirmed
 * against lineage2ts's AttackBuilder.ts). 182.044444444 = 65536 / 360, the
 * standard L2 heading-units-per-degree conversion.
 */
export function headingBetween(fromX: number, fromY: number, toX: number, toY: number): number {
  let angleTarget = Math.atan2(toY - fromY, toX - fromX) * (180 / Math.PI);
  if (angleTarget < 0) {
    angleTarget = 360 + angleTarget;
  }
  return Math.floor(angleTarget * 182.044444444);
}
