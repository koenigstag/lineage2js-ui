import { ChatType } from "@lineage2js/network";

/** Channels the player can pick from the chat window's send dropdown -- the subset ClientCommands exposes a dedicated command for (see packages/network/src/commands/index.ts). */
export const SENDABLE_CHAT_CHANNELS: number[] = [
  ChatType.GENERAL,
  ChatType.TRADE,
  ChatType.PARTY,
  ChatType.CLAN,
  ChatType.ALLIANCE,
  ChatType.SHOUT,
  ChatType.WHISPER,
  ChatType.HERO_VOICE,
];

/** Chat window tab list -- "all" is a client-side merged view, not a real wire channel. */
export type ChatTab = "all" | number;
export const CHAT_TABS: ChatTab[] = ["all", ...SENDABLE_CHAT_CHANNELS];

export const CHAT_CHANNEL_LABEL_KEY: Record<number, string> = {
  [ChatType.GENERAL]: "chat.channels.general",
  [ChatType.SHOUT]: "chat.channels.shout",
  [ChatType.WHISPER]: "chat.channels.whisper",
  [ChatType.PARTY]: "chat.channels.party",
  [ChatType.CLAN]: "chat.channels.clan",
  [ChatType.TRADE]: "chat.channels.trade",
  [ChatType.ALLIANCE]: "chat.channels.alliance",
};

// TODO compare with retail L2's chat channel colors and adjust as needed -- see {packages/ui/public/chat-colors/default.json}
export const CHAT_CHANNEL_COLOR: Record<number, string> = {
  [ChatType.GENERAL]: "#e0e0e0",
  [ChatType.SHOUT]: "#ff8040",
  [ChatType.WHISPER]: "#d264d2",
  [ChatType.PARTY]: "#66aaff",
  [ChatType.CLAN]: "#4ec9b0",
  [ChatType.GM]: "#ff4040",
  [ChatType.PETITION_PLAYER]: "#ff4040",
  [ChatType.PETITION_GM]: "#ff4040",
  [ChatType.TRADE]: "#a0e040",
  [ChatType.ALLIANCE]: "#40d0d0",
  [ChatType.ANNOUNCEMENT]: "#ffd040",
  [ChatType.FRIEND]: "#80c0ff",
  [ChatType.HERO_VOICE]: "#ff60c0",
  [ChatType.CRITICAL_ANNOUNCE]: "#ff4040",
  [ChatType.BATTLEFIELD]: "#ff8040",
  [ChatType.NPC_GENERAL]: "#c8b892",
  [ChatType.NPC_SHOUT]: "#c8b892",
};



const DEFAULT_CHAT_CHANNEL_COLOR = "#c8c8c8";

export function getChatChannelColor(channel: number): string {
  return CHAT_CHANNEL_COLOR[channel] ?? DEFAULT_CHAT_CHANNEL_COLOR;
}
