import { ChatType } from "@lineage2js/network";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useGameStore } from "../../../stores/StoreContext";
import { t } from "../../../lang/lang";
import { BaseInput } from "../../core/inputs/base.input";
import {
  CHAT_CHANNEL_LABEL_KEY,
  CHAT_TABS,
  CHANNELS_IN_EVERY_TAB,
  CHANNELS_WITHOUT_SENDER,
  CHAT_SENDER_LABEL_KEY,
  getChatChannelColor,
  parseChatInput,
  type ChatTab,
} from "../../../config/chat-channels";

const WIDTH = 340;
const LOG_HEIGHT = 160;
/**
 * Retail caps a chat *message* at 105 characters; this field also holds the
 * channel prefix and, for a whisper, the target name (see parseChatInput), so
 * it needs headroom over that. Still far below the server's own ChatTextLimit.
 */
const INPUT_MAX_LENGTH = 128;

function tabLabel(tab: ChatTab): string {
  return tab === "all"
    ? t("chat.channels.all")
    : t(CHAT_CHANNEL_LABEL_KEY[tab]);
}

/**
 * What goes in front of a line. Usually the sender the packet named, but
 * some channels label themselves instead, and some print nothing -- see
 * CHAT_SENDER_LABEL_KEY. Empty means the line stands on its own.
 */
function senderLabel(channel: number, senderName: string): string {
  const labelKey = CHAT_SENDER_LABEL_KEY[channel];
  if (labelKey) {
    return t(labelKey);
  }
  return CHANNELS_WITHOUT_SENDER.has(channel) ? "" : senderName;
}

// Same custom-scrollbar treatment as system-messages.window.tsx -- see
// .hide-native-scrollbar in index.css.
export const ChatContent = observer(function ChatContent() {
  const game = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ChatTab>("all");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");

  // The active tab doubles as the send channel (matches how the real client's
  // chat tabs work) -- "all" is a merged view only, so sending from it falls
  // back to General.
  const sendChannel = activeTab === "all" ? ChatType.GENERAL : activeTab;
  const messages =
    activeTab === "all"
      ? game.chatMessages
      : game.chatMessages.filter(
          (entry) => entry.channel === activeTab || CHANNELS_IN_EVERY_TAB.has(entry.channel)
        );

  // TODO Wire the store here when the per-tab setting is done. Until then
  // every sendable channel gets a tab -- hiding shout/whisper/hero here also
  // hid the only way to reach them, since the active tab is the send channel.
  const tabSettings: ChatTab[] = [];
  const showTabs = tabSettings?.length ? tabSettings : CHAT_TABS;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  function handleSend() {
    if (!draft.trim()) {
      return;
    }

    // A channel prefix typed into the line itself ("!", "#", '"Name ', ...)
    // overrides the active tab, same as the real client -- the tab is only
    // the default for an unprefixed line.
    const parsed = parseChatInput(draft, sendChannel);
    // parseChatInput only ever sets a target for a whisper, so this needs no
    // channel test of its own.
    const result = game.sendChatMessage(parsed.text, parsed.channel, parsed.target);

    if (result !== "sent") {
      // Nothing went out, so keep the draft -- clearing it here is what used
      // to make a targetless whisper vanish without a trace.
      setError(
        result === "missing-target"
          ? t("chat.errors.missingTarget")
          : t("chat.errors.emptyMessage")
      );
      return;
    }

    setError("");
    setDraft("");
  }

  function handleDraftChange(value: string) {
    setDraft(value);
    if (error) {
      setError("");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      handleSend();
    }
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", width: WIDTH, gap: 4 }}
    >
      <div
        className="hide-native-scrollbar"
        style={{ display: "flex", gap: 2, overflowX: "auto" }}
      >
        {CHAT_TABS.filter((tab) => showTabs.includes(tab)).map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={String(tab)}
              type="button"
              onClick={() => setActiveTab(tab)}
              style={{
                background: active ? "#3a3226" : "transparent",
                color: active ? "#e8dfc8" : "#888888",
                border: "none",
                borderBottom: active
                  ? "2px solid #bdaa8e"
                  : "2px solid transparent",
                padding: "3px 6px",
                fontSize: 11,
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {tabLabel(tab)}
            </button>
          );
        })}
      </div>
      <div
        ref={scrollRef}
        className="hide-native-scrollbar"
        style={{
          height: LOG_HEIGHT,
          overflowY: "scroll",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          padding: 4,
          background: "#101010",
        }}
      >
        {messages.map((entry) => {
          const color = getChatChannelColor(entry.channel);
          const sender = senderLabel(entry.channel, entry.senderName);
          return (
            <div
              key={entry.id}
              style={{
                color,
                fontSize: 12,
                lineHeight: 1.3,
                wordBreak: "break-word",
              }}
            >
              {/* Empty for a channel that labels nothing, and for an NpcSay
                  whose speaker the world scene cannot name -- that packet
                  identifies it by template id, not by name. */}
              {sender && <b>{sender}: </b>}
              {entry.text}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        <div style={{ flex: 1 }}>
          <BaseInput
            value={draft}
            placeholder={t("chat.messagePlaceholder")}
            onChange={handleDraftChange}
            onKeyDown={handleKeyDown}
            maxLength={INPUT_MAX_LENGTH}
          />
        </div>
      </div>
      {error && (
        <div style={{ color: "#ff8040", fontSize: 11, lineHeight: 1.3 }}>
          {error}
        </div>
      )}
    </div>
  );
});
