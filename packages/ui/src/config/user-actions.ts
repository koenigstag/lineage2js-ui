import { Actions } from "@lineage2js/network";
import type { GameStore } from "../stores/GameStore";
import type { SlotContent } from "../components/windows/core/slot.component";
import { getActionIconUrl } from "./icon-urls";
import { t } from "../lang/lang";

export type ActionCategory = "basic" | "party" | "target" | "social" | "pet";

/**
 * Every entry has a real Actions-enum id (icon/name always resolve via
 * getActionIconUrl/getActionName off `code`), but `code` alone doesn't mean
 * it's dispatched via RequestActionUse -- Attack/Trade/Recommend/party
 * membership actions all have their own dedicated packets/commands
 * elsewhere in this codebase (CommandAttack, TradeRequest,
 * GameStore.recommend(), RequestOustPartyMember, ...), same as real L2.
 * `dispatch` is only set for the ones actually wired to a click here; pet/
 * servitor actions stay icon/tooltip-only since this client doesn't model
 * summon state yet. The slot's dimmed/enabled look always comes from the
 * server's ExBasicActionList (GameStore.isBasicActionAllowed) -- `isEnabled`
 * is a separate, purely click-time guard for a precondition dispatch itself
 * needs (e.g. RECOMMEND below requiring a valid target), not a visual state.
 */
export interface Action {
  code: Actions;
  dispatch?(game: GameStore): void;
  /** Click-time guard, checked right before dispatch -- does not affect the slot's visual disabled state (see this file's doc comment above). */
  isEnabled?(game: GameStore): boolean;
}

/** Display name for an action, from the id->name table loaded by UiStore.loadActionNames() (see lang.ts's "action.name.<id>" special case). */
export function getActionName(action: Action): string {
  return t(`action.name.${action.code}`);
}

// EXCHANGE_BOWS/HIGH_FIVE/COUPLE_DANCE need the target's agreement (server
// relays the request as ExAskCoupleAction -- see GameStore.pairActionRequest)
// unlike every other social action, hence their own icon-frame gradient
// (already defined in icon-frame.component.tsx, just never used until now).
const PAIR_ACTION_CODES: ReadonlySet<Actions> = new Set([
  Actions.EXCHANGE_BOWS,
  Actions.HIGH_FIVE,
  Actions.COUPLE_DANCE,
]);

export interface ActionSlotParams {
  code: Actions;
  /** "pet" gets the pet-action gradient, everything else (including hotbar shortcuts, which don't carry a category) the regular action one. */
  category?: ActionCategory;
  name?: string;
}

/** Builds the Slot component's content for an action icon -- no full/short tooltip split like Skill/Item, actions only ever show their name. */
export function getActionSlotContent({ code, category, name }: ActionSlotParams): SlotContent {
  return {
    type: PAIR_ACTION_CODES.has(code) ? "pair-action" : category === "pet" ? "pet-action" : "action",
    data: { code, category },
    iconUrl: getActionIconUrl(code),
    tooltip: { kind: "simple", name: name ?? getActionName({ code }) },
  };
}

/** An action with no precondition beyond the server's ExBasicActionList check (already reflected in the slot's visual state) -- just fires RequestActionUse. */
function simpleAction(code: Actions): Action {
  return {
    code,
    dispatch: (game) => game.useBasicAction(Actions[code] as keyof typeof Actions),
  };
}

/** A player-target-required guard shared by Duel/Trade/party-duel. */
function requiresPlayerTarget(game: GameStore): boolean {
  return Boolean(game.target && !game.target.creatureKind);
}

function pairAction(code: Actions, actionKey: "EXCHANGE_BOWS" | "HIGH_FIVE" | "COUPLE_DANCE"): Action {
  return {
    code,
    dispatch: (game) => game.requestPairAction(actionKey),
    // Mirrors GameStore.requestPairAction()'s own guard (a different player target).
    isEnabled: (game) => requiresPlayerTarget(game) && game.target!.objectId !== game.me,
  };
}

const RECOMMEND: Action = {
  // Not handled by RequestActionUse in the H5 reference server -- sent via
  // RequestVoteNew instead (see Actions.RECOMMEND's own comment and
  // GameStore.recommend()).
  code: Actions.RECOMMEND,
  dispatch: (game) => game.recommend(),
  // Mirrors GameStore.recommend()'s own guard (player target + recomms left).
  isEnabled: (game) => requiresPlayerTarget(game) && game.charInfo.recommLeft > 0,
};

const ATTACK: Action = {
  code: Actions.ATTACK,
  dispatch: (game) => game.attack(),
  isEnabled: (game) => Boolean(game.target),
};

const ASSIST: Action = {
  code: Actions.ASSIST,
  dispatch: (game) => game.assist(),
  // Mirrors GameStore.assist()'s own guard (target must be a party member).
  isEnabled: (game) => {
    const target = game.target;
    return Boolean(target && game.party.some((member) => member.ObjectId === target.objectId));
  },
};

const NEXT_TARGET: Action = {
  code: Actions.NEXT_TARGET,
  dispatch: (game) => game.selectNextTarget(),
};

const PICK_UP: Action = {
  code: Actions.PICK_UP,
  dispatch: (game) => game.pickUpNearestItem(),
};

