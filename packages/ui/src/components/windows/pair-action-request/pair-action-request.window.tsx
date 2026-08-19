import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useGameStore } from "../../../stores/StoreContext";
import { getActionName } from "../../../config/user-actions";
import { t } from "../../../lang/lang";

const WIDTH = 240;

// Shown while GameStore.pairActionRequest is set (ExAskCoupleAction ->
// "PairActionRequest", e.g. High Five/Exchange Bows/Couple Dance) --
// windows-root.tsx collapses this window entirely when there's no pending
// request, same hide-when-empty treatment as the other confirm windows. No
// close button: accept/decline are the only ways out. Accepting only sends
// the answer -- this client has no couple-action animation playback. No
// countdown: ExAskCoupleAction carries no expiry field on the wire, same as
// party/trade invites.
export const PairActionRequestConfirmContent = observer(function PairActionRequestConfirmContent() {
  const game = useGameStore();
  const request = game.pairActionRequest;

  if (!request) {
    return null;
  }

  const message = t("pairActionRequest.message", {
    name: request.requesterName,
    action: getActionName({ code: request.actionId }),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: WIDTH }}>
      <span style={{ color: "#e6d9be", fontSize: 12, lineHeight: 1.4 }}>{message}</span>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <BaseButton onClick={() => game.acceptPairAction()}>{t("pairActionRequest.acceptButton")}</BaseButton>
        <BaseButton onClick={() => game.declinePairAction()}>{t("pairActionRequest.declineButton")}</BaseButton>
      </div>
    </div>
  );
});
