import { CharacterModel } from "./character-model.component";
import { PlayerModel } from "./player-model.component";
import { getNpcRaceColor } from "../../../config/npc-race-mapping";
import type { RaceNames } from "../../../config/character-races";
import type { WorldCreatureSnapshot } from "../../../stores/GameStore";

interface CreatureModelProps {
  creature: WorldCreatureSnapshot;
  x: number;
  y?: number;
  z: number;
  angleToCenter: number;
  selected?: boolean;
  onSelect?: () => void;
}

// Flat fallback per kind, used whenever a more specific color can't be
// resolved (mob/npc with no NpcRace in the datapack -- mostly Folk/quest-givers).
const KIND_FALLBACK_COLOR: Record<WorldCreatureSnapshot["kind"], string> = {
  player: "#5b8fd6",
  mob: "#c0504a",
  summon: "#8a6fd6",
  npc: "#7fae5a",
};

// Only mob (attackable) and npc (dialog-capable, or at least clickable/Folk)
// get a distinct hover cursor, and only once they're the current target --
// a not-yet-selected creature keeps the plain default cursor (click #1
// selects), the kind cursor only shows up once hovering it would actually
// act instead (click #1 on the current target attacks/talks -- see
// game-creatures-field.component.tsx). Player/summon never get one, since
// clicking either is always just "select", selected or not.
const KIND_CURSOR: Partial<Record<WorldCreatureSnapshot["kind"], string>> = {
  mob: "nw-resize",
  npc: "help",
};

/**
 * Resolves a WorldCreatureSnapshot (player, NPC, mob, or summon -- including
 * the local player, which is just another entry in GameStore.creatures) to
 * the right visual: players get their real race/class/sex look via
 * PlayerModel, everything else gets an NpcRace-tinted CharacterModel.
 */
export function CreatureModel({ creature, selected, ...position }: CreatureModelProps) {
  if (creature.kind === "player" && creature.race && creature.baseClass && creature.sex) {
    return (
      <PlayerModel
        {...position}
        selected={selected}
        // Safe narrowing cast: kind === "player" means this WorldCreatureSnapshot.race
        // was populated by toLocalRace() (see GameStore.ts), which only ever produces
        // one of RaceNames's 6 values -- NpcRace is a wider superset field shared with
        // non-players, TS just can't see the kind-based guarantee.
        variant={{ race: creature.race as RaceNames, baseClass: creature.baseClass, sex: creature.sex }}
        nickname={creature.name}
        isDead={creature.isDead}
      />
    );
  }

  const color = getNpcRaceColor(creature.race) ?? KIND_FALLBACK_COLOR[creature.kind];
  const cursor = selected ? KIND_CURSOR[creature.kind] : undefined;
  return (
    <CharacterModel
      {...position}
      selected={selected}
      color={color}
      nickname={creature.name}
      cursor={cursor}
      isDead={creature.isDead}
    />
  );
}
