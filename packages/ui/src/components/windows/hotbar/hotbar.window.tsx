import { observer } from "mobx-react-lite";
import { Slot, type IconBorder } from "../core/slot.component";
import { useGameStore } from "../../../stores/StoreContext";

const ROW_1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "="];
const ROW_2 = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p", "[", "]"];
const COLUMNS = 12;

const HOTBAR_ROWS: string[][] = [
  ROW_1,
  ROW_2,
  ROW_1.map((key) => `K${key}`),
  ROW_2.map((key) => `K${key}`),
];

const HOTBAR_ICON_BORDER: IconBorder = { from: "#a9af7f", to: "#6f5c31" };

export const HotbarContent = observer(function HotbarContent() {
  const game = useGameStore();

  return (
    <div style={{ display: "flex", flexDirection: "column-reverse", gap: 2 }}>
      {HOTBAR_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} style={{ display: "flex", gap: 2 }}>
          {row.map((slotKey, columnIndex) => {
            const type = game.hotbarSlots[rowIndex * COLUMNS + columnIndex];
            return (
              <Slot
                key={slotKey}
                type="hotbar"
                slotKey={slotKey}
                content={type ? { type } : undefined}
                iconBorder={HOTBAR_ICON_BORDER}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
});
