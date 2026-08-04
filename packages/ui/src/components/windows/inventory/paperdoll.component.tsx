import { observer } from "mobx-react-lite";
import { Slot } from "../core/slot.component";
import { ItemSlot } from "../core/item-slot.component";
import { useGameStore } from "../../../stores/StoreContext";
import { getItemSlotType, getItemGradeLabel } from "../../../config/item-mapping";
import { PAPERDOLL_LAYOUT, getEquippedItemsBySlot } from "../../../config/paperdoll-mapping";

const SLOT_SIZE = 34;
const COLUMN_GAP = 5;
const ROW_GAP = 10;

export const Paperdoll = observer(function Paperdoll() {
  const game = useGameStore();
  const equippedBySlot = getEquippedItemsBySlot(game.inventoryItems);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(3, ${SLOT_SIZE}px)`,
        columnGap: COLUMN_GAP,
        rowGap: ROW_GAP,
        flexShrink: 0,
        alignContent: "flex-start",
      }}
    >
      {PAPERDOLL_LAYOUT.flatMap((row, rowIndex) =>
        row.map((slotKey, colIndex) => {
          if (!slotKey) {
            return <div key={`empty-${rowIndex}-${colIndex}`} style={{ width: SLOT_SIZE, height: SLOT_SIZE }} />;
          }

          const item = equippedBySlot[slotKey];
          if (!item) {
            return <Slot key={slotKey} type="inventory" size={SLOT_SIZE} />;
          }

          return (
            <ItemSlot
              key={slotKey}
              id={item.Id}
              slotType={getItemSlotType(item)}
              grade={getItemGradeLabel(item)}
              isEquipped
              detail="full"
              size={SLOT_SIZE}
            />
          );
        })
      )}
    </div>
  );
});
