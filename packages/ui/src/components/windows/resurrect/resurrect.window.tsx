import { useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useGameStore } from "../../../stores/StoreContext";
import { t } from "../../../lang/lang";

const WIDTH = 240;

// Shown while GameStore.resurrectRequest is set (a ConfirmDlg with
// isResurrect=true) -- windows-root.tsx collapses this window entirely when
// there's no pending request, same hide-when-empty treatment as
// party-char-info/target-select. No close button: accept/decline (see
// GameStore.acceptResurrect/declineResurrect) are the only ways out.
export const ResurrectConfirmContent = observer(function ResurrectConfirmContent() {
  const game = useGameStore();
  const request = game.resurrectRequest;
  const expiresAt = request?.expiresAt;
  const [now, setNow] = useState(() => Date.now());

  // Only the Charm of Courage self-res prompt carries a timeout (see
  // resurrectRequest's field comment) -- a normal party/priest request has
  // no expiresAt and just waits.
  useEffect(() => {
    if (expiresAt === undefined) {
      return;
    }
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  useEffect(() => {
    if (expiresAt !== undefined && now >= expiresAt) {
      game.declineResurrect();
    }
  }, [game, expiresAt, now]);

  if (!request) {
    return null;
  }

  const remainingSeconds = expiresAt !== undefined ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: WIDTH }}>
      <span style={{ color: "#e6d9be", fontSize: 12, lineHeight: 1.4 }}>{request.message}</span>
      {remainingSeconds !== undefined && (
        <span style={{ color: "#a99a7a", fontSize: 11, textAlign: "center" }}>
          {t("resurrect.expiresIn", { seconds: remainingSeconds })}
        </span>
      )}
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <BaseButton onClick={() => game.acceptResurrect()}>{t("resurrect.acceptButton")}</BaseButton>
        <BaseButton onClick={() => game.declineResurrect()}>{t("resurrect.declineButton")}</BaseButton>
      </div>
    </div>
  );
});
