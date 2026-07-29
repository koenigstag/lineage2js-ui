import { ChatType } from "@lineage2js/network";
import { observer } from "mobx-react-lite";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useGameStore } from "../../../stores/StoreContext";
import { t } from "../../../lang/lang";
import { BaseInput } from "../../core/inputs/base.input";
import {
  CHAT_CHANNEL_LABEL_KEY,
  CHAT_TABS,
  getChatChannelColor,
  type ChatTab,
} from "../../../config/chat-channels";

const WIDTH = 340;
const LOG_HEIGHT = 160;

function tabLabel(tab: ChatTab): string {
  return tab === "all"
    ? t("chat.channels.all")
    : t(CHAT_CHANNEL_LABEL_KEY[tab]);
}

// Same custom-scrollbar treatment as battlelog.window.tsx -- see
// .battle-log-hide-native-scrollbar in index.css.
export const ChatContent = observer(function ChatContent() {
  const game = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<ChatTab>("all");
  const [target, setTarget] = useState("");
  const [draft, setDraft] = useState("");

  // The active tab doubles as the send channel (matches how the real client's
  // chat tabs work) -- "all" is a merged view only, so sending from it falls
  // back to General.
  const sendChannel = activeTab === "all" ? ChatType.GENERAL : activeTab;
  const messages =
    activeTab === "all"
      ? game.chatMessages
      : game.chatMessages.filter((entry) => entry.channel === activeTab);

  // TODO Wire the store here when setting is done
  const tabSettings: ChatTab[] = [];
  const showTabs = tabSettings?.length
    ? tabSettings
    : CHAT_TABS.filter(
        (channel) =>
          ![ChatType.HERO_VOICE, ChatType.WHISPER, ChatType.SHOUT].includes(
            channel as any
          )
      );

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
    game.sendChatMessage(
      draft,
      sendChannel,
      sendChannel === ChatType.WHISPER ? target : undefined
    );
    setDraft("");
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
        className="battle-log-hide-native-scrollbar"
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
        className="battle-log-hide-native-scrollbar"
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
              <b>{entry.senderName}: </b>
              {entry.text}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {sendChannel === ChatType.WHISPER && (
          <div style={{ width: 90 }}>
            <BaseInput
              value={target}
              placeholder={t("chat.whisperTargetPlaceholder")}
              onChange={setTarget}
            />
          </div>
        )}
        <div style={{ flex: 1 }}>
          <BaseInput
            value={draft}
            placeholder={t("chat.messagePlaceholder")}
            onChange={setDraft}
            onKeyDown={handleKeyDown}
            maxLength={105}
          />
        </div>
      </div>
    </div>
  );
});
