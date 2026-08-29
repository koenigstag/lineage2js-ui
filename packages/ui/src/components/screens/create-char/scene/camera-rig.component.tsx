import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

/** Where the camera sits and what it aims at -- see the focus table in char-create-scene. */
export interface CameraFocus {
  position: [number, number, number];
  lookAt: [number, number, number];
}

/**
 * How fast the camera closes the remaining distance, as a rate rather than a
 * duration: the step below takes the frame's own delta, so the move looks the
 * same at 30fps and 144fps instead of running at whatever speed the display
 * happens to refresh.
 */
const APPROACH_RATE = 6;
/** Below this the move is over -- otherwise it eases forever, asymptotically. */
const SETTLED = 0.001;

interface CameraRigProps {
  focus: CameraFocus;
  /**
   * Cut rather than travel whenever this changes.
   *
   * The stages of one race are a move in for a closer look, and animating
   * them says so. Crossing to another race is not that: the groups stand in a
   * row far apart, so easing there is a long sideways pan through every race
   * in between, which reads as the camera going for a walk rather than as the
   * choice that was actually made.
   */
  cut?: string;
}

/**
 * Eases the camera to the current focus. Creation narrows down in stages --
 * a race's whole group, then one class's two bodies, then a single face -- and
 * animating between them is what makes that read as moving in for a closer
 * look rather than as the scene cutting to a different place.
 */
export function CameraRig({ focus, cut }: CameraRigProps) {
  const { camera } = useThree();
  const aim = useRef(new Vector3(...focus.lookAt));
  const wantPosition = useRef(new Vector3());
  const wantAim = useRef(new Vector3());
  // The first focus is where the camera already is (the Canvas sets it up
  // there), so there is nothing to travel -- without this the screen would
  // open on a fly-in nobody asked for.
  const placed = useRef(false);
  const lastCut = useRef(cut);

  useFrame((_, delta) => {
    wantPosition.current.set(...focus.position);
    wantAim.current.set(...focus.lookAt);

    if (!placed.current || lastCut.current !== cut) {
      placed.current = true;
      lastCut.current = cut;
      camera.position.copy(wantPosition.current);
      aim.current.copy(wantAim.current);
      camera.lookAt(aim.current);
      return;
    }

    if (
      camera.position.distanceToSquared(wantPosition.current) < SETTLED &&
      aim.current.distanceToSquared(wantAim.current) < SETTLED
    ) {
      return;
    }

    const step = 1 - Math.exp(-APPROACH_RATE * delta);
    camera.position.lerp(wantPosition.current, step);
    aim.current.lerp(wantAim.current, step);
    camera.lookAt(aim.current);
  });

  return null;
}
