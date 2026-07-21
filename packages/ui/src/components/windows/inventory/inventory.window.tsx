import { useState } from "react";
import { observer } from "mobx-react-lite";
import type { L2Item } from "@lineage2js/network";
import { Slot, type IconBorder } from "../core/slot.component";
import { BaseInput } from "../../core/inputs/base.input";
import { Paperdoll } from "./paperdoll.component";
import { useGameStore } from "../../../stores/StoreContext";
import { getItemIconUrl } from "../../../config/icon-urls";
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
const GRID_ROWS = 10;
const VISIBLE_ROWS = 8;
const SLOT_SIZE = 34;
const SLOT_GAP = 2;

// const INVENTORY_ICON_BORDER: IconBorder = { from: "#2a170c", to: "#2a170c" };

export const InventoryContent = observer(function InventoryContent() {
  const game = useGameStore();
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filteredItems = game.inventoryItems.filter(
    (item) => matchesTab(item, activeTab) && (query === "" || getItemName(item).toLowerCase().includes(query))
  );

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
        <div
          className="slot-grid"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${GRID_COLUMNS}, ${SLOT_SIZE}px)`,
            gridAutoRows: SLOT_SIZE,
            gap: SLOT_GAP,
            maxHeight: SLOT_SIZE * VISIBLE_ROWS + SLOT_GAP * (VISIBLE_ROWS - 1),
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {Array.from({ length: GRID_COLUMNS * GRID_ROWS }).map((_, index) => {
            const item = filteredItems[index];
            const slotType = item ? getItemSlotType(item) : undefined;
            return (
              <Slot
                key={item ? `item-${item.ObjectId}` : `empty-${index}`}
                type="inventory"
                content={
                  item && slotType
                    ? {
                        type: slotType,
                        data: item,
                        count: item.Count,
                        iconUrl: getItemIconUrl(item.Id),
                        tooltip: {
                          kind: "item",
                          name: getItemName(item),
                          type: slotType,
                          id: item.Id,
                          count: item.Count,
                          grade: getItemGradeLabel(item),
                          isEquipped: item.IsEquipped,
                        },
                      }
                    : undefined
                }
                // iconBorder={INVENTORY_ICON_BORDER}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});
