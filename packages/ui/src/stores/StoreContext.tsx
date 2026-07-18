import { createContext, useContext, type PropsWithChildren } from "react";
import { rootStore, RootStore } from "./RootStore";

const StoreContext = createContext<RootStore>(rootStore);

export function StoreProvider({ children }: PropsWithChildren) {
  return <StoreContext.Provider value={rootStore}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}

export function useUiStore() {
  return useContext(StoreContext).ui;
}

export function useSessionStore() {
  return useContext(StoreContext).session;
}

export function useGameStore() {
  return useContext(StoreContext).game;
}
