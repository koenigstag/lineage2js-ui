import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Color, Fog, SRGBColorSpace, Vector3 } from "three";
import { TERRAIN_DRAW_DISTANCE, mapKey, worldToMapCoords } from "../../../../config/world-assets";
import { L2_TO_THREE_SCALE, l2ToThree } from "../../../../utils/coords";
import type { MapEnvironment, MapEnvironmentTime } from "../../../../utils/world/map-scene.types";
import type { LoadedMapScene } from "../../../../utils/world/use-map-scenes";

interface WorldEnvironmentProps {
  scenes: LoadedMapScene[];
  /** Where the camera is, in L2 world units -- picks which map's sky applies. */
  worldX: number;
  worldY: number;
  /**
   * Game hour, 0..24. The server has not been asked for it yet (no packet is
   * decoded into game time), so this is a constant until it is.
   */
  hour?: number;
}

/**
 * Midday. The client's own day runs six times real time, and the server states
 * it -- until that arrives, standing the world at noon shows the map's colours
 * as the map was lit to be seen.
 */
const DEFAULT_HOUR = 12;

/**
 * Sky and fog out of the map itself.
 *
 * Without this the world sits in the canvas's default black: terrain that ends
 * at TERRAIN_DRAW_DISTANCE ends against nothing, and a hard edge across the
 * view is exactly what the client's fog exists to hide. The colours are not a
 * matter of taste here -- every map carries its own set, per time of day, and
 * they are a large part of why Gludio does not look like Aden.
 */
export function WorldEnvironment({ scenes, worldX, worldY, hour = DEFAULT_HOUR }: WorldEnvironmentProps) {
  const { scene } = useThree();

  // The map underfoot, when it has an environment; otherwise any loaded one,
  // so a step across a border into an unbaked map doesn't blink the sky out.
  const environment = useMemo(() => {
    const [mapX, mapY] = worldToMapCoords(worldX, worldY);
    const here = mapKey(mapX, mapY);
    const under = scenes.find((entry) => mapKey(entry.mapX, entry.mapY) === here && entry.scene.environment);
    return (under ?? scenes.find((entry) => entry.scene.environment))?.scene.environment ?? null;
  }, [scenes, worldX, worldY]);

  const colors = useMemo(() => environment && sampleTimeOfDay(environment.times, hour), [environment, hour]);

  useEffect(() => {
    if (!colors || !environment) return;

    const previousBackground = scene.background;
    const previousFog = scene.fog;

    const [near, far] = fogBand(environment);
    scene.background = colors.sky;
    scene.fog = new Fog(colors.fog, near * L2_TO_THREE_SCALE, far * L2_TO_THREE_SCALE);

    return () => {
      scene.background = previousBackground;
      scene.fog = previousFog;
    };
  }, [scene, colors, environment]);

  if (!colors || !environment) return null;

  const sunDirection = environment.sun ? rotatorToDirection(environment.sun.rotation) : null;
  // How much daylight there is, straight off the sky the map names for this
  // hour: its own night colours are dark, so nothing else has to know when
  // night is.
  const daylight = luminance(colors.sky);

  return (
    <>
      {/* Sky light, in the sky's own colour -- the reason a night scene reads
          as blue rather than as an underlit day. */}
      <ambientLight color={colors.sky} intensity={0.6 + 0.5 * daylight} />
      {sunDirection ? (
        // A directional light only takes its direction from the position, so
        // this one can sit at the origin's own scale and still light a
        // character standing 60000 units away.
        <directionalLight
          position={[-sunDirection.x * 100, -sunDirection.y * 100, -sunDirection.z * 100]}
          intensity={0.15 + 0.75 * daylight}
        />
      ) : (
        <directionalLight position={[5, 10, 5]} intensity={0.6} />
      )}
    </>
  );
}

/** Perceived brightness, 0..1, of a colour -- read back in the space it was given in. */
function luminance(color: Color): number {
  const { r, g, b } = color.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toColor(rgb: [number, number, number]): Color {
  // The bytes are sRGB as the client's editor showed them; without naming the
  // space three would read them as linear and every colour would come out
  // washed out.
  return new Color().setRGB(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, SRGBColorSpace);
}

/**
 * The band of fog to use, of the five the map carries.
 *
 * The client picks by the player's view-distance setting; ours is fixed by
 * TERRAIN_DRAW_DISTANCE, so the useful band is the widest one that still
 * closes before the ground runs out. Anything wider would leave the terrain's
 * edge visible, which is the one thing fog is here to prevent.
 */
function fogBand(environment: MapEnvironment): [number, number] {
  const bands = environment.fogRanges.filter((range) => range[1] > 0);
  if (!bands.length) return [0, TERRAIN_DRAW_DISTANCE / L2_TO_THREE_SCALE];

  const fitting = bands.filter(([, far]) => far * L2_TO_THREE_SCALE <= TERRAIN_DRAW_DISTANCE);
  return fitting.length ? fitting[fitting.length - 1] : bands[0];
}

/**
 * An Unreal rotator to the direction it points, in three.js space.
 *
 * The sun billboard's pitch is negative, so this points down -- the way the
 * light travels, not the way to the sun.
 */
function rotatorToDirection([pitch, yaw]: [number, number, number]): Vector3 {
  const p = (pitch / 65536) * Math.PI * 2;
  const y = (yaw / 65536) * Math.PI * 2;
  return l2ToThree(Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p)).normalize();
}

interface SampledColors {
  sky: Color;
  fog: Color;
}

/**
 * The colours at a given hour, between the two entries that bracket it.
 *
 * The entries are sparse and unevenly spaced -- a map may name four or eight
 * of them -- and the day is a circle, so the last entry blends round into the
 * first rather than stopping at midnight.
 */
function sampleTimeOfDay(times: MapEnvironmentTime[], hour: number): SampledColors | null {
  if (!times.length) return null;

  const sorted = [...times].sort((a, b) => a.time - b.time);
  const at = ((hour % 24) + 24) % 24;

  let before = sorted[sorted.length - 1];
  let after = sorted[0];
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].time <= at) {
      before = sorted[i];
      after = sorted[(i + 1) % sorted.length];
    }
  }

  // Distance from `before` to `after` going forwards through the day, so the
  // wrap over midnight is an ordinary short gap rather than a jump backwards.
  const span = (after.time - before.time + 24) % 24 || 24;
  const t = ((at - before.time + 24) % 24) / span;

  return {
    sky: toColor(before.sky).lerp(toColor(after.sky), t),
    fog: toColor(before.fog).lerp(toColor(after.fog), t),
  };
}
