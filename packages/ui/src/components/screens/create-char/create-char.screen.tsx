import { CharCreateMenu } from "../../menus/char-create/char-create.menu";

export function CreateCharScreen() {
  return (
    <div
      className="screen screen--create-char"
      style={{ position: "relative", width: "100vw", height: "100vh", backgroundColor: "#000000" }}
    >
      <CharCreateMenu />
    </div>
  );
}
