import { useEffect, useLayoutEffect } from "react";
import { observer } from "mobx-react-lite";
import { useStore } from "./stores/StoreContext";
import { LoginScreen } from "./components/screens/login/login.screen";
import { GameScreen } from "./components/screens/game/game.screen";
import { getSession } from "./lib/session";

export const App = observer(function App() {
  const store = useStore();

  // Runs before paint so a restored session skips straight to the game
  // screen instead of flashing the login screen first.
  useLayoutEffect(() => {
    if (getSession()) {
      store.setScreen("game");
      return;
    }

    const hashScreen = window.location.hash.slice(1);
    if (hashScreen === "game" || hashScreen === "login") {
      store.setScreen(hashScreen);
    }
  }, []);

  useEffect(() => {
    const hash = `#${store.screen}`;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", hash);
    }
  }, [store.screen]);

  return store.screen === "game" ? <GameScreen /> : <LoginScreen />;
});
