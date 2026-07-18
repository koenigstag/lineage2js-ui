import { observer } from "mobx-react-lite";
import { useStore } from "./stores/StoreContext";
import { LoginScreen } from "./components/screens/login/login.screen";
import { GameScreen } from "./components/screens/game/game.screen";

export const App = observer(function App() {
  const store = useStore();

  return store.screen === "game" ? <GameScreen /> : <LoginScreen />;
});
