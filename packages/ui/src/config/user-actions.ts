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
  id: number;
  code: Actions;
  dispatch?(game: GameStore): void;
  /** Click-time guard, checked right before dispatch -- does not affect the slot's visual disabled state (see this file's doc comment above). */
  isEnabled?(game: GameStore): boolean;
}

/** Display name for an action, from the id->name table loaded by DatapackStore.loadActionNames() (see lang.ts's "action.name.<id>" special case). */
export function getActionName(action: Pick<Action, 'code'>): string {
  return t(`action.name.${action.code}`);
}

/** Looks up the shared Action definition (dispatch/isEnabled) for a hotbar ACTION shortcut's TargetId -- same source of truth actions.window.tsx renders from, so hotbar activation doesn't reimplement any of its per-action guards. */
export function findActionByCode(code: Actions): Action | undefined {
  for (const actions of Object.values(USER_ACTIONS)) {
    const found = actions.find((action) => action.code === code);
    if (found) {
      return found;
    }
  }
  return undefined;
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
  id: number;
  code: Actions;
  /** "pet" gets the pet-action gradient, everything else (including hotbar shortcuts, which don't carry a category) the regular action one. */
  category?: ActionCategory;
  name?: string;
}

/** Builds the Slot component's content for an action icon -- no full/short tooltip split like Skill/Item, actions only ever show their name. */
export function getActionSlotContent({ id, code, category, name }: ActionSlotParams): SlotContent {
  return {
    type: PAIR_ACTION_CODES.has(code) ? "pair-action" : category === "pet" ? "pet-action" : "action",
    data: { code, category },
    iconUrl: getActionIconUrl(id),
    tooltip: { kind: "simple", name: name ?? getActionName({ code }) },
  };
}

/** An action with no precondition beyond the server's ExBasicActionList check (already reflected in the slot's visual state) -- just fires RequestActionUse. */
function requestActionUse(id: number, code: Actions): Action {
  return {
    id,
    code,
    dispatch: (game) => game.useBasicAction(Actions[code] as keyof typeof Actions),
  };
}

/** A player-target-required guard shared by Duel/Trade/party-duel. */
function requiresPlayerTarget(game: GameStore): boolean {
  return Boolean(game.target && !game.target.creatureKind);
}

function pairAction(id: number, code: Actions, actionKey: "EXCHANGE_BOWS" | "HIGH_FIVE" | "COUPLE_DANCE"): Action {
  return {
    id,
    code,
    dispatch: (game) => game.requestPairAction(actionKey),
    // Mirrors GameStore.requestPairAction()'s own guard (a different player target).
    isEnabled: (game) => requiresPlayerTarget(game) && game.target!.objectId !== game.me,
  };
}

const RECOMMEND: Action = {
  id: 40,
  // Not handled by RequestActionUse in the H5 reference server -- sent via
  // RequestVoteNew instead (see Actions.RECOMMEND's own comment and
  // GameStore.recommend()).
  code: Actions.RECOMMEND,
  dispatch: (game) => game.recommend(),
  // Mirrors GameStore.recommend()'s own guard (player target + recomms left).
  isEnabled: (game) => requiresPlayerTarget(game) && game.charInfo.recommLeft > 0,
};

const ATTACK: Action = {
  id: 3,
  code: Actions.ATTACK,
  dispatch: (game) => game.attack(),
  isEnabled: (game) => Boolean(game.target),
};

const ASSIST: Action = {
  id: 10,
  code: Actions.ASSIST,
  dispatch: (game) => game.assist(),
  // Mirrors GameStore.assist()'s own guard (target must be a party member) --
  // the "does that member have a known target" half is checked inside
  // dispatch itself, not here, since it can't be answered from TargetSnapshot.
  isEnabled: (game) => {
    const target = game.target;
    return Boolean(target && game.party.some((member) => member.ObjectId === target.objectId));
  },
};

const NEXT_TARGET: Action = {
  id: 7,
  code: Actions.NEXT_TARGET,
  dispatch: (game) => game.selectNextTarget(),
};

const PICK_UP: Action = {
  id: 8,
  code: Actions.PICK_UP,
  dispatch: (game) => game.pickUpNearestItem(),
};

const INVITE: Action = {
  id: 11,
  code: Actions.INVITE,
  dispatch: (game) => game.inviteToParty(),
  // Mirrors GameStore.inviteToParty()'s own guard (player target, not already in the party).
  isEnabled: (game) => {
    const target = game.target;
    return Boolean(target && !target.creatureKind && !game.party.some((member) => member.ObjectId === target.objectId));
  },
};

const LEAVE_PARTY: Action = {
  id: 12,
  code: Actions.LEAVE_PARTY,
  dispatch: (game) => game.leaveParty(),
  isEnabled: (game) => game.party.length > 0,
};

