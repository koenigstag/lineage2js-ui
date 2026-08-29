import { useRef, useState } from "react";
import { Screen } from "../../core/screen.component";
import { LegalFooter } from "../../core/legal-footer.component";
import { TitleMenu } from "../../menus/title/title.menu";
import { LoginMenu, type LoginMenuHandle } from "../../menus/login/login.menu";
import { AccountsMenu } from "../../menus/known-accounts/accounts.menu";
import { ServerSelectMenu } from "../../menus/login/server-select.menu";
import { WindowsRoot } from "../../windows/core/windows-root";
import { LOGIN_WINDOW_IDS } from "../../../config/windows.registry";
import { AtmosphereScene } from "./atmosphere/atmosphere-scene.component";
import { useUiStore } from "../../../stores/StoreContext";

export function LoginScreen() {
  const [showServerSelect, setShowServerSelect] = useState(false);
  const loginMenuRef = useRef<LoginMenuHandle>(null);
  const ui = useUiStore();

  return (
    <Screen
      className="screen screen--login"
      style={{ display: "flex", flexDirection: "column" }}
    >
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <AtmosphereScene />
        <WindowsRoot ids={LOGIN_WINDOW_IDS} />

        {showServerSelect ? (
          <ServerSelectMenu onConfirm={() => ui.setScreen("select-char")} />
        ) : (
          <>
            <LoginMenu ref={loginMenuRef} onLoginSuccess={() => setShowServerSelect(true)} />
            <AccountsMenu onSelectAccount={(login) => loginMenuRef.current?.fillAccount(login)} />
            <TitleMenu />
          </>
        )}
      </div>
      <LegalFooter />
    </Screen>
  );
}
