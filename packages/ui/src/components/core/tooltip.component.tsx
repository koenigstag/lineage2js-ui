import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import type { IconSlotType } from "./icon-frame.component";
import { TOOLTIP_Z_INDEX } from "../../config/z-index";

const TYPE_TEXT: Record<IconSlotType, string> = {
  skill: "Skill",
  "pet-action": "Pet Action",
  action: "Action",
  macro: "Macro",
  "pair-action": "Pair Action",
  "item-misc": "Misc. Item",
  "item-weapon": "Weapon",
  "item-shield": "Shield",
  "item-armor": "Armor",
  "item-jewelry": "Jewelry",
};

export function getTypeText(type: IconSlotType): string {
  return TYPE_TEXT[type] ?? type;
}

export type TooltipInfo =
  | { kind: "item"; name: string; type: IconSlotType; id: string | number; count?: number }
  | { kind: "skill"; name: string; stats: string; cost: number; id: string | number }
  | { kind: "simple"; name: string };

export interface TooltipTarget {
  info: TooltipInfo;
  /** Anchor rect of the hovered element, in viewport coordinates. */
  rect: DOMRect;
}

const GAP = 6;

const tooltipStyle: CSSProperties = {
  position: "fixed",
  border: "1px solid #383834",
  borderRadius: 0,
  backgroundColor: "#171511",
  color: "#c0bfbb",
  padding: "6px 10px",
  fontSize: 11,
  lineHeight: 1.6,
  whiteSpace: "nowrap",
  pointerEvents: "none",
  zIndex: TOOLTIP_Z_INDEX,
};

function TooltipContent({ info }: { info: TooltipInfo }) {
  switch (info.kind) {
    case "item": {
      const nameLine = info.count && info.count > 1 ? `${info.name} (${info.count})` : info.name;
      return (
        <>
          <div>{nameLine}</div>
          <div>{getTypeText(info.type)}</div>
          <div style={{ marginTop: 6 }}>ID {info.id}</div>
        </>
      );
    }
    case "skill":
      return (
        <>
          <div>{info.name}</div>
          <div style={{ marginTop: 6 }}>{info.stats}</div>
          <div style={{ marginTop: 6 }}>Cost: {info.cost}</div>
          <div style={{ marginTop: 6 }}>ID {info.id}</div>
        </>
      );
    case "simple":
      return <div>{info.name}</div>;
  }
}

// Mounted off-screen (visibility: hidden) on the first paint so its real
// size can be measured, then repositioned to flip off whichever edge(s) it
// would otherwise overflow -- a guessed width can't account for "skill"
// tooltips being much wider/taller than a one-line "simple" tooltip.
const measuringStyle: CSSProperties = { ...tooltipStyle, visibility: "hidden", left: 0, top: 0 };

export function Tooltip({ target }: { target: TooltipTarget | null }) {
  const nodeRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties>(measuringStyle);

  useLayoutEffect(() => {
    if (!target || !nodeRef.current) {
      return;
    }

    const { rect } = target;
    const { width, height } = nodeRef.current.getBoundingClientRect();

    const overflowsRight = rect.right + GAP + width > window.innerWidth;
    const overflowsBottom = rect.top + height > window.innerHeight;

    setStyle({
      ...tooltipStyle,
      ...(overflowsRight ? { right: window.innerWidth - rect.left + GAP } : { left: rect.right + GAP }),
      ...(overflowsBottom ? { bottom: window.innerHeight - rect.bottom } : { top: rect.top }),
    });
  }, [target]);

  if (!target) {
    return null;
  }

  return createPortal(
    <div ref={nodeRef} style={style}>
      <TooltipContent info={target.info} />
    </div>,
    document.body
  );
}

/** Hover-state helper: tracks the currently hovered slot's tooltip target. */
export function useTooltipTarget() {
  const [target, setTarget] = useState<TooltipTarget | null>(null);

  function showTooltip(element: HTMLElement, info: TooltipInfo) {
    setTarget({ info, rect: element.getBoundingClientRect() });
  }

  function hideTooltip() {
    setTarget(null);
  }

  return { target, showTooltip, hideTooltip };
}
