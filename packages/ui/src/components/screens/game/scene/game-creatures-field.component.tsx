import { observer } from "mobx-react-lite";
import { useGameStore } from "../../../../stores/StoreContext";
import { CreatureModel } from "../../../core/scene/creature-model.component";
import { l2HeadingToThreeYaw, l2ToThree } from "../../../../utils/coords";

/**
 * Renders every creature the server currently reports nearby (NpcInfo/
 * CharInfo/UserInfo, see GameStore.bindToClient's syncCreatures) via
 * CreatureModel -- including the local player, which is just another entry
 * in GameStore.creatures now, not a special case here.
 *
 * Positioned at their ABSOLUTE L2 world coordinates via l2ToThree. Note this
 * is a separate coordinate frame from GeoTerrainDebugScene's WASD/click test
 * rig (which still starts at the world origin, independent of any real
 * session) -- so these markers won't necessarily be near the test camera's
 * default view until that's tied together.
 */
export const GameCreaturesField = observer(function GameCreaturesField() {
  const gameStore = useGameStore();

  return (
    <>
      {Array.from(gameStore.creatures.values()).map((creature) => {
        const pos = l2ToThree(creature.x, creature.y, creature.z);
        return (
          <CreatureModel
            key={creature.objectId}
            creature={creature}
            x={pos.x}
            y={pos.y}
            z={pos.z}
            angleToCenter={l2HeadingToThreeYaw(creature.heading)}
          />
        );
      })}
    </>
  );
});
