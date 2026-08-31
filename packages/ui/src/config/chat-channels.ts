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

/**
 * Retail's per-channel command prefixes, the way players actually switch
 * channel mid-sentence instead of clicking a tab. The same characters the
 * channel labels carry in lang/*.ts ("!Shout", "#Party", ...). General has
 * none -- it is what an unprefixed line goes to.
 */
export const CHAT_CHANNEL_PREFIX: Record<string, number> = {
  "!": ChatType.SHOUT,
  '"': ChatType.WHISPER,
  "+": ChatType.TRADE,
  "#": ChatType.PARTY,
  "@": ChatType.CLAN,
  $: ChatType.ALLIANCE,
  "%": ChatType.HERO_VOICE,
};

/** Inverse of CHAT_CHANNEL_PREFIX -- what marks a line in the merged "all" view. */
export const CHAT_CHANNEL_PREFIX_BY_CHANNEL: Record<number, string> = Object.fromEntries(
  Object.entries(CHAT_CHANNEL_PREFIX).map(([prefix, channel]) => [channel, prefix])
);

export interface ParsedChatInput {
  channel: number;
  text: string;
  /** Only ever set for ChatType.WHISPER. */
  target?: string;
}

/**
 * Splits a raw input line into the channel it addresses and what to send.
 *
 * An unprefixed line goes to `fallbackChannel` (the active tab). A prefixed
 * one overrides it, and whisper additionally eats the next whitespace-
 * delimited token as the target -- `"Sarah hello` is "hello" to Sarah, same
 * as retail. Returns the whisper target as undefined when it is missing, so
 * the caller can tell the player instead of dropping the line.
 */
export function parseChatInput(raw: string, fallbackChannel: number): ParsedChatInput {
  const prefixed = CHAT_CHANNEL_PREFIX[raw[0]];
  if (prefixed === undefined) {
    return { channel: fallbackChannel, text: raw.trim() };
  }

  const rest = raw.slice(1).trimStart();
  if (prefixed !== ChatType.WHISPER) {
    return { channel: prefixed, text: rest.trim() };
  }

  const separator = rest.search(/\s/);
  if (separator < 0) {
    // Just a name so far and nothing to say yet -- keep it as the target so
    // the caller reports the missing message, not a missing target.
    return { channel: ChatType.WHISPER, text: "", target: rest || undefined };
  }
  return {
    channel: ChatType.WHISPER,
    text: rest.slice(separator + 1).trim(),
    target: rest.slice(0, separator) || undefined,
  };
}

/**
 * Sendable channels that get no tab of their own. They are still sendable --
 * their prefix character is how you reach them (see CHAT_CHANNEL_PREFIX) --
 * and they are still read under All, which merges every channel.
 *
 * General is here because All *is* its tab, the way retail has no separate
 * General one: an unprefixed line typed under All goes out on GENERAL.
 */
const CHANNELS_WITHOUT_TAB = new Set<number>([
  ChatType.GENERAL,
  ChatType.SHOUT,
  ChatType.WHISPER,
  ChatType.HERO_VOICE,
]);

/** Chat window tab list. "all" is a client-side merged view, not a wire channel. */
export type ChatTab = "all" | number;
export const CHAT_TABS: ChatTab[] = [
  "all",
  ...SENDABLE_CHAT_CHANNELS.filter((channel) => !CHANNELS_WITHOUT_TAB.has(channel)),
];

export const CHAT_CHANNEL_LABEL_KEY: Record<number, string> = {
  [ChatType.GENERAL]: "chat.channels.general",
  [ChatType.SHOUT]: "chat.channels.shout",
  [ChatType.WHISPER]: "chat.channels.whisper",
  [ChatType.PARTY]: "chat.channels.party",
  [ChatType.CLAN]: "chat.channels.clan",
  [ChatType.TRADE]: "chat.channels.trade",
  [ChatType.ALLIANCE]: "chat.channels.alliance",
  [ChatType.HERO_VOICE]: "chat.channels.hero",
};

/*
 * The two maps below both exist because of one thing: on some channels the
 * sender name CreatureSay carries is not a sender.
 *
 * The server fills that field with the *receiving* player's own name for
 * announcements (AnnouncementManager.sendAnnouncements, and L2J's
 * AnnouncementsTable does the same), purely so CreatureSay's writer takes
 * its string branch rather than its character-id one. Printing it labelled
 * every announcement with the reader's own nickname.
 */

