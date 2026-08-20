import { useRef } from "react";
import { observer } from "mobx-react-lite";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useGameStore } from "../../../../stores/StoreContext";
import { CreatureModel } from "../../../core/scene/creature-model.component";
import { l2HeadingToThreeYaw, l2ToThree } from "../../../../utils/coords";
import { interpolatedCreaturePosition } from "../../../../utils/creature-movement";
import { useClickOrDoubleClick } from "../../../../lib/useClickOrDoubleClick";
import type { WorldCreatureSnapshot } from "../../../../stores/GameStore";

interface AnimatedCreatureProps {
  creature: WorldCreatureSnapshot;
  selected: boolean;
}

/**
 * Applies the creature's per-frame interpolated position (see
 * interpolatedCreaturePosition) imperatively to a wrapping group every
 * useFrame tick, instead of via a position prop -- a position prop would
 * only update at GameStore.creatures' own ~150ms poll cadence (or on
 * NpcInfo/CharInfo/UserInfo/DeleteObject), which is exactly the sparse,
 * uneven-vs-the-network's-own-100ms-tick update rate that made movement
 * look discrete/jerky. CreatureModel/CharacterModel keep composing their own
 * position+rotation on an inner group as normal (given x=y=z=0 here), so
 * this wrapper's translation and that inner rotation simply add up.
 */
function AnimatedCreature({ creature, selected }: AnimatedCreatureProps) {
  const groupRef = useRef<Group>(null);
  const gameStore = useGameStore();

  useFrame(() => {
    const l2Pos = interpolatedCreaturePosition(creature);
    const pos = l2ToThree(l2Pos.x, l2Pos.y, l2Pos.z);
    groupRef.current?.position.set(pos.x, pos.y, pos.z);
  });

  // Mob -> attack(), npc -> talkToNpc() -- both walk into range first if
  // needed (GameStore.queueActionInRange). talkToNpc has nothing to
  // actually trigger on arrival yet (no NPC dialog system, see its own
  // comment), only the walk-over. Player/summon have no act step at all.
  function act() {
    if (creature.kind === "mob") {
      gameStore.attack();
    } else if (creature.kind === "npc") {
      gameStore.talkToNpc();
    }
  }

  // Click #1 on a not-yet-targeted creature just selects it (same click
  // this creature's cursor is still the plain default for, see
  // creature-model.component.tsx's KIND_CURSOR comment) -- click #1 on the
  // creature that's *already* the target acts on it instead (the cursor by
  // then has switched to the attack/talk one, signaling that). Double-click
  // is just the fast path that collapses both steps into one gesture,
  // regardless of prior selection -- always (re)selects (a double-click on
  // a creature that wasn't already the target must still act on the right
  // one) and acts immediately.
  const { onClick } = useClickOrDoubleClick(
    () => (selected ? act() : gameStore.selectCreatureAsTarget(creature.objectId)),
    () => {
      gameStore.selectCreatureAsTarget(creature.objectId);
      act();
    }
  );

  return (
    <group ref={groupRef}>
      <CreatureModel
        creature={creature}
        x={0}
        y={0}
        z={0}
        angleToCenter={l2HeadingToThreeYaw(creature.heading)}
        selected={selected}
        onSelect={onClick}
      />
    </group>
  );
}

/**
 * Renders every creature the server currently reports nearby (NpcInfo/
 * CharInfo/UserInfo, see GameStore.bindToClient's syncCreatures) via
 * CreatureModel -- including the local player, which is just another entry
 * in GameStore.creatures now, not a special case here.
 *
 * Positioned at their ABSOLUTE L2 world coordinates via l2ToThree, matching
 * GameScene's camera once a live session exists (GameScene follows
 * gameStore.creatures.get(gameStore.me) for exactly that reason).
 */
export const GameCreaturesField = observer(function GameCreaturesField() {
  const gameStore = useGameStore();

  return (
    <>
      {Array.from(gameStore.creatures.values()).map((creature) => (
        <AnimatedCreature
          key={creature.objectId}
          creature={creature}
          selected={gameStore.target?.objectId === creature.objectId}
        />
      ))}
    </>
  );
});
