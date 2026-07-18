import { useMemo } from "react";
import { TitleMenu } from "../../menus/title/title.menu";
import { LoginMenu } from "../../menus/login/login.menu";
import { getRandomLoginBackground } from "../../../assets/login/backgrounds";

export function LoginScreen() {
  const background = useMemo(() => getRandomLoginBackground(), []);

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
      <LoginMenu />
      <TitleMenu />
    </div>
  );
}
