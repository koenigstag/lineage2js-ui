import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useGameStore } from "../../../stores/StoreContext";
import { t } from "../../../lang/lang";

const WIDTH = 240;

// Shown while GameStore.tradeRequest is set (SendTradeRequest ->
// "TradeRequest") -- windows-root.tsx collapses this window entirely when
// there's no pending request, same hide-when-empty treatment as the
// resurrect/party-invite windows. No close button: accept/decline are the
// only ways out. Accepting only sends the answer -- this client has no
// trade session UI yet (see GameStore.tradeRequest's field comment).
export const TradeRequestConfirmContent = observer(function TradeRequestConfirmContent() {
  const game = useGameStore();
  const request = game.tradeRequest;

  if (!request) {
    return null;
  }

  const message = t("tradeRequest.message", {
    name: request.requesterName || t("tradeRequest.unknownPlayer"),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: WIDTH }}>
      <span style={{ color: "#e6d9be", fontSize: 12, lineHeight: 1.4 }}>{message}</span>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <BaseButton onClick={() => game.acceptTradeRequest()}>{t("tradeRequest.acceptButton")}</BaseButton>
        <BaseButton onClick={() => game.declineTradeRequest()}>{t("tradeRequest.declineButton")}</BaseButton>
      </div>
    </div>
  );
});
