import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useGameStore } from "../../../stores/StoreContext";
import { t } from "../../../lang/lang";

const WIDTH = 240;

// Shown while GameStore.duelRequest is set (ExDuelAskStart ->
// "RequestedDuel") -- windows-root.tsx collapses this window entirely when
// there's no pending request, same hide-when-empty treatment as the
// resurrect/party-invite/trade-request windows. No close button:
// accept/decline are the only ways out. Accepting only sends the answer --
// this client has no duel-in-progress UI yet.
export const DuelRequestConfirmContent = observer(function DuelRequestConfirmContent() {
  const game = useGameStore();
  const request = game.duelRequest;

  if (!request) {
    return null;
  }

  const message = t(request.partyDuel ? "duelRequest.partyMessage" : "duelRequest.message", {
    name: request.requestorName,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: WIDTH }}>
      <span style={{ color: "#e6d9be", fontSize: 12, lineHeight: 1.4 }}>{message}</span>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <BaseButton onClick={() => game.acceptDuel()}>{t("duelRequest.acceptButton")}</BaseButton>
        <BaseButton onClick={() => game.declineDuel()}>{t("duelRequest.declineButton")}</BaseButton>
      </div>
    </div>
  );
});
