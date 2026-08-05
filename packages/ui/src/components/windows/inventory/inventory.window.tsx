import { useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { ShortcutType, ItemType2, type L2Item } from "@lineage2js/network";
import { Slot, type IconBorder } from "../core/slot.component";
import { ItemSlot } from "../core/item-slot.component";
import { DnDButton } from "../core/dnd-button.component";
import { setHotbarDragPayload, type HotbarDragPayload } from "../core/dnd";
import { BaseInput } from "../../core/inputs/base.input";
import { LabeledBar } from "../../core/stat-bar.component";
import { Tooltip, useTooltipTarget } from "../../core/tooltip.component";
import { useConfirmation } from "../../core/confirmation-modal";
import { Paperdoll } from "./paperdoll.component";
import { useGameStore, useSessionStore } from "../../../stores/StoreContext";
import { SP_COLOR, WG_COLOR } from "../../../config/stat-colors";
import {
  EQUIPMENT_SLOT_TYPES,
  getItemSlotType,
  getItemGradeLabel,
  getItemName,
  getMiscItemCategory,
} from "../../../config/item-mapping";
import { t } from "../../../lang/lang";

const TABS = ["All", "Equip", "Consume", "Craft", "Etc", "Quest"] as const;
type Tab = (typeof TABS)[number];

function matchesTab(item: L2Item, tab: Tab): boolean {
  const slotType = getItemSlotType(item);
  switch (tab) {
    case "All":
      return true;
    case "Equip":
      return EQUIPMENT_SLOT_TYPES.has(slotType);
    case "Consume":
      return getMiscItemCategory(item) === "consume";
    case "Craft":
      return getMiscItemCategory(item) === "ingredient";
    case "Etc":
      return slotType === "item-misc" && !item.IsQuest && getMiscItemCategory(item) === undefined;
    case "Quest":
      return item.IsQuest === true;
  }
}

const GRID_COLUMNS = 10;
const GRID_ROWS = 20;
const VISIBLE_ROWS = 10;
const SLOT_SIZE = 34;
const SLOT_GAP = 2;

// const INVENTORY_ICON_BORDER: IconBorder = { from: "#2a170c", to: "#2a170c" };

// Adena/Weight bars sit together in one 150px-wide block, wrapped together
// with the delete slot into one flex item so the outer row's space-between
// only spreads two things apart: the sell block and this bars+delete group.
const BARS_BLOCK_WIDTH = 150;
const BARS_BLOCK_LABEL_WIDTH = 20; // LabeledBar's own default, spelled out here so the bar-width math below is self-explanatory
const BARS_BLOCK_GAP = 8; // LabeledBar's own fixed label/bar gap
const BARS_BLOCK_BAR_WIDTH = BARS_BLOCK_WIDTH - BARS_BLOCK_LABEL_WIDTH - BARS_BLOCK_GAP;
const BUTTON_SIZE = 32;
const SELL_COLOR = "#3a4a2e";
const DELETE_COLOR = "#4a2e2e";

/** Weight bar with a hover tooltip showing the raw load/maxLoad -- the bar itself only has room for the percentage. */
function WeightBar({ load, maxLoad }: { load: number; maxLoad: number }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { target, showTooltip, hideTooltip } = useTooltipTarget();
  const percent = maxLoad > 0 ? (load / maxLoad) * 100 : 0;

  return (
    <div
      ref={rootRef}
      onMouseEnter={() => rootRef.current && showTooltip(rootRef.current, { kind: "simple", name: `${load}/${maxLoad}` })}
      onMouseLeave={hideTooltip}
    >
      <LabeledBar
        label={t("charInfo.wg")}
        percent={percent}
        text={`${percent.toFixed(0)}%`}
        color={WG_COLOR}
        width={BARS_BLOCK_BAR_WIDTH}
      />
      <Tooltip target={target} />
    </div>
  );
}

export const InventoryContent = observer(function InventoryContent() {
  const game = useGameStore();
  const session = useSessionStore();
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");
  const { confirm, modal } = useConfirmation();

  const adenaCount = game.inventoryItems.find((item) => item.Type2 === ItemType2.Adena)?.Count ?? 0;

  const query = search.trim().toLowerCase();
  const filteredItems = game.inventoryItems.filter(
    (item) => matchesTab(item, activeTab) && (query === "" || getItemName(item).toLowerCase().includes(query))
  );

  function resolveDroppedItem(payload: HotbarDragPayload): L2Item | undefined {
    if (payload.shortcutType !== ShortcutType.ITEM) return undefined;
    return game.inventoryItems.find((item) => item.ObjectId === payload.targetId);
  }

  // Double-click toggles equip/unequip via UseItem (opcode 0x19, retail's
  // own mechanism -- there's no separate RequestEquipItem, see
  // ClientCommands.ts's useItem() comment). Server decides based on the
  // item's current isEquipped(), so this same call works whether the item
  // is worn or not -- only gated to equipable slot types here so
  // double-clicking a potion in the grid doesn't accidentally consume it
  // (that's a different, not-yet-built "use consumable" feature).
  function handleItemDoubleClick(item: L2Item) {
    if (!EQUIPMENT_SLOT_TYPES.has(getItemSlotType(item))) return;
    session.client.useItem(item);
  }

  // No RequestSellItem is sent yet -- it needs a live NPC shop session
  // (listId) this client has no shop window/state for. Confirming just
  // closes the modal for now; wiring the real sell packet is future work
  // once a shop UI exists.
  async function handleSellDrop(payload: HotbarDragPayload) {
    const item = resolveDroppedItem(payload);
    if (!item) return;
    await confirm(t("inventory.sellConfirm", { name: getItemName(item) }));
  }

  // RequestDestroyItem (opcode 0x60) -- confirmed against lineage2ts as a
  // genuinely separate action/packet from dropItem (ground) and sellItem
  // (needs an NPC shop session), see CommandDestroyItem.ts. No IsConnected
  // guard needed here -- every client.xxx() command (including this one)
  // goes through ClientCommands' Proxy dispatcher, which already skips
  // execute() entirely while disconnected (AbstractGameCommand.requiresGameConnection).
  async function handleDeleteDrop(payload: HotbarDragPayload) {
    const item = resolveDroppedItem(payload);
    if (!item) return;
    if (!(await confirm(t("inventory.deleteConfirm", { name: getItemName(item) })))) return;
    session.client.destroyItem(item.ObjectId, item.Count);
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Paperdoll />
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end" }}>
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? "#222020" : "#161513",
                color: "#e6d9be",
                border: `1px solid ${activeTab === tab ? "#a89c83" : "#76654f"}`,
                borderBottom: "none",
                borderRadius: "4px 4px 0 0",
                padding: "2px 6px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              {t(`inventory.tabs.${tab}`)}
            </button>
          ))}
          <div style={{ width: 90 }}>
            <BaseInput
              value={search}
              placeholder={t("inventory.searchPlaceholder")}
              onChange={setSearch}
              style={{ padding: "2px 8px" }}
            />
          </div>
        </div>
        <div style={{ border: "1px solid #76654f", borderRadius: 6, padding: 5 }}>
        <div
          className="slot-grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${SLOT_SIZE}px)`,
            gridAutoRows: SLOT_SIZE,
            gap: SLOT_GAP,
            maxHeight: SLOT_SIZE * VISIBLE_ROWS + SLOT_GAP * (VISIBLE_ROWS - 1),
            overflowY: "scroll",
            overflowX: "hidden",
          }}
        >
          {Array.from({ length: GRID_COLUMNS * GRID_ROWS }).map((_, index) => {
            const item = filteredItems[index];
            if (!item) {
              return <Slot key={`empty-${index}`} type="inventory" />;
            }
            return (
              <div
                key={`item-${item.ObjectId}`}
                draggable
                onDragStart={(e) => setHotbarDragPayload(e, ShortcutType.ITEM, item.ObjectId)}
                onDoubleClick={() => handleItemDoubleClick(item)}
              >
                <ItemSlot
                  id={item.Id}
                  slotType={getItemSlotType(item)}
                  count={item.Count}
                  grade={getItemGradeLabel(item)}
                  isEquipped={item.IsEquipped}
                  detail="full"
                  // iconBorder={INVENTORY_ICON_BORDER}
                />
              </div>
            );
          })}
        </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
          <div style={{ display: "flex", gap: 5 }}>
            <DnDButton
              icon="$"
              color={SELL_COLOR}
              size={BUTTON_SIZE}
              title={t("inventory.sellButtonTitle")}
              onDropItem={handleSellDrop}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, width: BARS_BLOCK_WIDTH }}>
              <LabeledBar label={t("inventory.adenaLabel")} percent={100} text={`${adenaCount}`} color={SP_COLOR} width={BARS_BLOCK_BAR_WIDTH} />
              <WeightBar load={game.charInfo.load} maxLoad={game.charInfo.maxLoad} />
            </div>
            <div style={{ display: "flex", gap: 5 }}>
              <DnDButton
                icon="X"
                color={DELETE_COLOR}
                size={BUTTON_SIZE}
                title={t("inventory.deleteButtonTitle")}
                onDropItem={handleDeleteDrop}
              />
            </div>
          </div>
        </div>
      </div>
      {modal}
    </div>
  );
});
