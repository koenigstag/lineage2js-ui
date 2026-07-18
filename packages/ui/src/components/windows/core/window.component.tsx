import { observer } from "mobx-react-lite";
import {
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useWindowManagerStore } from "../../../stores/StoreContext";
import type {
  WindowOrigin,
  WindowPosition,
} from "../../../config/windows.registry";

export interface WindowProps {
  id: string;
  children?: () => ReactNode;
}

const containerBaseStyle: CSSProperties = {
  position: "absolute",
  backgroundColor: "#1a1a1a",
  borderRadius: 4,
  overflow: "hidden",
  minWidth: 200,
};

const TITLEBAR_BORDER_COLOR = "#bdaa8e";
const SIDEBAR_BORDER_COLOR = "#504f4f";
const SIDEBAR_STRIP_BORDER_COLOR = "#b5a28c";
const ONLY_BODY_BORDER_COLOR = "#444444";
const TITLEBAR_BACKGROUND =
  "linear-gradient(to bottom, #353328 50%, #251d14 50%)";
const SIDEBAR_BACKGROUND =
  "linear-gradient(to right, #353328 50%, #251d14 50%)";
const TITLE_TEXT_COLOR = "#c8cfdc";

const closeButtonStyle: CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#a59e84",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  padding: "0 2px",
};

const SNAP_THRESHOLD = 5;
// Gap left between two windows when they snap to each other (screen edges stay flush).
const WINDOW_GAP = 5;

interface Edges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function snapPosition(
  selfId: string,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const screenTarget: Edges = {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
  };
  const windowTargets: Edges[] = [];

  document.querySelectorAll<HTMLElement>(".window").forEach((el) => {
    if (el.id !== selfId) {
      const rect = el.getBoundingClientRect();
      windowTargets.push({
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      });
    }
  });

  let snappedX = x;
  let snappedY = y;
  const left = x;
  const right = x + width;
  const top = y;
  const bottom = y + height;

  function applyHorizontal(target: Edges, gap: number) {
    if (Math.abs(left - (target.right + gap)) < SNAP_THRESHOLD) {
      snappedX = target.right + gap;
    } else if (Math.abs(left - target.left) < SNAP_THRESHOLD) {
      snappedX = target.left;
    } else if (Math.abs(right - (target.left - gap)) < SNAP_THRESHOLD) {
      snappedX = target.left - gap - width;
    } else if (Math.abs(right - target.right) < SNAP_THRESHOLD) {
      snappedX = target.right - width;
    }
  }

  function applyVertical(target: Edges, gap: number) {
    if (Math.abs(top - (target.bottom + gap)) < SNAP_THRESHOLD) {
      snappedY = target.bottom + gap;
    } else if (Math.abs(top - target.top) < SNAP_THRESHOLD) {
      snappedY = target.top;
    } else if (Math.abs(bottom - (target.top - gap)) < SNAP_THRESHOLD) {
      snappedY = target.top - gap - height;
    } else if (Math.abs(bottom - target.bottom) < SNAP_THRESHOLD) {
      snappedY = target.bottom - height;
    }
  }

  applyHorizontal(screenTarget, 0);
  applyVertical(screenTarget, 0);

  for (const target of windowTargets) {
    applyHorizontal(target, WINDOW_GAP);
    applyVertical(target, WINDOW_GAP);
  }

  return { x: snappedX, y: snappedY };
}

function isRightOrigin(origin: WindowOrigin) {
  return origin === "top-right" || origin === "bottom-right";
}

function isBottomOrigin(origin: WindowOrigin) {
  return origin === "bottom-left" || origin === "bottom-right";
}

/** Absolute screen-space (left, top) -> distance from the window's origin corner, for persisting. */
function toOriginRelative(
  origin: WindowOrigin,
  left: number,
  top: number,
  width: number,
  height: number
): WindowPosition {
  return {
    x: isRightOrigin(origin) ? window.innerWidth - left - width : left,
    y: isBottomOrigin(origin) ? window.innerHeight - top - height : top,
  };
}