const DUEL: Action = {
  id: 47,
  code: Actions.DUEL,
  dispatch: (game) => game.challengeToDuel(),
  // Mirrors GameStore.challengeToDuel()'s own guard (player target).
  isEnabled: requiresPlayerTarget,
};

const PARTY_DUEL: Action = {
  id: 49,
  code: Actions.PARTY_DUEL,
  dispatch: (game) => game.challengeToDuel(true),
  isEnabled: requiresPlayerTarget,
};

const EXCHANGE: Action = {
  id: 5,
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
  id: 13,
  code: Actions.DISMISS_PARTY_MEMBER,
  dispatch: (game) => game.dismissPartyMember(),
  // Mirrors GameStore.dismissPartyMember()'s own guard.
  isEnabled: canManagePartyTarget,
};

const CHANGE_PARTY_LEADER: Action = {
  id: 41,
  code: Actions.CHANGE_PARTY_LEADER,
  dispatch: (game) => game.changePartyLeader(),
  // Mirrors GameStore.changePartyLeader()'s own guard.
  isEnabled: canManagePartyTarget,
};

const EXCHANGE_BOWS = pairAction(60, Actions.EXCHANGE_BOWS, "EXCHANGE_BOWS");
const HIGH_FIVE = pairAction(61, Actions.HIGH_FIVE, "HIGH_FIVE");
const COUPLE_DANCE = pairAction(62, Actions.COUPLE_DANCE, "COUPLE_DANCE");

export const USER_ACTIONS: Record<ActionCategory, Action[]> = {
  basic: [
    requestActionUse(1, Actions.SIT_STAND),
    requestActionUse(2, Actions.WALK_RUN),
    ATTACK,
    EXCHANGE,
    NEXT_TARGET,
    PICK_UP,
    ASSIST,
    requestActionUse(18, Actions.PRIVATE_STORE_SELL),
    requestActionUse(28, Actions.PRIVATE_STORE_BUY),
    requestActionUse(50, Actions.PRIVATE_STORE_PACKAGE_SELL),
    // FIND_STORE/MINI_GAME have no case in RequestActionUse's switch either
    // (confirmed against the reference server, same as PICK_UP) -- unlike
    // Pick Up though, there's no alternate click-based mechanism to fall
    // back on: both are purely client-side UI panels (private store search,
    // Cube Game HUD fed entirely by server-pushed ExCubeGame* packets) that
    // this client hasn't built yet, so no dispatch until they exist.
    { id: 46, code: Actions.FIND_STORE },
    RECOMMEND,
    DUEL,
    { id: 52, code: Actions.MINI_GAME },
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
  target: [
    { id: 67, code: -1 },
    { id: 68, code: -1 },
    { id: 69, code: -1 },
    { id: 70, code: -1 },
    { id: 71, code: -1 },
    { id: 72, code: -1 },
    { id: 73, code: -1 },
    { id: 74, code: -1 },
  ],
  social: [
    requestActionUse(15, Actions.SOCIAL_GREETING),
    requestActionUse(16, Actions.SOCIAL_VICROTY),
    requestActionUse(17, Actions.SOCIAL_ADVANCE),
    requestActionUse(20, Actions.SOCIAL_YES),
    requestActionUse(21, Actions.SOCIAL_NO),
    requestActionUse(22, Actions.SOCIAL_BOW),
    requestActionUse(29, Actions.SOCIAL_UNWARE),
    requestActionUse(30, Actions.SOCIAL_WAITING),
    requestActionUse(31, Actions.SOCIAL_LAUGH),
    requestActionUse(32, Actions.SOCIAL_APPLAUD),
    requestActionUse(33, Actions.SOCIAL_DANCE),
    requestActionUse(34, Actions.SOCIAL_SORROW),
    requestActionUse(51, Actions.SOCIAL_CHARM),
    requestActionUse(55, Actions.SOCIAL_SHYNESS),
    EXCHANGE_BOWS,
    HIGH_FIVE,
    COUPLE_DANCE,
  ],
  pet: [
    { id: 36, code: Actions.MOUNT_DISMOUNT },
    // { code: Actions.PET_CHANGE_MOVEMENT_MODE },
    // { code: Actions.PET_ATTACK },
    // { code: Actions.PET_STOP },
    // { code: Actions.PET_PICKUP },
    // { code: Actions.PET_UNSUMMON },
    // { code: Actions.PET_MOVE_TO_TARGET },
    // { code: Actions.SERVITOR_CHANGE_MOVEMENT_MODE },
    // { code: Actions.SERVITOR_ATTACK },
    // { code: Actions.SERVITOR_SOP },
    // { code: Actions.SERVITOR_UNSUMMON },
    // { code: Actions.SERVITOR_MOVE_TO_TARGET },
  ],
};

export const getActionIdByCode = (code: Actions): number | undefined => {
  for (const category of Object.values(USER_ACTIONS)) {
    for (const action of category) {
      if (action.code === code) {
        return action.id;
      }
    }
  }
  return undefined;
}
