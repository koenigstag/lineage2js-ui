import { observer } from "mobx-react-lite";
import type { ReactNode } from "react";
import type { L2Item } from "@lineage2js/network";
import { Slot } from "../core/slot.component";
import { ItemSlot } from "../core/item-slot.component";
import { useGameStore, useSessionStore } from "../../../stores/StoreContext";
import { getItemSlotType, getItemGradeLabel } from "../../../config/item-mapping";
import { useClickOrDoubleClick } from "../../../lib/useClickOrDoubleClick";
import {
  PAPERDOLL_BLOCKS,
  getEquippedItemsBySlot,
  getUnequipSlot,
  isSecondaryCombinedSlot,
  type PaperdollSection,
  type PaperdollSlotKey,
} from "../../../config/paperdoll-mapping";

const SLOT_SIZE = 34;
const COLUMN_GAP = 10;
const ROW_GAP = (20 * 2) / 3; // 1/3 smaller than the original 20px row gap
const SECTION_GAP = 20; // between top-level blocks
const INNER_SECTION_GAP = 20; // between body/hands/accessories within their shared block -- kept equal, tuned independently of SECTION_GAP
const PADDING = 20;
const BLOCK_BORDER_PADDING = 10;

const HENNA_SLOT_SIZE = SLOT_SIZE / 2;
const HENNA_OFFSET_TOP = 0;
const HENNA_OFFSET_LEFT = -25;
const HENNA_GAP = 1;

/**
 * Henna dye slots -- not part of the 25 wire paperdoll slots at all (a
 * separate mechanic from equipped items, no data source in this codebase
 * yet), so these are static placeholders. Absolutely positioned off hair1's
 * top-left corner so they can't push any other slot's layout around.
 */
function HennaSlots() {
  return (
    <div
      style={{
        position: "absolute",
        top: HENNA_OFFSET_TOP,
        left: HENNA_OFFSET_LEFT,
        display: "flex",
        flexDirection: "column",
        gap: HENNA_GAP,
      }}
    >
      {[0, 1, 2].map((index) => (
        <Slot key={index} type="inventory" size={HENNA_SLOT_SIZE} />
      ))}
    </div>
  );
}

/**
 * Wraps an equipped paperdoll slot's content with click-vs-double-click
 * resolution -- its own component (not just a hook call inline in
 * renderSection's .map()) because useClickOrDoubleClick needs one
 * independent timer per cell; clicking slot A then slot B must never
 * combine into a "double click".
 */
function PaperdollItemCell({ children, onUnequip }: { children: ReactNode; onUnequip: () => void }) {
  const { onClick } = useClickOrDoubleClick(() => {}, onUnequip);
  return <div onClick={onClick}>{children}</div>;
}

export const Paperdoll = observer(function Paperdoll() {
  const game = useGameStore();
  const session = useSessionStore();
  const equippedBySlot = getEquippedItemsBySlot(game.inventoryItems);

  // Click an equipped cell to take it off. Prefers the real RequestUnEquipItem
  // packet (matches the retail client's paperdoll-click behavior), except for
  // decor/talisman slots, which have no per-cell wire value to send (see
  // getUnequipSlot's comment) -- those fall back to useItem's equip toggle,
  // which targets the exact objectId instead of an ambiguous shared slot.
  function handleUnequip(slotKey: PaperdollSlotKey, item: L2Item) {
    const slot = getUnequipSlot(slotKey, item);
    if (slot === undefined) {
      session.client.useItem(item);
    } else {
      session.client.unequipItem(slot);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SECTION_GAP, flexShrink: 0, padding: PADDING }}>
      {PAPERDOLL_BLOCKS.map(({ sections, bordered, extraGapBefore }, blockIndex) => (
        <div
          key={blockIndex}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: INNER_SECTION_GAP,
            marginTop: extraGapBefore,
            border: bordered ? "1px solid #76654f" : undefined,
            borderRadius: bordered ? 6 : undefined,
            padding: bordered ? BLOCK_BORDER_PADDING : undefined,
          }}
        >
          {sections.map((section, sectionIndex) => renderSection(section, sectionIndex, equippedBySlot, handleUnequip))}
        </div>
      ))}
    </div>
  );
});

function renderSection(
  { rows, slotSize = SLOT_SIZE, columnGap = COLUMN_GAP, center }: PaperdollSection,
  sectionIndex: number,
  equippedBySlot: Partial<Record<PaperdollSlotKey, L2Item>>,
  onUnequip: (slotKey: PaperdollSlotKey, item: L2Item) => void
) {
  return (
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
          const content = item ? (
            <ItemSlot
              id={item.Id}
              slotType={getItemSlotType(item)}
              grade={getItemGradeLabel(item)}
              isEquipped
              detail="full"
              size={slotSize}
            />
          ) : (
            <Slot type="inventory" size={slotSize} />
          );

          // Combined-slot items (hair1+hair2, rhand+lhand, chest+legs -- one
          // physical item filling two cells, see isSecondaryCombinedSlot)
          // only act from their primary cell. The secondary cell shows the
          // same icon dimmed and non-interactive -- it can't be unequipped
          // on its own since it isn't a separate item, and there's no real
          // per-cell icon to differentiate it with (checked against
          // lineage2ts's item data, see isSecondaryCombinedSlot's comment).
          const isSecondary = item ? isSecondaryCombinedSlot(slotKey, item) : false;

          // Double-click to unequip, same trigger as the inventory grid's
          // equip toggle -- a single click would fire on every hover-to-inspect
          // click, unequipping by accident. Resolved via useClickOrDoubleClick
          // (single click is a no-op for now -- no per-item click action exists
          // yet) rather than the native onDoubleClick event.
          const clickable = !item ? (
            content
          ) : isSecondary ? (
            <div style={{ opacity: 0.55, pointerEvents: "none" }}>{content}</div>
          ) : (
            <PaperdollItemCell onUnequip={() => onUnequip(slotKey, item)}>{content}</PaperdollItemCell>
          );

          if (slotKey === "hair1") {
            return (
              <div key={slotKey} style={{ position: "relative" }}>
                {clickable}
                <HennaSlots />
              </div>
            );
          }

          // Hidden for now -- no real second-bracelet content to show yet,
          // see PAPERDOLL_BLOCKS' comment (lbracelet already covers the
          // agathion slot). display:none rather than dropping the block
          // entirely so the layout/data plumbing stays in place to re-enable.
          if (slotKey === "rbracelet") {
            return <div key={slotKey} style={{ display: "none" }}>{clickable}</div>;
          }

          return <div key={slotKey}>{clickable}</div>;
        })
      )}
    </div>
  );
}
