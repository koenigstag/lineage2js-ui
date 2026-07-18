import { makeAutoObservable } from "mobx";
import { WINDOW_REGISTRY, type WindowConfig, type WindowPosition } from "../config/windows.registry";

interface WindowRuntimeState {
  open: boolean;
  x: number;
  y: number;
  zIndex: number;
}

// Bumped: x/y are now stored relative to each window's origin corner (see
// WindowConfig.origin) instead of always top-left, so stale v1 entries must
// not be reinterpreted under the new scheme.
const POSITIONS_KEY = "windowPositions.v2";
const BASE_Z_INDEX = 100;
const DEFAULT_WINDOW_SIZE = { width: 240, height: 160 };

function loadPersistedPositions(): Record<string, WindowPosition> {
  const raw = localStorage.getItem(POSITIONS_KEY);
  return raw ? JSON.parse(raw) : {};
}

function getViewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

export class WindowManagerStore {
  windows = new Map<string, WindowRuntimeState>();
  private topZIndex = BASE_Z_INDEX;

  constructor() {
    const persisted = loadPersistedPositions();

    for (const id of Object.keys(WINDOW_REGISTRY)) {
      const config = WINDOW_REGISTRY[id];
      const position = persisted[id] ?? this.getDefaultPosition(config);
      this.windows.set(id, { open: config.defaultOpen ?? false, x: position.x, y: position.y, zIndex: this.topZIndex });
    }

    makeAutoObservable(this);
  }

  private getDefaultPosition(config: WindowConfig): WindowPosition {
    const viewport = getViewport();
    if (config.defaultPosition) {
      return config.defaultPosition(viewport);
    }
    return {
      x: (viewport.width - DEFAULT_WINDOW_SIZE.width) / 2,
      y: (viewport.height - DEFAULT_WINDOW_SIZE.height) / 2,
    };
  }

  getConfig(id: string): WindowConfig | undefined {
    return WINDOW_REGISTRY[id];
  }

  getState(id: string): WindowRuntimeState {
    return this.windows.get(id) ?? { open: false, x: 0, y: 0, zIndex: BASE_Z_INDEX };
  }

  isOpen(id: string): boolean {
    return this.windows.get(id)?.open ?? false;
  }

  open(id: string) {
    const state = this.windows.get(id);
    if (!state) {
      return;
    }
    state.open = true;
    this.focus(id);
  }

  close(id: string) {
    const state = this.windows.get(id);
    if (state) {
      state.open = false;
    }
  }

  toggle(id: string) {
    if (this.isOpen(id)) {
      this.close(id);
    } else {
      this.open(id);
    }
  }

  focus(id: string) {
    const state = this.windows.get(id);
    if (!state) {
      return;
    }
    this.topZIndex += 1;
    state.zIndex = this.topZIndex;
  }

  move(id: string, x: number, y: number) {
    const state = this.windows.get(id);
    if (!state) {
      return;
    }
    state.x = x;
    state.y = y;
  }

  persist() {
    const positions: Record<string, WindowPosition> = {};
    this.windows.forEach((state, id) => {
      positions[id] = { x: state.x, y: state.y };
    });
    localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
  }
}
