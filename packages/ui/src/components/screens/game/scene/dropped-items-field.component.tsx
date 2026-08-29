import { useState } from "react";
import { observer } from "mobx-react-lite";
import type { ThreeEvent } from "@react-three/fiber";
import { useGameStore } from "../../../../stores/StoreContext";
import { l2ToThree } from "../../../../utils/coords";
import { getItemName } from "../../../../config/item-mapping";
import { NicknameLabel } from "../../../core/scene/nickname-label.component";
import { LEGACY_SCENE_SCALE } from "../../../../utils/models/character-model";

// Half-extent of the box, in three.js meters -- small enough not to block
// the view of the ground/creatures around it, big enough to actually spot
// as a loot marker at a glance. No item art pipeline exists yet (same "no
// asset pipeline" situation as CharacterModel's procedural body), so this is
// a plain placeholder box rather than per-item icons. Scaled down along with
// everything else pegged to the placeholder capsule's old 1.7 -- see
// LEGACY_SCENE_SCALE.
const BOX_HALF_SIZE = 0.16 * LEGACY_SCENE_SCALE;
// Gap between the box's top face and the hover label, world units.
const LABEL_GAP = 0.08 * LEGACY_SCENE_SCALE;

interface DroppedItemMarkerProps {
  objectId: number;
  itemId: number;
  count: number;
  x: number;
  y: number;
  z: number;
}

/**
 * One ground item as a flat-shaded red box sitting on the terrain -- click
 * to pick it up (GameStore.pickUpItem, same client.hit() mechanism
 * pickUpNearestItem already used for the "grab whatever's closest"
 * shortcut). Hovering shows the item's name (plus a "(count)" suffix for
 * stacks) above the box, same NicknameLabel sprite creatures use, except
 * gated to hover instead of always-on -- there's no room for a permanent
 * label on every item on the ground the way there is for the handful of
 * nearby creatures.
 */
const DroppedItemMarker = observer(function DroppedItemMarker({ objectId, itemId, count, x, y, z }: DroppedItemMarkerProps) {
  const gameStore = useGameStore();
  const [hovered, setHovered] = useState(false);
  const pos = l2ToThree(x, y, z);
  const boxCenterY = pos.y + BOX_HALF_SIZE;

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    gameStore.pickUpItem(objectId);
  }

  const name = getItemName({ Id: itemId });
  const labelText = count > 1 ? `${name} (${count})` : name;

  return (
    <group>
      <mesh
        position={[pos.x, boxCenterY, pos.z]}
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
          setHovered(true);
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
          setHovered(false);
        }}
      >
        <boxGeometry args={[BOX_HALF_SIZE * 2, BOX_HALF_SIZE * 2, BOX_HALF_SIZE * 2]} />
        <meshStandardMaterial color="#c0392b" roughness={0.6} />
      </mesh>
      {hovered && <NicknameLabel text={labelText} position={[pos.x, boxCenterY + BOX_HALF_SIZE + LABEL_GAP, pos.z]} />}
    </group>
  );
});

/** Every ground item the server currently reports nearby (SpawnItem/DropItem), see GameStore.droppedItems. */
export const DroppedItemsField = observer(function DroppedItemsField() {
  const gameStore = useGameStore();

  return (
    <>
      {Array.from(gameStore.droppedItems.values()).map((item) => (
        <DroppedItemMarker
          key={item.objectId}
          objectId={item.objectId}
          itemId={item.itemId}
          count={item.count}
          x={item.x}
          y={item.y}
          z={item.z}
        />
      ))}
    </>
  );
});
