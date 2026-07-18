import { useMemo, useRef } from "react";
import { TitleMenu } from "../../menus/title/title.menu";
import { LoginMenu, type LoginMenuHandle } from "../../menus/login/login.menu";
import { AccountsMenu } from "../../menus/known-accounts/accounts.menu";
import { getRandomLoginBackground } from "../../../assets/login/backgrounds";

export function LoginScreen() {
  const background = useMemo(() => getRandomLoginBackground(), []);
  const loginMenuRef = useRef<LoginMenuHandle>(null);

  return (
    <div
      className="screen screen--login"
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000000",
        backgroundImage: background ? `url(${background})` : undefined,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <LoginMenu ref={loginMenuRef} />
      <TitleMenu />
      <AccountsMenu onSelectAccount={(login) => loginMenuRef.current?.fillAccount(login)} />
    </div>
  );
}
