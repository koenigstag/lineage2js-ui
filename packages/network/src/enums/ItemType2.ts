// Wire "Type 2" field from ItemList/InventoryUpdate's readItem() -- the
// server's broad item classification, distinct from the local ItemType enum.
export enum ItemType2 {
  Weapon = 0,
  ShieldArmor = 1,
  RingEarringNecklace = 2,
  QuestItem = 3,
  Adena = 4,
  Item = 5,
}
