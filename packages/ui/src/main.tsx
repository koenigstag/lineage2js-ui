import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App";
import { StoreProvider } from "./stores/StoreContext";
import { registerNpcHtmlElements } from "./lib/npc-html/npc-html-elements";
import { DEFAULT_CURSOR } from "./config/cursor-urls";

registerNpcHtmlElements();

// The baseline cursor belongs on <body>, not on each screen's root: the 3D
// scene's hover handlers drive document.body.style.cursor directly (see
// creature-model.component.tsx's KIND_CURSOR) and reset it to DEFAULT_CURSOR
// on pointer-out, and a cursor on the game screen's own root would shadow
// them for everything inside it. That is why the game screen alone carried no
// cursor of its own -- and so showed the browser's plain arrow until the
// first NPC hover-out happened to write one onto body.
document.body.style.cursor = DEFAULT_CURSOR;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);
