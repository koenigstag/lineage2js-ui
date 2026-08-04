import { observer } from "mobx-react-lite";
import { Slot } from "../core/slot.component";
import { ItemSlot } from "../core/item-slot.component";
import { useGameStore } from "../../../stores/StoreContext";
import { getItemSlotType, getItemGradeLabel } from "../../../config/item-mapping";
import { PAPERDOLL_SECTIONS, getEquippedItemsBySlot } from "../../../config/paperdoll-mapping";

const SLOT_SIZE = 34;
const COLUMN_GAP = 10;
const ROW_GAP = 20;
const SECTION_GAP = 20;
const PADDING = 20;

export const Paperdoll = observer(function Paperdoll() {
  const game = useGameStore();
  const equippedBySlot = getEquippedItemsBySlot(game.inventoryItems);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SECTION_GAP, flexShrink: 0, padding: PADDING }}>
      {PAPERDOLL_SECTIONS.map(({ rows, slotSize = SLOT_SIZE, columnGap = COLUMN_GAP, center }, sectionIndex) => (
        <div
          key={sectionIndex}
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${rows[0].length}, ${slotSize}px)`,
            columnGap,
            rowGap: ROW_GAP,
            justifyContent: center ? "center" : undefined,
          }}
        >
          {rows.flatMap((row, rowIndex) =>
            row.map((slotKey, colIndex) => {
              if (!slotKey) {
                return <div key={`empty-${rowIndex}-${colIndex}`} style={{ width: slotSize, height: slotSize }} />;
              }

              const item = equippedBySlot[slotKey];
              if (!item) {
                return <Slot key={slotKey} type="inventory" size={slotSize} />;
              }

              return (
                <ItemSlot
                  key={slotKey}
                  id={item.Id}
                  slotType={getItemSlotType(item)}
                  grade={getItemGradeLabel(item)}
                  isEquipped
                  detail="full"
                  size={slotSize}
                />
              );
            })
          )}
        </div>
      ))}
    </div>
  );
});
