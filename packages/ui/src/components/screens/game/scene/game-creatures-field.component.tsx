import { useRef } from "react";
import { observer } from "mobx-react-lite";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import { useGameStore } from "../../../../stores/StoreContext";
import { CreatureModel } from "../../../core/scene/creature-model.component";
import { l2HeadingToThreeYaw, l2ToThree } from "../../../../utils/coords";
import { interpolatedCreaturePosition } from "../../../../utils/creature-movement";
import type { WorldCreatureSnapshot } from "../../../../stores/GameStore";

interface AnimatedCreatureProps {
  creature: WorldCreatureSnapshot;
  selected: boolean;
  onSelect: () => void;
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
function AnimatedCreature({ creature, selected, onSelect }: AnimatedCreatureProps) {
  const groupRef = useRef<Group>(null);

  useFrame(() => {
    const l2Pos = interpolatedCreaturePosition(creature);
    const pos = l2ToThree(l2Pos.x, l2Pos.y, l2Pos.z);
    groupRef.current?.position.set(pos.x, pos.y, pos.z);
  });

  return (
    <group ref={groupRef}>
      <CreatureModel
        creature={creature}
        x={0}
        y={0}
        z={0}
        angleToCenter={l2HeadingToThreeYaw(creature.heading)}
        selected={selected}
        onSelect={onSelect}
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
          onSelect={() => gameStore.selectCreatureAsTarget(creature.objectId)}
        />
      ))}
    </>
  );
});
