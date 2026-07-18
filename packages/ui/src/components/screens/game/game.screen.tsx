import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Screen } from "../../core/screen.component";
import { GameMenu } from "../../menus/game/game.menu";
import { WindowsRoot } from "../../windows/core/windows-root";
import { GAME_WINDOW_IDS } from "../../../config/windows.registry";
import { useResetShortcut } from "../../../lib/useResetShortcut";

const MARGIN = 10;

export function GameScreen() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const recomputeMenuPosition = useCallback(() => {
    const rect = menuRef.current!.getBoundingClientRect();
    setMenuPosition({
      top: window.innerHeight - MARGIN - rect.height,
      left: window.innerWidth - MARGIN - rect.width,
    });
  }, []);

  // Measured once on mount and kept fixed -- unlike CSS bottom/right, this
  // does not chase the corner as the browser window is resized. Ctrl+L
  // (useResetShortcut below) re-measures it back to the corner on demand.
  useLayoutEffect(() => {
    recomputeMenuPosition();
  }, [recomputeMenuPosition]);

  useResetShortcut(recomputeMenuPosition);

  return (
    <Screen className="screen screen--game">
      <WindowsRoot ids={GAME_WINDOW_IDS} />

      <div
        ref={menuRef}
        style={{
          position: "absolute",
          top: menuPosition?.top ?? MARGIN,
          left: menuPosition?.left ?? MARGIN,
          visibility: menuPosition ? "visible" : "hidden",
        }}
      >
        <GameMenu />
      </div>
    </Screen>
  );
}
