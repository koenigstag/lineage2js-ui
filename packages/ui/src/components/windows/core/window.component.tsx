import { observer } from "mobx-react-lite";
import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useWindowManagerStore } from "../../../stores/StoreContext";

export interface WindowProps {
  id: string;
  children?: () => ReactNode;
}

const containerBaseStyle: CSSProperties = {
  position: "absolute",
  backgroundColor: "#1a1a1a",
  border: "1px solid #444444",
  borderRadius: 4,
  minWidth: 200,
};

const closeButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#cccccc",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  padding: "0 2px",
};

const SNAP_THRESHOLD = 5;

interface Edges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function snapPosition(selfId: string, x: number, y: number, width: number, height: number) {
  const targets: Edges[] = [{ left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }];

  document.querySelectorAll<HTMLElement>(".window").forEach((el) => {
    if (el.id !== selfId) {
      const rect = el.getBoundingClientRect();
      targets.push({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom });
    }
  });

  let snappedX = x;
  let snappedY = y;
  const left = x;
  const right = x + width;
  const top = y;
  const bottom = y + height;

  for (const target of targets) {
    if (Math.abs(left - target.right) < SNAP_THRESHOLD) {
      snappedX = target.right;
    } else if (Math.abs(left - target.left) < SNAP_THRESHOLD) {
      snappedX = target.left;
    } else if (Math.abs(right - target.left) < SNAP_THRESHOLD) {
      snappedX = target.left - width;
    } else if (Math.abs(right - target.right) < SNAP_THRESHOLD) {
      snappedX = target.right - width;
    }

    if (Math.abs(top - target.bottom) < SNAP_THRESHOLD) {
      snappedY = target.bottom;
    } else if (Math.abs(top - target.top) < SNAP_THRESHOLD) {
      snappedY = target.top;
    } else if (Math.abs(bottom - target.top) < SNAP_THRESHOLD) {
      snappedY = target.top - height;
    } else if (Math.abs(bottom - target.bottom) < SNAP_THRESHOLD) {
      snappedY = target.bottom - height;
    }
  }

  return { x: snappedX, y: snappedY };
}

export const Window = observer(function Window({ id, children }: WindowProps) {
  const windowManager = useWindowManagerStore();
  const config = windowManager.getConfig(id);
  const state = windowManager.getState(id);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!config || !state.open) {
    return null;
  }

  function handleFocus() {
    windowManager.focus(id);
  }

  function handleDragStart(event: ReactPointerEvent) {
    if (!config!.draggable) {
      return;
    }

    event.preventDefault();
    windowManager.focus(id);

    const rect = containerRef.current!.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = state!.x;
    const originY = state!.y;

    function handlePointerMove(moveEvent: PointerEvent) {
      const rawX = originX + (moveEvent.clientX - startX);
      const rawY = originY + (moveEvent.clientY - startY);
      const snapped = snapPosition(id, rawX, rawY, width, height);
      windowManager.move(id, snapped.x, snapped.y);
    }

    function handlePointerUp() {
      windowManager.persist();
      document.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerup", handlePointerUp);
    }

    document.addEventListener("pointermove", handlePointerMove);
    document.addEventListener("pointerup", handlePointerUp);
  }

  const containerStyle: CSSProperties = {
    ...containerBaseStyle,
    left: state.x,
    top: state.y,
    zIndex: state.zIndex,
  };

  if (config.type === "titlebar") {
    return (
      <div ref={containerRef} id={id} className="window window--titlebar" style={containerStyle} onPointerDown={handleFocus}>
        <div
          className="window__titlebar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderBottom: "1px solid #444444",
            cursor: config.draggable ? "move" : "default",
          }}
          onPointerDown={handleDragStart}
        >
          <span style={{ width: 16, textAlign: "center", fontSize: 12 }}>{config.icon}</span>
          <span style={{ flex: 1, textAlign: "center", color: "#cccccc" }}>{config.title}</span>
          {config.closable && (
            <button type="button" onClick={() => windowManager.close(id)} style={closeButtonStyle}>
              ×
            </button>
          )}
        </div>
        <div className="window__content" style={{ padding: 8 }}>
          {children?.()}
        </div>
      </div>
    );
  }

  if (config.type === "sidebar") {
    return (
      <div
        ref={containerRef}
        id={id}
        className="window window--sidebar"
        style={{ ...containerStyle, display: "flex" }}
        onPointerDown={handleFocus}
      >
        <div
          style={{ width: 12, borderRight: "1px solid #444444", cursor: config.draggable ? "move" : "default" }}
          onPointerDown={handleDragStart}
        />
        <div className="window__content" style={{ padding: 8 }}>
          {children?.()}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id={id}
      className="window window--only-body"
      style={{ ...containerStyle, cursor: config.draggable ? "move" : "default" }}
      onPointerDown={(event) => {
        handleFocus();
        handleDragStart(event);
      }}
    >
      <div className="window__content" style={{ padding: 8 }}>
        {children?.()}
      </div>
    </div>
  );
});
