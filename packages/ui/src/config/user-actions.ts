import { Actions } from "@lineage2js/network";
import { t } from "../lang/lang";

export type ActionCategory = "basic" | "party" | "target" | "social" | "pet";

export interface Action {
  code: Actions;
}

/** Display name for an action, from the id->name table loaded by UiStore.loadActionNames() (see lang.ts's "action.name.<id>" special case). */
export function getActionName(action: Action): string {
  return t(`action.name.${action.code}`);
}

// Not every entry here is actually dispatched via client.action()
// (RequestActionUse) once clicks are wired up -- Attack/Next Target/Trade/
// Pick Up/Assist/private-store/party actions all have their own dedicated
// packets/commands in this codebase (CommandAttack, CommandNextTarget,
// CommandRequestJoinParty, ...) rather than RequestActionUse(Actions.code),
// same as real L2. They're still listed by Actions-enum code here purely for
// icon/name lookup (getActionIconUrl/getActionName) -- no slot in this
// window has click dispatch wired yet (see slot.component.tsx), so this is
// icon/tooltip-only for now regardless.
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
  ],
  party: [
    { code: Actions.INVITE },
    { code: Actions.LEAVE_PARTY },
    { code: Actions.DISMISS_PARTY_MEMBER },
    { code: Actions.CHANGE_PARTY_LEADER },
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
    { code: Actions.PET_UNSUMMON },
    { code: Actions.PET_MOVE_TO_TARGET },
    { code: Actions.SERVITOR_CHANGE_MOVEMENT_MODE },
    { code: Actions.SERVITOR_ATTACK },
    { code: Actions.SERVITOR_SOP },
    { code: Actions.SERVITOR_UNSUMMON },
    { code: Actions.SERVITOR_MOVE_TO_TARGET },
  ],
};
