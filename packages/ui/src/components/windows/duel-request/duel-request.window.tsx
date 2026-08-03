import { useEffect, useState } from "react";
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
// this client has no duel-in-progress UI yet. Always counts down (see
// GameStore's DUEL_REQUEST_TIMEOUT_MS) and auto-declines at zero, unlike
// party/trade invites which have no client-facing expiry at all.
export const DuelRequestConfirmContent = observer(function DuelRequestConfirmContent() {
  const game = useGameStore();
  const request = game.duelRequest;
  const expiresAt = request?.expiresAt;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (expiresAt === undefined) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (expiresAt !== undefined && now >= expiresAt) {
      game.declineDuel();
    }
  }, [game, expiresAt, now]);

  if (!request) {
    return null;
  }

  const remainingSeconds = Math.max(0, Math.ceil((request.expiresAt - now) / 1000));
  const message = t(request.partyDuel ? "duelRequest.partyMessage" : "duelRequest.message", {
    name: request.requestorName,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: WIDTH }}>
      <span style={{ color: "#e6d9be", fontSize: 12, lineHeight: 1.4 }}>{message}</span>
      <span style={{ color: "#a99a7a", fontSize: 11, textAlign: "center" }}>
        {t("duelRequest.expiresIn", { seconds: remainingSeconds })}
      </span>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <BaseButton onClick={() => game.acceptDuel()}>{t("duelRequest.acceptButton")}</BaseButton>
        <BaseButton onClick={() => game.declineDuel()}>{t("duelRequest.declineButton")}</BaseButton>
      </div>
    </div>
  );
});
