import { observer } from "mobx-react-lite";
import { BaseButton } from "../../core/buttons/base.button";
import { useSessionStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { t } from "../../../lang/lang";

export interface AccountsMenuProps {
  onSelectAccount: (login: string) => void;
}

export const AccountsMenu = observer(function AccountsMenu({ onSelectAccount }: AccountsMenuProps) {
  const session = useSessionStore();

  if (session.knownAccounts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: MENU_Z_INDEX,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 12,
      }}
    >
      <span style={{ color: "#999999", fontSize: 12, textTransform: "uppercase" }}>{t("accounts.title")}</span>
      {session.knownAccounts.map(({ login }) => (
        <div key={login} style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <span style={{ color: "#999999" }}>{login}</span>
          <BaseButton onClick={() => onSelectAccount(login)} style={{ padding: 0 }}>
            <span style={{ fontSize: 10 }}>➜</span>
          </BaseButton>
        </div>
      ))}
    </div>
  );
});
