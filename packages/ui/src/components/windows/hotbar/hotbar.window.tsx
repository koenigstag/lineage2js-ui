import { Slot } from "../core/slot.component";

const HOTBAR_SLOT_COUNT = 12;

export function HotbarContent() {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: HOTBAR_SLOT_COUNT }).map((_, index) => (
        <Slot key={index} type="hotbar" />
      ))}
    </div>
  );
}
