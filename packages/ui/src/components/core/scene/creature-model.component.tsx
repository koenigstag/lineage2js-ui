import { CharacterModel } from "./character-model.component";
import { PlayerModel } from "./player-model.component";
import { getNpcRaceColor } from "../../../config/npc-race-mapping";
import type { WorldCreatureSnapshot } from "../../../stores/GameStore";

interface CreatureModelProps {
  creature: WorldCreatureSnapshot;
  x: number;
  y?: number;
  z: number;
  angleToCenter: number;
}

// Flat fallback per kind, used whenever a more specific color can't be
// resolved (mob/npc with no NpcRace in the datapack -- mostly Folk/quest-givers).
const KIND_FALLBACK_COLOR: Record<WorldCreatureSnapshot["kind"], string> = {
  player: "#5b8fd6",
  mob: "#c0504a",
  summon: "#8a6fd6",
  npc: "#7fae5a",
};

/**
 * Resolves a WorldCreatureSnapshot (player, NPC, mob, or summon -- including
 * the local player, which is just another entry in GameStore.creatures) to
 * the right visual: players get their real race/class/sex look via
 * PlayerModel, everything else gets an NpcRace-tinted CharacterModel.
 */
export function CreatureModel({ creature, ...position }: CreatureModelProps) {
  if (creature.kind === "player" && creature.race && creature.baseClass && creature.sex) {
    return (
      <PlayerModel
        {...position}
        variant={{ race: creature.race, baseClass: creature.baseClass, sex: creature.sex }}
        nickname={creature.name}
      />
    );
  }

  const color = getNpcRaceColor(creature.npcRace) ?? KIND_FALLBACK_COLOR[creature.kind];
  return <CharacterModel {...position} color={color} nickname={creature.name} />;
}
