import L2Item from "../../../entities/L2Item";
import L2Shortcut from "../../../entities/L2Shortcut";
import { ItemType2 } from "../../../enums/ItemType2";
import { ShortcutType } from "../../../enums/ShortcutType";
import ReceivablePacket from "../../../mmocore/ReceivablePacket";

export default abstract class GameClientPacket extends ReceivablePacket {
  // @Override
  read(): boolean {
    try {
      return this.readImpl();
    } catch (err) {
      this.logger.error(err);
      return false;
    }
  }

  readItem(): L2Item {
    const item = new L2Item();
    item.ObjectId = this.readD();
    item.Id = this.readD();
    item.LocationSlot = this.readD(); // T1 (legacy type1 slot ordering)
    item.Count = this.readQ();
    item.Type2 = this.readH(); // Item Type 2 : 00-weapon, 01-shield/armor, 02-ring/earring/necklace, 03-questitem, 04-adena, 05-item
    const _customType = this.readH();
    item.IsEquipped = this.readH() === 1;
    item.BodyPart = this.readD(); // Slot : 0006-lr.ear, 0008-neck, 0030-lr.finger, 0040-head, 0100-l.hand, 0200-gloves, 0400-chest, 0800-pants, 1000-feet, 4000-r.hand, 8000-r.hand
    item.EnchantLevel = this.readH();
    const _customType2 = this.readH();
    item.AugmentBonus = this.readD();
    item.Mana = this.readD();
    item.Time = this.readD();

    // Item elemental and enchant
    item.AttackElementType = this.readH();
    item.AttackElementVal = this.readH();

    item.DefAttFire = this.readH();
    item.DefAttWater = this.readH();
    item.DefAttWind = this.readH();
    item.DefAttEarth = this.readH();
    item.DefAttHolly = this.readH();
    item.DefAttUnholly = this.readH();

    const _enchantOption1 = this.readH();
    const _enchantOption2 = this.readH();
    const _enchantOption3 = this.readH();

    item.IsQuest = item.Type2 === ItemType2.QuestItem;

    return item;
  }

  // Shared by ShortCutInit (full list) and ShortCutRegister (single upsert) --
  // verified against lineage2ts's ShortCutInit/ShortCutRegister send packets
  // (opcodes 0x45/0x44), which share this exact per-entry layout.
  readShortcut(): L2Shortcut {
    const shortcut = new L2Shortcut();
    shortcut.Type = this.readD();
    shortcut.Slot = this.readD(); // slot + (page * 12)

    switch (shortcut.Type) {
      case ShortcutType.ITEM:
        shortcut.TargetId = this.readD();
        shortcut.CharacterType = this.readD();
        shortcut.ItemReuseGroup = this.readD();
        this.readD(); // always 0x00 on the wire
        shortcut.ItemReuseRemaining = this.readD(); // seconds, 0 when not on cooldown
        shortcut.ItemReuseTotal = this.readD(); // seconds
        break;
      case ShortcutType.SKILL:
        shortcut.TargetId = this.readD();
        shortcut.Level = this.readD();
        this.readC(); // always 0x00 on the wire
        shortcut.CharacterType = this.readD();
        break;
      case ShortcutType.ACTION:
      case ShortcutType.MACRO:
      case ShortcutType.RECIPE:
      case ShortcutType.BOOKMARK:
        shortcut.TargetId = this.readD();
        shortcut.CharacterType = this.readD();
        break;
    }

    return shortcut;
  }

  abstract readImpl(): boolean;
}
