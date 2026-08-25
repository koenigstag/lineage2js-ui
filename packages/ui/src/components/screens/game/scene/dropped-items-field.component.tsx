import { observer } from "mobx-react-lite";
import type { ThreeEvent } from "@react-three/fiber";
import { useGameStore } from "../../../../stores/StoreContext";
import { l2ToThree } from "../../../../utils/coords";

// Half-extent of the box, in three.js meters -- small enough not to block
// the view of the ground/creatures around it, big enough to actually spot
// as a loot marker at a glance. No item art pipeline exists yet (same "no
// asset pipeline" situation as CharacterModel's procedural body), so this is
// a plain placeholder box rather than per-item icons.
const BOX_HALF_SIZE = 0.16;

interface DroppedItemMarkerProps {
  objectId: number;
  x: number;
  y: number;
  z: number;
}

/**
 * One ground item as a flat-shaded red box sitting on the terrain -- click
 * to pick it up (GameStore.pickUpItem, same client.hit() mechanism
 * pickUpNearestItem already used for the "grab whatever's closest" shortcut).
 */
function DroppedItemMarker({ objectId, x, y, z }: DroppedItemMarkerProps) {
  const gameStore = useGameStore();
  const pos = l2ToThree(x, y, z);

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    gameStore.pickUpItem(objectId);
  }

  return (
    <mesh
      position={[pos.x, pos.y + BOX_HALF_SIZE, pos.z]}
      onClick={handleClick}
      // Same reasoning as character-model.component.tsx's onPointerDown:
      // the ground mesh underneath only stops pointerdown from reaching
      // meshes BEHIND it once ITS OWN handler runs -- without a handler
      // here, a pointerdown that hits this box first still falls through
      // untouched to the ground, firing a move-to-point order instead of
      // (or racing ahead of) the click-based pickup just above.
      onPointerDown={(event) => event.stopPropagation()}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => (document.body.style.cursor = "auto")}
    >
      <boxGeometry args={[BOX_HALF_SIZE * 2, BOX_HALF_SIZE * 2, BOX_HALF_SIZE * 2]} />
      <meshStandardMaterial color="#c0392b" roughness={0.6} />
    </mesh>
  );
}

/** Every ground item the server currently reports nearby (SpawnItem/DropItem), see GameStore.droppedItems. */
export const DroppedItemsField = observer(function DroppedItemsField() {
  const gameStore = useGameStore();

  return (
    <>
      {Array.from(gameStore.droppedItems.values()).map((item) => (
        <DroppedItemMarker key={item.objectId} objectId={item.objectId} x={item.x} y={item.y} z={item.z} />
      ))}
    </>
  );
});
