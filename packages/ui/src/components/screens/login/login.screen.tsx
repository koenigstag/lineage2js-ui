import { TitleMenu } from "../../menus/title/title.menu";
import { LoginMenu } from "../../menus/login/login.menu";

export function LoginScreen() {
  return (
    <div className="screen screen--login" style={{ position: "relative", width: "100vw", height: "100vh" }}>
      <LoginMenu />
      <TitleMenu />
    </div>
  );
}
