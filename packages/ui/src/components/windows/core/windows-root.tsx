import type { ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { Window } from "./window.component";
import { HotbarContent } from "../hotbar/hotbar.window";
import { InventoryContent } from "../inventory/inventory.window";
import { GameMenu } from "../../menus/game/game.menu";
import { SettingsContent } from "../settings/settings.window";
import { SkillsContent } from "../skills/skills.window";
import { EffectsContent } from "../effects/effects.window";
import { ActionsContent } from "../actions/actions.window";
import { CharInfoContent } from "../char-info/char-info.window";
import { CharacterContent } from "../character/character.window";
import { PartyCharInfoContent } from "../party-char-info/party-char-info.window";
import { TargetSelectContent } from "../target-select/target-select.window";
import { SystemMessagesContent } from "../system-messages/system-messages.window";
import { ChatContent } from "../chat/chat.window";
import { SkillLearnContent } from "../skill/skill.window";
import { ResurrectConfirmContent } from "../resurrect/resurrect.window";
import { useGameStore } from "../../../stores/StoreContext";

export interface WindowsRootProps {
  ids: string[];
}

export const WindowsRoot = observer(function WindowsRoot({ ids }: WindowsRootProps) {
  const game = useGameStore();

  const CONTENT: Partial<Record<string, () => ReactNode>> = {
    hotbar: () => <HotbarContent />,
    inventory: () => <InventoryContent />,
    "game-menu": () => <GameMenu />,
    settings: () => <SettingsContent />,
    "skills-list": () => <SkillsContent />,
    effects: () => <EffectsContent />,
    actions: () => <ActionsContent />,
    character: () => <CharacterContent />,
    "char-info": () => <CharInfoContent />,
    "party-char-info": () => <PartyCharInfoContent onMemberClick={(member) => game.selectTarget(member)} />,
    "target-select": () => <TargetSelectContent />,
    "system-messages": () => <SystemMessagesContent />,
    chat: () => <ChatContent />,
    skill: () => <SkillLearnContent />,
    resurrect: () => <ResurrectConfirmContent />,
  };

  return (
    <>
      {ids.map((id) => {
        // Not partied -- no members to show, so collapse the window entirely
        // instead of leaving an empty frame on screen.
        if (id === "party-char-info" && game.party.length === 0) {
          return null;
        }
        // No target selected -- same "collapse instead of empty frame" treatment.
        if (id === "target-select" && !game.target) {
          return null;
        }
        // No skill selected from the Learn tab yet -- same treatment.
        if (id === "skill" && !game.selectedLearnableSkill) {
          return null;
        }
        // No pending resurrect prompt -- same treatment.
        if (id === "resurrect" && !game.resurrectRequest) {
          return null;
        }

        return (
          <Window key={id} id={id}>
            {CONTENT[id] ?? (() => null)}
          </Window>
        );
      })}
    </>
  );
});
