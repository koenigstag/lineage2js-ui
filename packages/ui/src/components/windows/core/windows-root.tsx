import type { ReactNode } from "react";
import { Window } from "./window.component";
import { HotbarContent } from "../hotbar/hotbar.window";
import { InventoryContent } from "../inventory/inventory.window";
import { GameMenu } from "../../menus/game/game.menu";
import { SettingsContent } from "../settings/settings.window";
import { SkillsContent } from "../skills/skills.window";

const CONTENT: Partial<Record<string, () => ReactNode>> = {
  hotbar: () => <HotbarContent />,
  inventory: () => <InventoryContent />,
  "game-menu": () => <GameMenu />,
  settings: () => <SettingsContent />,
  "skills-list": () => <SkillsContent />,
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
