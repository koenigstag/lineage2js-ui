import { useMemo, useRef } from "react";
import { Screen } from "../../core/screen.component";
import { LegalFooter } from "../../core/legal-footer.component";
import { TitleMenu } from "../../menus/title/title.menu";
import { LoginMenu, type LoginMenuHandle } from "../../menus/login/login.menu";
import { AccountsMenu } from "../../menus/known-accounts/accounts.menu";
import { WindowsRoot } from "../../windows/core/windows-root";
import { LOGIN_WINDOW_IDS } from "../../../config/windows.registry";
import { getRandomLoginBackground } from "../../../assets/login/backgrounds";
import { getRandomLoginBackgroundUrl } from "../../../config/background-urls";
import { AtmosphereScene } from "./atmosphere/atmosphere-scene.component";

export function LoginScreen() {
  const background = useMemo(() => getRandomLoginBackground() ?? getRandomLoginBackgroundUrl(), []);
  const loginMenuRef = useRef<LoginMenuHandle>(null);

  return (
    <Screen
      className="screen screen--login"
      style={{
        display: "flex",
        flexDirection: "column",
        backgroundImage: background ? `url(${background})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <AtmosphereScene />
        <WindowsRoot ids={LOGIN_WINDOW_IDS} />

        <LoginMenu ref={loginMenuRef} />
        <TitleMenu />
        <AccountsMenu onSelectAccount={(login) => loginMenuRef.current?.fillAccount(login)} />
      </div>
      <LegalFooter />
    </Screen>
  );
}
