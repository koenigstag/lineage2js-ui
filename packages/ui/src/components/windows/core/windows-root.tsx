import type { ReactNode } from "react";
import { observer } from "mobx-react-lite";
import { Window } from "./window.component";
import { HotbarContent } from "../hotbar/hotbar.window";
import { InventoryContent } from "../inventory/inventory.window";
import { GameMenu } from "../../menus/game/game.menu";
import { SettingsContent } from "../settings/settings.window";
import { SkillsContent } from "../skills/skills.window";
import { EffectsContent } from "../effects/effects.window";
import { RadarContent } from "../radar/radar.window";
import { ActionsContent } from "../actions/actions.window";
import { CharInfoContent } from "../char-info/char-info.window";
import { CharacterContent } from "../character/character.window";
import { PartyCharInfoContent } from "../party-char-info/party-char-info.window";
import { TargetSelectContent } from "../target-select/target-select.window";
import { SystemMessagesContent } from "../system-messages/system-messages.window";
import { ChatContent } from "../chat/chat.window";
import { SkillLearnContent } from "../skill/skill.window";
import { ResurrectConfirmContent } from "../resurrect/resurrect.window";
import { PartyInviteConfirmContent } from "../party-invite/party-invite.window";
import { TradeRequestConfirmContent } from "../trade-request/trade-request.window";
import { DuelRequestConfirmContent } from "../duel-request/duel-request.window";
import { PairActionRequestConfirmContent } from "../pair-action-request/pair-action-request.window";
import { NpcDialogueContent } from "../npc-dialogue/npc-dialogue.window";
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
    radar: () => <RadarContent />,
    actions: () => <ActionsContent />,
    character: () => <CharacterContent />,
    "char-info": () => <CharInfoContent />,
    "party-char-info": () => <PartyCharInfoContent onMemberClick={(member) => game.selectTarget(member)} />,
    "target-select": () => <TargetSelectContent />,
    "system-messages": () => <SystemMessagesContent />,
    chat: () => <ChatContent />,
    skill: () => <SkillLearnContent />,
    resurrect: () => <ResurrectConfirmContent />,
    "party-invite": () => <PartyInviteConfirmContent />,
    "trade-request": () => <TradeRequestConfirmContent />,
    "duel-request": () => <DuelRequestConfirmContent />,
    "pair-action-request": () => <PairActionRequestConfirmContent />,
    "npc-dialogue": () => <NpcDialogueContent />,
  };

  // Windows whose shown/hidden state is gated by a GameStore field rather
  // than WindowManagerStore's own open flag -- see Window's onClose prop.
  const ON_CLOSE: Partial<Record<string, () => void>> = {
    "npc-dialogue": () => game.closeNpcDialogue(),
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
        // No pending party invite -- same treatment.
        if (id === "party-invite" && !game.partyInviteRequest) {
          return null;
        }
        // No pending trade request -- same treatment.
        if (id === "trade-request" && !game.tradeRequest) {
          return null;
        }
        // No pending duel request -- same treatment.
        if (id === "duel-request" && !game.duelRequest) {
          return null;
        }
        // No pending pair-action request -- same treatment.
        if (id === "pair-action-request" && !game.pairActionRequest) {
          return null;
        }
        // No active NPC dialogue -- same treatment.
        if (id === "npc-dialogue" && !game.npcDialogue) {
          return null;
        }

        return (
          <Window key={id} id={id} onClose={ON_CLOSE[id]}>
            {CONTENT[id] ?? (() => null)}
          </Window>
        );
      })}
    </>
  );
});
