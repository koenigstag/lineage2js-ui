import { Actions } from "../enums/Actions";
import RequestActionUse from "../network/outgoing/game/RequestActionUse";

export type ActionPacketFactory = (ctrlPressed?: boolean, shiftPressed?: boolean) => RequestActionUse;

// One RequestActionUse factory per Actions enum member, keyed by name -- lets
// CommandAction send any of them without a dedicated Command class per
// action (see CommandSitStand for what that looked like for just one).
// Object.entries() on a numeric enum also yields its auto-generated reverse
// (value -> name) entries, hence the numeric-value filter.
export const actionPackets: Record<keyof typeof Actions, ActionPacketFactory> = Object.fromEntries(
  Object.entries(Actions)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .map(([key, actionId]) => [
      key,
      (ctrlPressed = false, shiftPressed = false) => new RequestActionUse(actionId, ctrlPressed, shiftPressed),
    ])
) as Record<keyof typeof Actions, ActionPacketFactory>;