/**
 * Channels that print a fixed label in place of whatever name the packet
 * carried. A critical announcement is still an announcement, and retail
 * labels both the same way.
 */
export const CHAT_SENDER_LABEL_KEY: Record<number, string> = {
  [ChatType.ANNOUNCEMENT]: "chat.senders.announcement",
  [ChatType.CRITICAL_ANNOUNCE]: "chat.senders.announcement",
};

/**
 * Channels that print no label at all, just the line. SCREEN_ANNOUNCE lands
 * here rather than in the map above because retail draws it across the
 * screen rather than as a chat line, so there is no label of its own to
 * borrow -- but its name field is filler exactly the same way.
 */
export const CHANNELS_WITHOUT_SENDER = new Set<number>([ChatType.SCREEN_ANNOUNCE]);

/**
 * Client-only pseudo-channel for the server's answer to a chat attempt (see
 * CHAT_FEEDBACK_MESSAGE_IDS). Never appears on the wire and gets no tab of
 * its own. Negative so it can never collide with a real ChatType.
 */
export const CHAT_SYSTEM_CHANNEL = -1;

/**
 * Channels that survive the per-tab filter instead of being confined to
 * their own tab. None of these has a tab to sit in: an announcement is
 * addressed to everyone, and a chat refusal has to be readable from
 * whichever tab the player just typed into. Without this they were only
 * visible under All -- a player watching the Party tab would never see the
 * server say it is restarting.
 */
export const CHANNELS_IN_EVERY_TAB = new Set<number>([
  CHAT_SYSTEM_CHANNEL,
  ChatType.ANNOUNCEMENT,
  ChatType.CRITICAL_ANNOUNCE,
  ChatType.SCREEN_ANNOUNCE,
]);

/**
 * Taken from the retail palette in
 * {packages/assets-server/assets/highfive/datapack/chat-colors/default.json},
 * whose keys are the client's own channel names: CHAT_NORMAL, CHAT_SHOUT,
 * CHAT_TELL, CHAT_PARTY, CHAT_CLAN, CHAT_MARKET (trade), CHAT_ALLIANCE,
 * CHAT_ANNOUNCE, CHAT_HERO, CHAT_CRITICAL_ANNOUNCE, CHAT_SYSTEM.
 *
 * The channels that file does not name -- GM, petition, boat, friend, MSN,
 * battlefield, MPCC and the party-room ones -- keep the colors this window
 * shipped with, rather than a guess at which retail key they map to.
 */
export const CHAT_CHANNEL_COLOR: Record<number, string> = {
  [ChatType.GENERAL]: "#dcdcdc",
  [ChatType.SHOUT]: "#ff7200",
  [ChatType.WHISPER]: "#ff00ff",
  [ChatType.PARTY]: "#00ff00",
  [ChatType.CLAN]: "#7d77ff",
  [ChatType.GM]: "#ff4040",
  [ChatType.PETITION_PLAYER]: "#ff4040",
  [ChatType.PETITION_GM]: "#ff4040",
  [ChatType.TRADE]: "#eaa5f5",
  [ChatType.ALLIANCE]: "#77ff99",
  [ChatType.ANNOUNCEMENT]: "#80ffff",
  [ChatType.FRIEND]: "#80c0ff",
  [ChatType.HERO_VOICE]: "#408cff",
  [ChatType.CRITICAL_ANNOUNCE]: "#00ffff",
  [ChatType.SCREEN_ANNOUNCE]: "#ff9695",
  [ChatType.BATTLEFIELD]: "#ff8040",
  // CHAT_SYSTEM -- NPC chatter and this client's own chat-feedback lines.
  [ChatType.NPC_GENERAL]: "#b09b79",
  [ChatType.NPC_SHOUT]: "#b09b79",
  [CHAT_SYSTEM_CHANNEL]: "#b09b79",
};

const DEFAULT_CHAT_CHANNEL_COLOR = "#c8c8c8";

export function getChatChannelColor(channel: number): string {
  return CHAT_CHANNEL_COLOR[channel] ?? DEFAULT_CHAT_CHANNEL_COLOR;
}
