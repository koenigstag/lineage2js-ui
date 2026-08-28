import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AnimationMixer, LoopOnce, type AnimationAction, type Group } from "three";
import { NicknameLabel } from "./nickname-label.component";
import {
  CHARACTER_MODEL_SCALE,
  instantiateCharacterModel,
  type CharacterModelAsset,
} from "../../../utils/models/character-model";

/** The states the converted rigs carry a clip for -- see convert-unity-models.ts's CLIPS. */
export type CharacterAnimation = "idle" | "walk" | "run" | "sit" | "sitIdle" | "attack" | "cast" | "death";

export interface GltfCharacterModelProps {
  asset: CharacterModelAsset;
  // Tint is passed a colour at a time rather than as one object: the model is
  // rebuilt whenever it changes, and an object literal is a new value on every
  // render.
  skinColor: string;
  outfitColor: string;
  hairColor: string;
  x: number;
  /** World-up (three.js Y) foot position. Defaults to 0 (flat-floor scenes). */
  y?: number;
  z: number;
  angleToCenter: number;
  animation?: CharacterAnimation;
  /**
   * World units/second the creature is actually moving at, used to keep the
   * stride in step with the movement instead of sliding. Ignored when idle.
   */
  speed?: number;
  nickname?: string;
  selected?: boolean;
  onSelect?: () => void;
  /** CSS cursor shown while hovering the model, e.g. "crosshair" for an attackable mob. Unset leaves the browser default. */
  cursor?: string;
}

const CROSSFADE_SECONDS = 0.15;

/**
 * L2 world units/second at which a cycle looks right played at its own
 * length -- i.e. roughly a character's default walk and run speed, since
 * that's what the retail animators timed the sequences against. The clip
 * plays faster or slower in proportion to the creature's real speed so its
 * feet stay planted; the clamp keeps a haste buff or a crawling NPC from
 * turning that into a blur or a freeze-frame.
 *
 * This only means anything as long as the clips carry their retail length:
 * the Unity project the bodies are converted from had every sequence on a
 * flat 24fps timeline, and until convert-unity-models.ts started retiming
 * them (see its AUTHORED_SECONDS) the cycles ran up to nine times too fast
 * no matter what this said. Unlike those durations, the two numbers here
 * are still estimates rather than something measured out of the client.
 */
const REFERENCE_SPEED: Partial<Record<CharacterAnimation, number>> = { walk: 55, run: 120 };
const MIN_TIME_SCALE = 0.5;
const MAX_TIME_SCALE = 2;

/** Plays once and holds its last frame instead of looping. */
const ONE_SHOT: ReadonlySet<CharacterAnimation> = new Set<CharacterAnimation>([
  "sit",
  "attack",
  "cast",
  "death",
]);

/**
 * Transitions that end in a pose of their own: sitting down leads into the
 * seated idle. Anything else in ONE_SHOT simply holds where it stopped, which
 * is what a corpse wants.
 */
const SETTLES_INTO: Partial<Record<CharacterAnimation, CharacterAnimation>> = { sit: "sitIdle" };

/**
 * A converted retail body (see assets-server/scripts/convert-unity-models.ts),
 * posed by the animation clips that came with it.
 *
 * Picking is one invisible capsule around the body rather than the skinned
 * mesh itself: the hit volume should be the character, not whichever forearm
 * happened to be under the cursor, and it stays put whatever pose the rig is
 * in -- three raycasts a skinned mesh against its bind pose anyway, so hitting
 * the mesh would be both slower and wrong.
 */
