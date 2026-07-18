import { observer } from "mobx-react-lite";
import { useStore } from "./stores/StoreContext";

export const App = observer(function App() {
  const store = useStore();

  return (
    <main>
      <h1>Lineage 2 JS</h1>
      <p>Connection status: {store.connectionStatus}</p>
    </main>
  );
});
