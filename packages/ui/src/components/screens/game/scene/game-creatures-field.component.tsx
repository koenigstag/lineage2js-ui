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
 * Positioned RELATIVE to the own character's real world position
 * (myPosition), not absolute L2 coordinates: there's no real geodata for
 * arbitrary regions yet (see utils/geodata), so this keeps creatures
 * visible near the scene's origin regardless of where in the world the
 * character actually is. Renders nothing until a real session has reported
 * its own position at least once.
 */
export const GameCreaturesField = observer(function GameCreaturesField() {
  const gameStore = useGameStore();
  const myPosition = gameStore.myPosition;

  if (!myPosition) {
    return null;
  }

  return (
    <>
      {Array.from(gameStore.creatures.values()).map((creature) => {
        const pos = l2ToThree(creature.x - myPosition.x, creature.y - myPosition.y, creature.z);
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
