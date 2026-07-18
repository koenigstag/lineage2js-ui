import { BaseButton } from "../../core/buttons/base.button";
import { getKnownAccounts } from "../../../lib/session";

export interface AccountsMenuProps {
  onSelectAccount: (login: string) => void;
}

export function AccountsMenu({ onSelectAccount }: AccountsMenuProps) {
  const accounts = getKnownAccounts();

  if (accounts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        backgroundColor: "#1a1a1a",
        border: "1px solid #444444",
        borderRadius: 4,
        padding: 12,
      }}
    >
      <span style={{ color: "#999999", fontSize: 12, textTransform: "uppercase" }}>Known accounts</span>
      {accounts.map(({ login }) => (
        <div key={login} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#999999" }}>{login}</span>
          <BaseButton onClick={() => onSelectAccount(login)}>
            <span style={{ fontSize: 10 }}>➜</span>
          </BaseButton>
        </div>
      ))}
    </div>
  );
}
