import { rootStore } from "../stores/RootStore";

/**
 * The weapon classes the converted rigs actually ship a swing for. Retail
 * names the sequences Atk01_{Hand,1HS,2HS,Bow,Dual,Dual_Dagger,Pole} and
 * nothing else -- that list is the whole vocabulary here.
 */
export type WeaponClass = "hand" | "1hs" | "dual" | "dualDagger" | "bow" | "pole";

/**
 * Datapack weaponType (see DatapackStore's item-stats table) -> the swing to
 * play with it. Anything absent falls back to the unarmed one.
 *
 * Three real weapon types are deliberately absent rather than approximated.
 * Crossbows, rapiers and ancient swords are Kamael-era, and their motion
 * lives with the Kamael body, which this project has no model for at all --
 * checked rig by rig: none of the ten ships a crossbow or rapier sequence
 * under any name. Sending a crossbow user through the bow swing (or a rapier
 * through the one-handed one) would be a guess that looks wrong, so they
 * swing empty-handed until there is a body that knows those motions.
 *
 * Two-handed is missing for a different reason: the rigs do have Atk01_2HS,
 * but the item table carries no one- vs two-handed flag -- a greatsword and
 * a shortsword are both "sword" -- so there is nothing to select it with
 * yet. Adding a bodypart column to the item-stats generator is what unlocks
 * it.
 *
 * Fist weapons map to the unarmed swing on purpose: that motion *is* the
 * hand-to-hand one.
 */
const WEAPON_CLASS_BY_TYPE: Record<string, WeaponClass> = {
  sword: "1hs",
  blunt: "1hs",
  dagger: "1hs",
  dual: "dual",
  dualdagger: "dualDagger",
  dualfist: "hand",
  fist: "hand",
  bow: "bow",
  pole: "pole",
};

/**
 * Swing class for whatever a creature is holding in its right hand. Reads
 * through the datapack rather than the wire: the protocol only ever sends
 * the item id (CharInfo/UserInfo for players, NpcInfo for everyone else),
 * and what kind of weapon that id is comes from the item-stats table.
 *
 * Reactive on that table the same way getNpcLevel is -- it loads
 * asynchronously, so an early call returns "hand" and the next render picks
 * up the real answer.
 */
export function getWeaponClass(itemId: number | undefined): WeaponClass {
  if (!itemId) {
    return "hand";
  }
  const weaponType = rootStore.datapack.itemStats[itemId]?.weaponType;
  return (weaponType && WEAPON_CLASS_BY_TYPE[weaponType]) || "hand";
}
