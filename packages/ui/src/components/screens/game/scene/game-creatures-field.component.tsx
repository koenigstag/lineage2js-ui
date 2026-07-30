import { observer } from "mobx-react-lite";
import { useGameStore } from "../../../../stores/StoreContext";
import { CharacterMarker } from "../../../core/scene/character-marker.component";
import { l2HeadingToThreeYaw, l2ToThree } from "../../../../utils/coords";

const COLOR_BY_KIND: Record<string, string> = {
  player: "#5b8fd6",
  mob: "#c0504a",
  summon: "#8a6fd6",
  npc: "#7fae5a",
};

/**
 * Renders every creature the server currently reports nearby (NpcInfo/
 * CharInfo, see GameStore.bindToClient's syncCreatures), nickname above
 * each one via CharacterMarker.
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
          <CharacterMarker
            key={creature.objectId}
            x={pos.x}
            y={pos.y}
            z={pos.z}
            angleToCenter={l2HeadingToThreeYaw(creature.heading)}
            color={COLOR_BY_KIND[creature.kind] ?? COLOR_BY_KIND.npc}
            nickname={creature.name}
          />
        );
      })}
    </>
  );
});
