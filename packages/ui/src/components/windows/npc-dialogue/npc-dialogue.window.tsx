import { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useGameStore } from "../../../stores/StoreContext";
import { parseNpcHtml } from "../../../lib/npc-html/parse-npc-html";

// 270 is the real client's own NPC dialogue window content width -- confirmed
// against the lineage2ts datapack's actual .htm sources (cli/overrides/html):
// <table width=270> is by far the dominant convention there (468 occurrences,
// next closest is 76), which content authors have to match or their own
// dialogue would get clipped in the real client.
const WIDTH = 270;
const MAX_HEIGHT = 480;

// Shown while GameStore.npcDialogue is set (an NpcHtmlMessage) -- windows-root.tsx
// collapses this window entirely when there's none, same hide-when-empty
// treatment as resurrect/party-invite/trade-request/etc. The titlebar x
// (windows.registry.ts's "npc-dialogue" entry + this window's onClose in
// windows-root.tsx) is the only way out, so GameStore.npcDialogue stays the
// single source of truth for whether the window is showing.
//
// parseNpcHtml is the actual safety boundary for the server-sent html string
// (see packages/ui/src/lib/npc-html) -- this component just mounts its
// result and forwards the l2-link "l2npcbypass" CustomEvent to the network
// layer via GameStore.sendNpcBypass.
export const NpcDialogueContent = observer(function NpcDialogueContent() {
  const game = useGameStore();
  const dialogue = game.npcDialogue;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function handleBypass(event: Event) {
      const { action } = (event as CustomEvent<{ action: string }>).detail;
      game.sendNpcBypass(action);
    }

    container.addEventListener("l2npcbypass", handleBypass);
    return () => container.removeEventListener("l2npcbypass", handleBypass);
  }, [game]);

  if (!dialogue) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: WIDTH,
        maxHeight: MAX_HEIGHT,
        overflowY: "auto",
        color: "#d7d7d7",
        fontSize: 12,
        lineHeight: 1.4,
      }}
    >
      {parseNpcHtml(dialogue.html)}
    </div>
  );
});
