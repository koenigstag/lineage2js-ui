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

// Only Actions enum members that are actually reachable via client.action()
// (RequestActionUse) belong here. Attack/next-target/trade/pick-up-item (Basic
// tab) and invite/leave/kick/transfer-leadership (Party tab) all use their own
// dedicated packets instead (CommandAttack, CommandNextTarget,
// CommandRequestJoinParty, ...) -- see the Actions window scoping discussion.
// Party has no Actions-enum member at all yet, so it stays empty until those
// commands get their own place in the window.
export const USER_ACTIONS: Record<ActionCategory, Action[]> = {
  basic: [{ code: Actions.SIT_STAND }, { code: Actions.WALK_RUN }, { code: Actions.MOUNT_DISMOUNT }],
  party: [],
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
