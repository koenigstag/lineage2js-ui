export { default as Client } from "./Client";

// Not part of the network/incoming barrel (packet classes stay internal),
// but needed to type Client.requestCharacterTemplates()'s return value.
export type { CharacterTemplate } from "./network/incoming/game/RequestNewCharacterSuccess";

export * from "./mmocore";
export * from "./network";
export * from "./entities";
export * from "./enums";
export type * from "./events";
