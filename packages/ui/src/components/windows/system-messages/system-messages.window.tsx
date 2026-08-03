import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState } from "react";
import { useGameStore } from "../../../stores/StoreContext";

const WIDTH = 300;
const HEIGHT = 150;
const TRACK_WIDTH = 6;
const MIN_THUMB_HEIGHT = 20;

interface ThumbGeometry {
  top: number;
  height: number;
}

function measureThumb(el: HTMLDivElement): ThumbGeometry {
  const { scrollTop, scrollHeight, clientHeight } = el;
  if (scrollHeight <= clientHeight) {
    return { top: 0, height: clientHeight };
  }
  const height = Math.max(MIN_THUMB_HEIGHT, (clientHeight / scrollHeight) * clientHeight);
  const top = (scrollTop / (scrollHeight - clientHeight)) * (clientHeight - height);
  return { top, height };
}

// Scrolling system-message feed (combat text plus everything else not
// filtered by isNoisySystemMessage()) -- see GameStore.systemMessages.
// Native scrollbars are hidden and replaced with a custom always-drawn
// track+thumb (see index.css's .hide-native-scrollbar):
// modern Chromium/GTK increasingly default to "overlay" scrollbars that
// reserve no layout space and only paint while actively scrolling, which
// reads as "no scrollbar at all" for a HUD element like this one.
export const SystemMessagesContent = observer(function SystemMessagesContent() {
  const game = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<ThumbGeometry>({ top: 0, height: HEIGHT });

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
      setThumb(measureThumb(el));
    }
  }, [game.systemMessages]);

  return (
    <div style={{ display: "flex", flexDirection: "row", width: WIDTH, height: HEIGHT }}>
      <div
        ref={scrollRef}
        className="hide-native-scrollbar"
        onScroll={(event) => setThumb(measureThumb(event.currentTarget))}
        style={{
          flex: 1,
          height: HEIGHT,
          overflowY: "scroll",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {game.systemMessages.map((entry) => (
          <div key={entry.id} style={{ color: "#c8b892", fontSize: 12, lineHeight: 1.3 }}>
            {entry.text}
          </div>
        ))}
      </div>
      <div style={{ position: "relative", width: TRACK_WIDTH, height: HEIGHT, background: "#101010" }}>
        <div
          style={{
            position: "absolute",
            top: thumb.top,
            width: TRACK_WIDTH,
            height: thumb.height,
            background: "#5d4f48",
            borderRadius: 3,
          }}
        />
      </div>
    </div>
  );
});