const INVITE: Action = {
  code: Actions.INVITE,
  dispatch: (game) => game.inviteToParty(),
  // Mirrors GameStore.inviteToParty()'s own guard (player target, not already in the party).
  isEnabled: (game) => {
    const target = game.target;
    return Boolean(target && !target.creatureKind && !game.party.some((member) => member.ObjectId === target.objectId));
  },
};

const LEAVE_PARTY: Action = {
  code: Actions.LEAVE_PARTY,
  dispatch: (game) => game.leaveParty(),
  isEnabled: (game) => game.party.length > 0,
};

const DUEL: Action = {
  code: Actions.DUEL,
  dispatch: (game) => game.challengeToDuel(),
  // Mirrors GameStore.challengeToDuel()'s own guard (player target).
  isEnabled: requiresPlayerTarget,
};

const PARTY_DUEL: Action = {
  code: Actions.PARTY_DUEL,
  dispatch: (game) => game.challengeToDuel(true),
  isEnabled: requiresPlayerTarget,
};

const EXCHANGE: Action = {
  code: Actions.EXCHANGE,
  dispatch: (game) => game.requestTrade(),
  // Mirrors GameStore.requestTrade()'s own guard (player target).
  isEnabled: requiresPlayerTarget,
};

/** Shared by Dismiss Party Member/Change Party Leader (must be party leader, target a different player in the party). */
function canManagePartyTarget(game: GameStore): boolean {
  const target = game.target;
  return Boolean(
    target &&
      !target.creatureKind &&
      target.objectId !== game.me &&
      game.isPartyLeader() &&
      game.party.some((member) => member.ObjectId === target.objectId)
  );
}

const DISMISS_PARTY_MEMBER: Action = {
  code: Actions.DISMISS_PARTY_MEMBER,
  dispatch: (game) => game.dismissPartyMember(),
  // Mirrors GameStore.dismissPartyMember()'s own guard.
  isEnabled: canManagePartyTarget,
};

const CHANGE_PARTY_LEADER: Action = {
  code: Actions.CHANGE_PARTY_LEADER,
  dispatch: (game) => game.changePartyLeader(),
  // Mirrors GameStore.changePartyLeader()'s own guard.
  isEnabled: canManagePartyTarget,
};

const EXCHANGE_BOWS = pairAction(Actions.EXCHANGE_BOWS, "EXCHANGE_BOWS");
const HIGH_FIVE = pairAction(Actions.HIGH_FIVE, "HIGH_FIVE");
const COUPLE_DANCE = pairAction(Actions.COUPLE_DANCE, "COUPLE_DANCE");

export const USER_ACTIONS: Record<ActionCategory, Action[]> = {
  basic: [
    simpleAction(Actions.SIT_STAND),
    simpleAction(Actions.WALK_RUN),
    ATTACK,
    EXCHANGE,
    NEXT_TARGET,
    PICK_UP,
    ASSIST,
    simpleAction(Actions.PRIVATE_STORE_SELL),
    simpleAction(Actions.PRIVATE_STORE_BUY),
    simpleAction(Actions.PRIVATE_STORE_PACKAGE_SELL),
    simpleAction(Actions.FIND_STORE),
    RECOMMEND,
    DUEL,
    simpleAction(Actions.MINI_GAME),
  ],
  party: [
    INVITE,
    LEAVE_PARTY,
    DISMISS_PARTY_MEMBER,
    CHANGE_PARTY_LEADER,
    PARTY_DUEL,
  ],
  // Not a real client tab -- placeholder for target-related actions
  // (attack/next target/assist/pick up/exchange), still undecided which of
  // those belong here vs. basic. Left empty on purpose for now.
  target: [],
  social: [
    simpleAction(Actions.SOCIAL_GREETING),
    simpleAction(Actions.SOCIAL_VICROTY),
    simpleAction(Actions.SOCIAL_ADVANCE),
    simpleAction(Actions.SOCIAL_YES),
    simpleAction(Actions.SOCIAL_NO),
    simpleAction(Actions.SOCIAL_BOW),
    simpleAction(Actions.SOCIAL_UNWARE),
    simpleAction(Actions.SOCIAL_WAITING),
    simpleAction(Actions.SOCIAL_LAUGH),
    simpleAction(Actions.SOCIAL_APPLAUD),
    simpleAction(Actions.SOCIAL_DANCE),
    simpleAction(Actions.SOCIAL_SORROW),
    simpleAction(Actions.SOCIAL_CHARM),
    simpleAction(Actions.SOCIAL_SHYNESS),
    EXCHANGE_BOWS,
    HIGH_FIVE,
    COUPLE_DANCE,
  ],
  pet: [
    { code: Actions.MOUNT_DISMOUNT },
    { code: Actions.PET_CHANGE_MOVEMENT_MODE },
    { code: Actions.PET_ATTACK },
    { code: Actions.PET_STOP },
    { code: Actions.PET_PICKUP },
    { code: Actions.PET_UNSUMMON },
    { code: Actions.PET_MOVE_TO_TARGET },
    { code: Actions.SERVITOR_CHANGE_MOVEMENT_MODE },
    { code: Actions.SERVITOR_ATTACK },
    { code: Actions.SERVITOR_SOP },
    { code: Actions.SERVITOR_UNSUMMON },
    { code: Actions.SERVITOR_MOVE_TO_TARGET },
  ],
};
