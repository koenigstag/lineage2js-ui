import { useRef, type CSSProperties } from "react";
import { IconSlot, type IconSlotType } from "../../core/icon-frame.component";
import { Tooltip, useTooltipTarget, type TooltipInfo } from "../../core/tooltip.component";

export interface SlotContent {
  type: IconSlotType;
  data?: unknown;
  /** Stack size, e.g. item-misc quantity. Displayed capped at "99+". */
  count?: number;
  /** Real icon image (see config/icon-urls.ts). Falls back to the type's gradient when unset. */
  iconUrl?: string;
  /** Hover tooltip content. No tooltip is shown when unset. */
  tooltip?: TooltipInfo;
}

export interface IconBorder {
  from: string;
  to: string;
}

export interface SlotProps {
  type: "hotbar" | "inventory";
  content?: SlotContent;
  /** Keyboard key label drawn over the icon frame, e.g. "1" or "Kq". */
  slotKey?: string;
  /** Icon frame border colors. Not set by IconFrame itself -- each caller opts in. */
  iconBorder?: IconBorder;
  /** Square size in px. Defaults to the standard 34px slot (hotbar/inventory); smaller for e.g. buff icons. */
  size?: number;
  /** Brief highlight, e.g. while its bound hotbar key is held down. */
  pressed?: boolean;
}

const SLOT_SIZE = 34;

function getEmptySlotStyle(size: number): CSSProperties {
  return {
    width: size,
    height: size,
    border: "1px solid #393839",
    backgroundColor: "#101010",
    boxShadow: "inset 0 0 6px 1px #080808",
  };
}

const slotKeyStyle: CSSProperties = {
  position: "absolute",
  top: 2,
  left: 2,
  fontFamily: "'Courier Prime', monospace",
  fontSize: 9,
  lineHeight: 1,
  color: "#d4d6c6",
  textShadow: "0 1px 1px rgba(0, 0, 0, 0.9)",
  zIndex: 2,
  pointerEvents: "none",
  userSelect: "none",
};

const slotCountStyle: CSSProperties = {
  position: "absolute",
  bottom: 1,
  right: 2,
  textAlign: "right",
  fontFamily: "'Courier Prime', monospace",
  fontSize: 11,
  lineHeight: 1,
  color: "#ddcdbe",
  textShadow: "0 1px 1px #6c5e4e",
  zIndex: 2,
  pointerEvents: "none",
  userSelect: "none",
};

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function Slot({ content, slotKey, iconBorder, size = SLOT_SIZE, pressed }: SlotProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { target, showTooltip, hideTooltip } = useTooltipTarget();
  const tooltip = content?.tooltip;

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        width: size,
        height: size,
        filter: pressed ? "brightness(1.6)" : undefined,
      }}
      onMouseEnter={() => {
        if (tooltip && rootRef.current) {
          showTooltip(rootRef.current, tooltip);
        }
      }}
      onMouseLeave={hideTooltip}
    >
      {content ? (
        <IconSlot
          type={content.type}
          iconUrl={content.iconUrl}
          width={size}
          height={size}
          borderFrom={iconBorder?.from}
          borderTo={iconBorder?.to}
        />
      ) : (
        <div style={getEmptySlotStyle(size)} />
      )}
      {slotKey && <div style={slotKeyStyle}>{slotKey}</div>}
      {content?.count !== undefined && <div style={slotCountStyle}>{formatCount(content.count)}</div>}
      {tooltip && <Tooltip target={target} />}
    </div>
  );
}
