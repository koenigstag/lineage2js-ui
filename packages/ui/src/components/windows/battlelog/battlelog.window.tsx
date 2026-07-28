import { observer } from "mobx-react-lite";
import { useEffect, useRef } from "react";
import { useGameStore } from "../../../stores/StoreContext";

const WIDTH = 300;
const HEIGHT = 150;

// Scrolling combat text feed -- see GameStore.battleLog/BATTLE_LOG_MESSAGE_IDS.
export const BattleLogContent = observer(function BattleLogContent() {
  const game = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [game.battleLog]);

  return (
    <div
      ref={scrollRef}
      style={{
        width: WIDTH,
        height: HEIGHT,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      {game.battleLog.map((entry) => (
        <div key={entry.id} style={{ color: "#c8b892", fontSize: 12, lineHeight: 1.3 }}>
          {entry.text}
        </div>
      ))}
    </div>
  );
});
