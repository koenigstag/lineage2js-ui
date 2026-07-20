import { useState } from "react";
import { observer } from "mobx-react-lite";
import { Slot, type IconBorder } from "../core/slot.component";
import { BaseInput } from "../../core/inputs/base.input";
import { Paperdoll } from "./paperdoll.component";
import { useGameStore } from "../../../stores/StoreContext";
import type { InventoryItem } from "../../../stores/GameStore";

const TABS = ["All", "Equip", "Consume", "Craft", "Etc", "Quest"] as const;
type Tab = (typeof TABS)[number];

const EQUIP_TYPES = new Set(["item-weapon", "item-shield", "item-armor", "item-jewelry"]);

function matchesTab(item: InventoryItem, tab: Tab): boolean {
  switch (tab) {
    case "All":
      return true;
    case "Equip":
      return EQUIP_TYPES.has(item.type);
    case "Consume":
      return item.type === "item-misc" && item.consume === true;
    case "Craft":
      return item.type === "item-misc" && item.ingredient === true;
    case "Etc":
      return item.type === "item-misc" && !item.consume && !item.ingredient && !item.quest;
    case "Quest":
      return item.quest === true;
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
    (item) => matchesTab(item, activeTab) && (query === "" || item.name.toLowerCase().includes(query))
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
              {tab}
            </button>
          ))}
          <div style={{ width: 90 }}>
            <BaseInput value={search} placeholder="Search" onChange={setSearch} style={{ padding: "2px 8px" }} />
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
            return (
              <Slot
                key={item ? `item-${item.id}` : `empty-${index}`}
                type="inventory"
                content={item ? { type: item.type, data: item, count: item.count } : undefined}
                // iconBorder={INVENTORY_ICON_BORDER}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});
