import { Screen } from "../../core/screen.component";
import { LegalFooter } from "../../core/legal-footer.component";
import { CharCreateMenu } from "../../menus/char-create/char-create.menu";

export function CreateCharScreen() {
  return (
    <Screen className="screen screen--create-char" style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <CharCreateMenu />
      </div>
      <LegalFooter />
    </Screen>
  );
}
