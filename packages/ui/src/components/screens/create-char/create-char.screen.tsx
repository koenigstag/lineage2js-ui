import { Screen } from "../../core/screen.component";
import { CharCreateMenu } from "../../menus/char-create/char-create.menu";

export function CreateCharScreen() {
  return (
    <Screen className="screen screen--create-char">
      <CharCreateMenu />
    </Screen>
  );
}
