import { useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { hasHotbarDragPayload, readHotbarDragPayload, type HotbarDragPayload } from "./dnd";

export interface DnDButtonProps {
  /** Short glyph/text centered in the button, e.g. "$" (sell) or "X" (delete). */
  icon: ReactNode;
  /** Background tint -- distinguishes the button's purpose since there's no icon-frame art for it. */
  color: string;
  size?: number;
  title?: string;
  onDropItem: (payload: HotbarDragPayload) => void;
}

const DEFAULT_SIZE = 32;

/**
 * Square drop-target action button (inventory window's sell/delete slots, ...).
 * Deliberately its own component rather than a Slot variant -- it never shows
 * an item icon itself (Slot's whole purpose), it only reacts to one being
 * dropped onto it.
 */
export function DnDButton({ icon, color, size = DEFAULT_SIZE, title, onDropItem }: DnDButtonProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!hasHotbarDragPayload(e)) return;
    // Without preventDefault the browser refuses the drop entirely.
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    setIsDragOver(false);
    const payload = readHotbarDragPayload(e);
    if (!payload) return;
    e.preventDefault();
    onDropItem(payload);
  }

  const style: CSSProperties = {
    width: size,
    height: size,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: color,
    border: isDragOver ? "1px solid #d4af6a" : "1px solid #393839",
    borderRadius: 3,
    boxShadow: "inset 0 0 6px 1px #080808",
    color: "#e6d9be",
    fontSize: 14,
    fontWeight: "bold",
    userSelect: "none",
  };

  return (
    <div title={title} style={style} onDragOver={handleDragOver} onDragLeave={() => setIsDragOver(false)} onDrop={handleDrop}>
      {icon}
    </div>
  );
}
