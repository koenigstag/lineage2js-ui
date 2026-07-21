import { forwardRef, useImperativeHandle, useState } from "react";
import { observer } from "mobx-react-lite";
import { BaseInput } from "../../core/inputs/base.input";
import { BaseButton } from "../../core/buttons/base.button";
import { useConfirmation } from "../../core/confirmation-modal";
import { useAlert } from "../../core/alert-modal";
import { useSessionStore } from "../../../stores/StoreContext";
import { MENU_Z_INDEX } from "../../../config/z-index";
import { t } from "../../../lang/lang";

export interface LoginMenuHandle {
  fillAccount: (login: string) => void;
}

export interface LoginMenuProps {
  onLoginSuccess: () => void;
}

export const LoginMenu = observer(
  forwardRef<LoginMenuHandle, LoginMenuProps>(function LoginMenu({ onLoginSuccess }, ref) {
    const session = useSessionStore();
    const [account, setAccount] = useState("");
    const [password, setPassword] = useState("");
    const { confirm, modal } = useConfirmation();
    const { alert, modal: alertModal } = useAlert();

    useImperativeHandle(ref, () => ({
      fillAccount: setAccount,
    }));

    async function handleLogin() {
      if (!account.trim() || !password.trim()) {
        return;
      }

      if (await session.login(account, password)) {
        onLoginSuccess();
      } else {
        await alert(session.error ?? t("login.loginFailed"));
      }
    }

    async function handleExit() {
      if (await confirm(t("common.exitGameConfirm"))) {
        window.close();
      }
    }

    return (
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: MENU_Z_INDEX,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          width: 240,
          backgroundColor: "#1a1a1a",
          border: "1px solid #444444",
          borderRadius: 4,
          padding: 16,
        }}
      >
        <BaseInput value={account} placeholder={t("login.idPlaceholder")} onChange={setAccount} />
        <BaseInput value={password} placeholder={t("login.pwdPlaceholder")} onChange={setPassword} type="password" />
        <div style={{ display: "flex", gap: 8 }}>
          <BaseButton onClick={handleLogin} disabled={session.isConnecting}>
            {session.isConnecting ? t("common.connecting") : t("login.loginButton")}
          </BaseButton>
          <BaseButton onClick={handleExit}>{t("login.exitButton")}</BaseButton>
        </div>
        {modal}
        {alertModal}
      </div>
    );
  })
);
