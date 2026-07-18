import { createContext, useContext, type PropsWithChildren } from "react";
import { rootStore, RootStore } from "./RootStore";

const StoreContext = createContext<RootStore>(rootStore);

export function StoreProvider({ children }: PropsWithChildren) {
  return <StoreContext.Provider value={rootStore}>{children}</StoreContext.Provider>;
}

export function useStore() {
  return useContext(StoreContext);
}
