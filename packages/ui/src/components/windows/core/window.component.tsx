import { observer } from "mobx-react-lite";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
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

export const Window = observer(function Window({ id, children }: WindowProps) {
  const windowManager = useWindowManagerStore();
  const config = windowManager.getConfig(id);
  const state = windowManager.getState(id);

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

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = state!.x;
    const originY = state!.y;

    function handlePointerMove(moveEvent: PointerEvent) {
      windowManager.move(id, originX + (moveEvent.clientX - startX), originY + (moveEvent.clientY - startY));
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
      <div id={id} className="window window--titlebar" style={containerStyle} onPointerDown={handleFocus}>
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
