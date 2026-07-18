import { useEffect } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "./stores/StoreContext";
import { LoginScreen } from "./components/screens/login/login.screen";
import { GameScreen } from "./components/screens/game/game.screen";

export const App = observer(function App() {
  const store = useStore();

  useEffect(() => {
    const hash = `#${store.screen}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }, [store.screen]);

  return store.screen === "game" ? <GameScreen /> : <LoginScreen />;
});
