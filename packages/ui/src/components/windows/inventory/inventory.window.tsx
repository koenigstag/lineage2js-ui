import { useState } from "react";
import { Slot } from "../core/slot.component";
import { BaseInput } from "../../core/inputs/base.input";
import { Paperdoll } from "./paperdoll.component";

const TABS = ["All", "Equip", "Consume", "Craft", "Etc", "Quest"] as const;
const GRID_COLUMNS = 10;
const GRID_ROWS = 10;
const VISIBLE_ROWS = 8;
const SLOT_SIZE = 34;
const SLOT_GAP = 2;

export function InventoryContent() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("All");
  const [search, setSearch] = useState("");

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
          }}
        >
          {Array.from({ length: GRID_COLUMNS * GRID_ROWS }).map((_, index) => (
            <Slot key={index} type="inventory" />
          ))}
        </div>
      </div>
    </div>
  );
}