/** Persisted origin-relative x/y -> the CSS properties that place it there. */
function getOriginStyle(
  origin: WindowOrigin,
  x: number,
  y: number
): CSSProperties {
  return {
    [isRightOrigin(origin) ? "right" : "left"]: x,
    [isBottomOrigin(origin) ? "bottom" : "top"]: y,
  };
}

export const Window = observer(function Window({ id, children }: WindowProps) {
  const windowManager = useWindowManagerStore();
  const config = windowManager.getConfig(id);
  const state = windowManager.getState(id);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!config || !state.open) {
    return null;
  }

  const origin = config.origin ?? "top-left";
  const contentStyle: CSSProperties = {
    padding: config.contentPadding ?? 8,
    backgroundColor: config.contentBackground,
  };

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
    const originLeft = rect.left;
    const originTop = rect.top;

    function handlePointerMove(moveEvent: PointerEvent) {
      const rawLeft = originLeft + (moveEvent.clientX - startX);
      const rawTop = originTop + (moveEvent.clientY - startY);
      const snapped = snapPosition(id, rawLeft, rawTop, width, height);
      const relative = toOriginRelative(
        origin,
        snapped.x,
        snapped.y,
        width,
        height
      );
      windowManager.move(id, relative.x, relative.y);
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
    ...(config.bare
      ? { backgroundColor: "transparent", minWidth: undefined }
      : {}),
    ...getOriginStyle(origin, state.x, state.y),
    zIndex: state.zIndex,
  };

  if (config.type === "titlebar") {
    return (
      <div
        ref={containerRef}
        id={id}
        className="window window--titlebar"
        style={{
          ...containerStyle,
          border: config.bare ? "none" : `1px solid ${TITLEBAR_BORDER_COLOR}`,
          ...config.windowStyle?.root,
        }}
        onPointerDown={handleFocus}
      >
        <div
          className="window__titlebar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            background: TITLEBAR_BACKGROUND,
            borderBottom: `1px solid ${TITLEBAR_BORDER_COLOR}`,
            cursor: config.draggable ? "move" : "default",
            ...config.windowStyle?.titlebar,
          }}
          onPointerDown={handleDragStart}
        >
          <span
            style={{
              width: 16,
              textAlign: "center",
              fontSize: 12,
              ...config.windowStyle?.titleIcon,
            }}
          >
            {config.icon}
          </span>
          <span
            style={{
              flex: 1,
              textAlign: "center",
              color: TITLE_TEXT_COLOR,
              ...config.windowStyle?.title,
            }}
          >
            {config.title}
          </span>
          {config.closable && (
            <button
              type="button"
              onClick={() => windowManager.close(id)}
              style={{
                ...closeButtonStyle,
                ...config.windowStyle?.closeButton,
              }}
            >
              ×
            </button>
          )}
        </div>
        <div
          className="window__content"
          style={{
            ...contentStyle,
            ...config.windowStyle?.content,
          }}
        >
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
        style={{
          ...containerStyle,
          display: "flex",
          border: config.bare ? "none" : `1px solid ${SIDEBAR_BORDER_COLOR}`,
          ...config.windowStyle?.root,
        }}
        onPointerDown={handleFocus}
      >
        {!config.hideStrip && (
          <div
            style={{
              width: 12,
              background: SIDEBAR_BACKGROUND,
              border: `1px solid ${SIDEBAR_STRIP_BORDER_COLOR}`,
              borderRight: "none",
              cursor: config.draggable ? "move" : "default",
              ...config.windowStyle?.sidebar,
            }}
            onPointerDown={handleDragStart}
          />
        )}
        <div
          className="window__content"
          style={{
            ...contentStyle,
            ...config.windowStyle?.content,
          }}
        >
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
      style={{
        ...containerStyle,
        border: config.bare ? "none" : `1px solid ${ONLY_BODY_BORDER_COLOR}`,
        cursor: config.draggable ? "move" : "default",
        ...config.windowStyle?.root,
      }}
      onPointerDown={(event) => {
        handleFocus();
        handleDragStart(event);
      }}
    >
      <div
        className="window__content"
        style={{
          ...contentStyle,
          ...config.windowStyle?.content,
        }}
      >
        {children?.()}
      </div>
    </div>
  );
});