export function GltfCharacterModel({
  asset,
  skinColor,
  outfitColor,
  hairColor,
  x,
  y = 0,
  z,
  angleToCenter,
  animation = "idle",
  speed,
  nickname,
  selected = false,
  onSelect,
  cursor,
}: GltfCharacterModelProps) {
  const model = useMemo(() => {
    const root = instantiateCharacterModel(asset, { skin: skinColor, outfit: outfitColor, hair: hairColor });
    root.traverse((object) => {
      // Everything about this model is a raycast target by default; picking
      // belongs to the capsule below.
      object.raycast = () => undefined;
    });

    const mixer = new AnimationMixer(root);
    const actions = new Map<string, AnimationAction>();
    for (const clip of asset.animations) actions.set(clip.name, mixer.clipAction(clip));
    return { root: root as Group, mixer, actions };
  }, [asset, skinColor, outfitColor, hairColor]);

  useEffect(
    () => () => {
      model.mixer.stopAllAction();
    },
    [model]
  );

  // Whether this is the first state the model has ever been in, so a corpse
  // that was already dead when it came into view holds the end of the fall
  // instead of dropping again in front of the player.
  const started = useRef(false);

  useEffect(() => {
    // A creature already in this state when it came into view skips straight
    // to where the state ends up, rather than replaying the transition in
    // front of the player: someone found sitting is sitting, not standing up
    // to sit down again, and a corpse is not still falling over.
    const settled = SETTLES_INTO[animation];
    const wanted = !started.current && settled ? settled : animation;

    const next = model.actions.get(wanted) ?? model.actions.get("idle");
    if (!next) return;

    if (ONE_SHOT.has(wanted)) {
      next.setLoop(LoopOnce, 1);
      next.clampWhenFinished = true;
    }
    next.reset();
    // No settled pose to skip to, so hold the end of the transition instead.
    if (!started.current && ONE_SHOT.has(wanted) && !settled) next.time = next.getClip().duration;

    const previous = [...model.actions.values()].find((action) => action !== next && action.isRunning());
    if (previous && started.current) next.crossFadeFrom(previous, CROSSFADE_SECONDS, false);
    else for (const action of model.actions.values()) if (action !== next) action.stop();
    next.play();
    started.current = true;
  }, [model, animation]);

  // Hands a finished transition over to the pose it settles into -- without
  // this, sitting down would freeze on the last frame of standing up out of
  // the chair backwards.
  useEffect(() => {
    const settled = SETTLES_INTO[animation];
    const transition = settled && model.actions.get(animation);
    const held = settled && model.actions.get(settled);
    if (!transition || !held) return;

    function onFinished(event: { action: AnimationAction }) {
      if (event.action !== transition) return;
      held!.reset().play();
      held!.crossFadeFrom(transition!, CROSSFADE_SECONDS, false);
    }

    model.mixer.addEventListener("finished", onFinished);
    return () => model.mixer.removeEventListener("finished", onFinished);
  }, [model, animation]);

  useEffect(() => {
    const action = model.actions.get(animation);
    if (!action) return;
    const reference = REFERENCE_SPEED[animation];
    // Explicitly back to 1 whenever there's nothing to match the clip
    // against -- an idle or death has no reference speed, and a creature
    // that isn't moving reports no speed at all. Leaving the branch early
    // instead (as this used to) leaves the scale the last run set: three's
    // AnimationAction.reset() doesn't clear timeScale, so a character that
    // stopped after sprinting went on breathing at double speed.
    action.timeScale =
      reference && speed ? Math.min(MAX_TIME_SCALE, Math.max(MIN_TIME_SCALE, speed / reference)) : 1;
  }, [model, animation, speed]);

  useFrame((_, delta) => model.mixer.update(delta));

  return (
    <group position={[x, y, z]} rotation={[0, angleToCenter, 0]}>
      {nickname && <NicknameLabel text={nickname} position={[0, 1.95, 0]} />}

      <primitive object={model.root} scale={CHARACTER_MODEL_SCALE} />

      {/* Invisible pick volume -- see this component's own doc comment. */}
      <mesh
        position={[0, 0.9, 0]}
        visible={false}
        onClick={
          onSelect &&
          ((event) => {
            event.stopPropagation();
            onSelect();
          })
        }
        // Ground-click acts on "pointerdown" (geo-terrain-tile.component.tsx)
        // and only stops propagation once its own handler runs, so without
        // this a pointerdown on a creature still falls through to the ground
        // behind it and fires a move order.
        onPointerDown={
          onSelect &&
          ((event) => {
            event.stopPropagation();
          })
        }
        onPointerOver={
          cursor
            ? (event) => {
                event.stopPropagation();
                document.body.style.cursor = cursor;
              }
            : undefined
        }
        onPointerOut={cursor ? () => (document.body.style.cursor = "auto") : undefined}
      >
        <capsuleGeometry args={[0.3, 1.1, 4, 8]} />
      </mesh>

      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => undefined}>
          <ringGeometry args={[0.34, 0.42, 32]} />
          <meshBasicMaterial color="#ffd27a" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}
