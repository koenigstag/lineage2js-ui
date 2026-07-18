import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useUiStore } from "./stores/StoreContext";
import { LoginScreen } from "./components/screens/login/login.screen";
import { GameScreen } from "./components/screens/game/game.screen";

export const App = observer(function App() {
  const ui = useUiStore();

  useEffect(() => {
    const hash = `#${ui.screen}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }, [ui.screen]);

  return ui.screen === "game" ? <GameScreen /> : <LoginScreen />;
});
