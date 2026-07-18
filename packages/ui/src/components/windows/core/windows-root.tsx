import type { ReactNode } from "react";
import { Window } from "./window.component";
import { HotbarContent } from "../hotbar/hotbar.window";
import { InventoryContent } from "../inventory/inventory.window";

const CONTENT: Partial<Record<string, () => ReactNode>> = {
  hotbar: () => <HotbarContent />,
  inventory: () => <InventoryContent />,
};

export interface WindowsRootProps {
  ids: string[];
}

export function WindowsRoot({ ids }: WindowsRootProps) {
  return (
    <>
      {ids.map((id) => (
        <Window key={id} id={id}>
          {CONTENT[id] ?? (() => null)}
        </Window>
      ))}
    </>
  );
}
