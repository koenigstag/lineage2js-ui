import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useUiStore, useWindowManagerStore } from "./stores/StoreContext";
import { useResetShortcut } from "./lib/useResetShortcut";
import { LoginScreen } from "./components/screens/login/login.screen";
import { CharSelectScreen } from "./components/screens/character-select/char-select.screen";
import { CreateCharScreen } from "./components/screens/create-char/create-char.screen";
import { GameScreen } from "./components/screens/game/game.screen";

export const App = observer(function App() {
  const ui = useUiStore();
  const windowManager = useWindowManagerStore();

  useEffect(() => {
    const hash = `#${ui.screen}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }, [ui.screen]);

  useResetShortcut(() => windowManager.resetPositions());

  switch (ui.screen) {
    case "select-char":
      return <CharSelectScreen />;
    case "create-char":
      return <CreateCharScreen />;
    case "game":
      return <GameScreen />;
    default:
      return <LoginScreen />;
  }
});
