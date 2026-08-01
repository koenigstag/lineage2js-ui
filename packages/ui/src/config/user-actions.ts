import { Actions } from "@lineage2js/network";
import type { GameStore } from "../stores/GameStore";
import type { SlotContent } from "../components/windows/core/slot.component";
import { getActionIconUrl } from "./icon-urls";
import { t } from "../lang/lang";

export type ActionCategory = "basic" | "party" | "target" | "social" | "pet";

/**
 * Every entry has a real Actions-enum id (icon/name always resolve via
 * getActionIconUrl/getActionName off `code`), but `code` alone doesn't mean
 * it's dispatched via RequestActionUse -- Attack/Next Target/Trade/Pick Up/
 * Assist/private-store/party/Recommend actions all have their own dedicated
 * packets/commands elsewhere in this codebase (CommandAttack,
 * CommandNextTarget, CommandRequestJoinParty, GameStore.recommend(), ...),
 * same as real L2. `dispatch`/`isEnabled` are only set for the ones actually
 * wired to a click here; the rest stay icon/tooltip-only for now (see
 * slot.component.tsx).
 */
export interface Action {
  code: Actions;
  dispatch?(game: GameStore): void;
  isEnabled?(game: GameStore): boolean;
}

/** Display name for an action, from the id->name table loaded by UiStore.loadActionNames() (see lang.ts's "action.name.<id>" special case). */
export function getActionName(action: Action): string {
  return t(`action.name.${action.code}`);
}

export interface ActionSlotParams {
  code: Actions;
  /** "pet" gets the pet-action gradient, everything else (including hotbar shortcuts, which don't carry a category) the regular action one. */
  category?: ActionCategory;
  name?: string;
}

/** Builds the Slot component's content for an action icon -- no full/short tooltip split like Skill/Item, actions only ever show their name. */
export function getActionSlotContent({ code, category, name }: ActionSlotParams): SlotContent {
  return {
    type: category === "pet" ? "pet-action" : "action",
    data: { code, category },
    iconUrl: getActionIconUrl(code),
    tooltip: { kind: "simple", name: name ?? getActionName({ code }) },
  };
}

const RECOMMEND: Action = {
  // Not handled by RequestActionUse in the H5 reference server -- sent via
  // RequestVoteNew instead (see Actions.RECOMMEND's own comment and
  // GameStore.recommend()).
  code: Actions.RECOMMEND,
  dispatch: (game) => game.recommend(),
  // Mirrors GameStore.recommend()'s own guard (player target + recomms left)
  // so the slot visibly dims instead of silently no-opping on click.
  isEnabled: (game) => Boolean(game.target && !game.target.creatureKind) && game.charInfo.recommLeft > 0,
};

export const USER_ACTIONS: Record<ActionCategory, Action[]> = {
  basic: [
    { code: Actions.SIT_STAND },
    { code: Actions.WALK_RUN },
    { code: Actions.ATTACK },
    { code: Actions.EXCHANGE },
    { code: Actions.NEXT_TARGET },
    { code: Actions.PICK_UP },
    { code: Actions.ASSIST },
    { code: Actions.PRIVATE_STORE_SELL },
    { code: Actions.PRIVATE_STORE_BUY },
    { code: Actions.PRIVATE_STORE_PACKAGE_SELL },
    { code: Actions.FIND_STORE },
    RECOMMEND,
    { code: Actions.DUEL },
    { code: Actions.MINI_GAME },
  ],
  party: [
    { code: Actions.INVITE },
    { code: Actions.LEAVE_PARTY },
    { code: Actions.DISMISS_PARTY_MEMBER },
    { code: Actions.CHANGE_PARTY_LEADER },
    { code: Actions.PARTY_DUEL },
  ],
  // Not a real client tab -- placeholder for target-related actions
  // (attack/next target/assist/pick up/exchange), still undecided which of
  // those belong here vs. basic. Left empty on purpose for now.
  target: [],
  social: [
    { code: Actions.SOCIAL_GREETING },
    { code: Actions.SOCIAL_VICROTY },
    { code: Actions.SOCIAL_ADVANCE },
    { code: Actions.SOCIAL_YES },
    { code: Actions.SOCIAL_NO },
    { code: Actions.SOCIAL_BOW },
    { code: Actions.SOCIAL_UNWARE },
    { code: Actions.SOCIAL_WAITING },
    { code: Actions.SOCIAL_LAUGH },
    { code: Actions.SOCIAL_APPLAUD },
    { code: Actions.SOCIAL_DANCE },
    { code: Actions.SOCIAL_SORROW },
    { code: Actions.SOCIAL_CHARM },
    { code: Actions.SOCIAL_SHYNESS },
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
