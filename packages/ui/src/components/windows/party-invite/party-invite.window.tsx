import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useGameStore } from "../../../stores/StoreContext";
import { getPartyDistributionLabel } from "../../../config/party-distribution-mapping";
import { t } from "../../../lang/lang";

const WIDTH = 240;

// Shown while GameStore.partyInviteRequest is set (AskJoinParty ->
// "PartyRequest") -- windows-root.tsx collapses this window entirely when
// there's no pending invite, same hide-when-empty treatment as the
// resurrect/trade-request windows. No close button: accept/decline are the
// only ways out.
export const PartyInviteConfirmContent = observer(function PartyInviteConfirmContent() {
  const game = useGameStore();
  const request = game.partyInviteRequest;

  if (!request) {
    return null;
  }

  const message = t("partyInvite.message", {
    name: request.requestorName,
    loot: getPartyDistributionLabel(request.distributionType),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, width: WIDTH }}>
      <span style={{ color: "#e6d9be", fontSize: 12, lineHeight: 1.4 }}>{message}</span>
      <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
        <BaseButton onClick={() => game.acceptPartyInvite()}>{t("partyInvite.acceptButton")}</BaseButton>
        <BaseButton onClick={() => game.declinePartyInvite()}>{t("partyInvite.declineButton")}</BaseButton>
      </div>
    </div>
  );
});
