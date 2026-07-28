import { rootStore } from "../stores/RootStore";
import { getItemName } from "./item-mapping";
import { getSkillName } from "./skill-mapping";

// Wire type tags from AbstractMessagePacket.ts (network package) -- kept in
// sync manually since the network package doesn't export them as a value.
const TYPE_TEXT = 0;
const TYPE_INT_NUMBER = 1;
const TYPE_NPC_NAME = 2;
const TYPE_ITEM_NAME = 3;
const TYPE_SKILL_NAME = 4;
const TYPE_CASTLE_NAME = 5;
const TYPE_LONG_NUMBER = 6;
const TYPE_ZONE_NAME = 7;
const TYPE_ELEMENT_NAME = 9;
const TYPE_INSTANCE_NAME = 10;
const TYPE_DOOR_NAME = 11;
const TYPE_PLAYER_NAME = 12;
const TYPE_SYSTEM_STRING = 13;

// Reactive read, not a stored field: UiStore.systemMessages loads
// asynchronously (see UiStore.loadSystemMessages()), same treatment as
// item-mapping.ts's getItemName(). English-only for now (no server-sent
// system message text, only numeric ids -- see AbstractMessagePacket.ts).
export function getSystemMessageTemplate(messageId: number): string | undefined {
  return rootStore.ui.systemMessages[messageId];
}

// Resolves one positional param to display text, based on its wire type tag.
// Types without a real lookup table here (npc/castle/instance/door/element
// names) fall back to a bracketed numeric id, same placeholder convention
// NpcInfo.ts already uses for unresolved npc names.
function formatParam(value: unknown, type: number | undefined): string {
  switch (type) {
    case TYPE_TEXT:
    case TYPE_PLAYER_NAME:
      return String(value);
    case TYPE_ITEM_NAME:
      return getItemName({ Id: value as number });
    case TYPE_SKILL_NAME: {
      const [skillId] = value as [number, number];
      return getSkillName({ Id: skillId });
    }
    case TYPE_ZONE_NAME: {
      const [x, y, z] = value as [number, number, number];
      return `(${x}, ${y}, ${z})`;
    }
    case TYPE_NPC_NAME:
      return `NPC #${value}`;
    case TYPE_CASTLE_NAME:
      return `Castle #${value}`;
    case TYPE_INSTANCE_NAME:
      return `Instance #${value}`;
    case TYPE_DOOR_NAME:
      return `Door #${value}`;
    case TYPE_ELEMENT_NAME:
      return `Element #${value}`;
    case TYPE_SYSTEM_STRING:
      return getSystemMessageTemplate(value as number) ?? `#${value}`;
    case TYPE_INT_NUMBER:
    case TYPE_LONG_NUMBER:
    default:
      return String(value);
  }
}

// Substitutes a template's $s1/$c1/... placeholders -- the letter is just a
// semantic hint (s=generic, c=character-like); both share one positional
// index space straight into params[]/paramTypes[] (1-based in the template).
export function formatSystemMessage(messageId: number, params: unknown[], paramTypes: number[]): string {
  const template = getSystemMessageTemplate(messageId);
  if (!template) {
    return `#${messageId}`;
  }
  return template.replace(/\$[sc](\d+)/g, (match, indexStr: string) => {
    const index = Number(indexStr) - 1;
    if (index < 0 || index >= params.length) {
      return match;
    }
    return formatParam(params[index], paramTypes[index]);
  });
}
