import { useEffect, useRef } from "react";
import { observer } from "mobx-react-lite";
import { useGameStore } from "../../../stores/StoreContext";
import { parseNpcHtml } from "../../../lib/npc-html/parse-npc-html";
import type { NpcAction } from "../../../lib/npc-html/npc-html-elements";

// 270 is the real client's own NPC dialogue window content width -- confirmed
// against the lineage2ts datapack's actual .htm sources (cli/overrides/html):
// <table width=270> is by far the dominant convention there (468 occurrences,
// next closest is 76), which content authors have to match or their own
// dialogue would get clipped in the real client.
const WIDTH = 270;
// A genuinely fixed height, not a cap -- the real client's dialogue window is
// a fixed-size frame that doesn't reflow with its content (short text just
// leaves blank space below it), so a height that changes with each message
// makes the window visibly resize/jump on screen every time its content
// swaps. Height has no equivalent of WIDTH's clean signal though: unlike
// width=270, which is the dominant convention across hundreds of unrelated
// plain-text dialogues, a `<table height=...>` attribute in the datapack
// only shows up on windows with their own custom background texture (eg.
// height=358 is L2UI_CH3.refinewnd_back_Pattern's own fixed size, reused by
// several unrelated feature popups) -- there's no equally authoritative
// number for the plain default chat frame this window renders. 480 keeps the
// prior cap's value as the fixed height rather than inventing an unverified
// one.
const HEIGHT = 480;

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
// layer via GameStore.sendNpcBypass/sendNpcLink, picking whichever the event
// says the link actually was -- "bypass" and "link" are different packets
// server-side (see npc-html-elements.ts's NpcAction comment), not two
// spellings of the same thing.
export const NpcDialogueContent = observer(function NpcDialogueContent() {
  const game = useGameStore();
  const dialogue = game.npcDialogue;
  const containerRef = useRef<HTMLDivElement>(null);

  // Deps include `dialogue`, not just `game`: the container only exists once
  // there's a dialogue to show it for (see the early return below), so an
  // effect that only reran when `game` changed -- it never does -- attached
  // to containerRef.current on the very first mount, while it was still
  // null, and then never got another chance to. The listener was never
  // attached at all; clicking a link dispatched the event straight into a
  // container with nothing on it to hear it.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function handleAction(event: Event) {
      const { kind, command } = (event as CustomEvent<NpcAction>).detail;
      if (kind === "link") {
        game.sendNpcLink(command);
      } else {
        game.sendNpcBypass(command);
      }
    }

    container.addEventListener("l2npcbypass", handleAction);
    return () => container.removeEventListener("l2npcbypass", handleAction);
  }, [game, dialogue]);

  if (!dialogue) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: WIDTH,
        height: HEIGHT,
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
