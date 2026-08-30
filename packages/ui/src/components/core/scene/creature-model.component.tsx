import { CharacterBody } from "./character-body.component";
import type { CharacterAnimation } from "./gltf-character-model.component";
import { PlayerModel } from "./player-model.component";
import { getNpcModelUrl } from "../../../config/character-models";
import { getNpcRaceColor } from "../../../config/npc-race-mapping";
import type { RaceNames } from "../../../config/character-races";
import type { WeaponClass } from "../../../config/weapon-class-mapping";
import type { WorldCreatureSnapshot } from "../../../stores/GameStore";
import { cursorStyle } from "../../../config/cursor-urls";

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
//
// The fallback keyword (second cursorStyle() argument) is what this showed
// before real cursor art existed -- kept as the CSS-mandated last value, so
// an unconfigured VITE_CURSOR_BASE_URL (or one specific file 404ing) looks
// exactly like it always did rather than breaking.
const KIND_CURSOR: Partial<Record<WorldCreatureSnapshot["kind"], string>> = {
  mob: cursorStyle("attack", "nw-resize"),
  npc: cursorStyle("help", "help"),
};

/**
 * Swing to play per weapon class. A rig that doesn't ship the exact clip
 * falls back on its own (see GltfCharacterModel's FALLS_BACK_TO); this only
 * decides what to ask for.
 */
const ATTACK_BY_WEAPON: Record<WeaponClass, CharacterAnimation> = {
  hand: "attack",
  "1hs": "attack1hs",
  dual: "attackDual",
  dualDagger: "attackDualDagger",
  bow: "attackBow",
  pole: "attackPole",
  rapier: "attackRapier",
};

/**
 * Dead creatures hold the end of the fall and seated ones the seated pose;
 * casting, swinging, stooping over a drop and getting back up each hold
 * their own motion; and the rest idle unless they're on a move segment --
 * where walk vs run comes from the creature's own move type
 * (CharInfo/NpcInfo/UserInfo, kept current by ChangeMoveType), the same flag
 * the server picks its speed off, rather than from guessing at that speed.
 */
function animationFor(creature: WorldCreatureSnapshot): CharacterAnimation {
  if (creature.isDead) return "death";
  if (creature.isSitting) return "sit";
  // Movement outranks both gestures below: the server is authoritative about
  // where a creature is going, and a creature that has started moving has
  // stopped casting or stooping whatever its window still says.
  if (creature.isMoving) return creature.isRunning ? "run" : "walk";
  // Cast before pick-up: its window is the server's own cast time
  // (MagicSkillUse), the stoop's is the client's guess.
  if (creature.isCasting) return "cast";
  if (creature.isAttacking) return ATTACK_BY_WEAPON[creature.weaponClass];
  if (creature.isPickingUp) return "pickup";
  // Last of the gestures on purpose: the stand-up window is deliberately
  // longer than any rig's clip, so it is still open once the body has
  // settled back into idle -- anything more specific happening in that tail
  // is the truer thing to draw.
  if (creature.isStandingUp) return "stand";
  return "idle";
}

/**
 * Resolves a WorldCreatureSnapshot (player, NPC, mob, or summon -- including
 * the local player, which is just another entry in GameStore.creatures) to
 * the right visual: players get their real race/class/sex body via
 * PlayerModel, NPCs of a playable race get that race's body tinted by
 * NpcRace, and everything else falls back to the capsule placeholder.
 *
 * The split isn't incidental: the converted bodies are all humanoid, which is
 * the right shape for a person and the wrong one for a wolf, so mobs and
 * summons stay on the shape-agnostic capsule until there's per-archetype
 * geometry to give them (see TODO.md's "Basic 3D models for mobs").
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
        title={creature.title}
        animation={animationFor(creature)}
        animationStartedAt={creature.gestureStartedAt}
        speed={creature.speed}
        isDead={creature.isDead}
      />
    );
  }

  const color = getNpcRaceColor(creature.race) ?? KIND_FALLBACK_COLOR[creature.kind];
  const cursor = selected ? KIND_CURSOR[creature.kind] : undefined;
  return (
    <CharacterBody
      {...position}
      selected={selected}
      // NpcInfo carries no sex or class, so a humanoid NPC borrows its race's
      // male fighter body; mobs and summons have no model to ask for.
      modelUrl={creature.kind === "npc" ? getNpcModelUrl(creature.race) : undefined}
      animation={animationFor(creature)}
      animationStartedAt={creature.gestureStartedAt}
      speed={creature.speed}
      color={color}
      nickname={creature.name}
      title={creature.title}
      cursor={cursor}
      isDead={creature.isDead}
    />
  );
}
