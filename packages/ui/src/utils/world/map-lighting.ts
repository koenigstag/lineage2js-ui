import { Color } from "three";
import type { WorldEnv, WorldEnvColor, WorldEnvLight } from "./map-scene.types";

/**
 * How bright the world is, resolved once and handed to everything that lights
 * anything.
 *
 * There have been two wrong answers to this before the right one. The first
 * was three constants written by hand in the terrain shader against a
 * sky-derived light on the meshes, which disagreed by four or five times. The
 * second read the level's own `LevelInfo` ambient and `NMovableSunLight` --
 * the obvious source, and not the one the client uses: on 192 of its 203 maps
 * that ambient is below 1, because the runtime never looks at it.
 *
 * What it looks at is `system/env.int` and the `timeenv<n>.int` curves, one
 * set for the whole client, sampled at the hour, with a separate pair of
 * curves per surface class. That is what this resolves, and the arithmetic
 * below is the client's:
 *
 *     terrain = ambient.terrain/2 + light.terrain * shadow/255 * 0.5
 *     mesh    = ambient.staticMesh/2 + light.staticMesh * 32/255
 *
 * and both are then doubled by D3DTOP_MODULATE2X where they meet the texture.
 * The halving is a byte shift in the client (`shr 1`), the 0.5 and the 32 are
 * constants read out of its own code -- see the vendored reader's
 * rendering/l2-env.ts and objects/terrain.ts.
 *
 * Note what the terrain's half of that does *not* contain: a dot product. The
 * client's ground has no diffuse term, because the bake in `shadow` already
 * holds the slope and the occlusion. Putting a lambert back in front of it
 * counts the geometry twice and flattens every vertical face to nothing.
 */
export interface ResolvedLighting {
  /** Ground: the flat term, already halved. */
  terrainAmbient: Color;
  /** Ground: what the baked intensity multiplies, with the 0.5 folded in. */
  terrainSun: Color;
  /** Static meshes: the flat term, already halved. */
  meshAmbient: Color;
  /** Static meshes: the sun's share of their flat term, scaled by 32/255. */
  meshSun: Color;
}

/**
 * What everything gets before `env.json` arrives, or when it is not served.
 *
 * Deliberately the darkest honest answer rather than a flattering one: a world
 * with nothing to say about its light should look obviously unlit, not
 * plausibly lit by numbers this file made up. It is also brief -- one fetch,
 * shared by every map.
 */
const UNLIT: ResolvedLighting = {
  terrainAmbient: new Color(0, 0, 0),
  terrainSun: new Color(0, 0, 0),
  meshAmbient: new Color(0, 0, 0),
  meshSun: new Color(0, 0, 0),
};

/**
 * Midday. The client's own day runs six times real time and the server states
 * it; until a packet is decoded into game time, standing the world at noon
 * shows the map's colours as the map was lit to be seen.
 */
export const DEFAULT_HOUR = 12;

function toColor(r: number, g: number, b: number): Color {
  // Deliberately *not* decoded as sRGB, unlike the sky and fog colours this
  // project takes off the client. Those are colours someone picked and looked
  // at; these are multipliers a fixed-function pipeline applied to a texel,
  // and the client had no sRGB framebuffer to encode them for. setRGB without
  // a colour space means "already in the working space", which is what a
  // multiplier is.
  return new Color().setRGB(r / 255, g / 255, b / 255);
}

/**
 * The pair of curve points an hour falls between, and how far along it is.
 *
 * The curves carry both ends of the day (entries at T=0 and T=24), so there is
 * nothing to wrap: an hour past the last entry clamps to it, which is what the
 * client does rather than blending back round to midnight.
 */
function bracket<T extends { time: number }>(curve: T[], hour: number): [T, T, number] | null {
  if (!curve.length) return null;
  if (curve.length === 1) return [curve[0], curve[0], 0];

  for (let index = 0; index < curve.length - 1; index++) {
    const from = curve[index];
    const to = curve[index + 1];
    if (hour < from.time || hour >= to.time) continue;
    const span = to.time - from.time;
    return [from, to, span > 0 ? (hour - from.time) / span : 0];
  }

  const last = curve[curve.length - 1];
  return [last, last, 0];
}

function sampleColor(curve: WorldEnvColor[], hour: number, scale: number): Color {
  const found = bracket(curve, hour);
  if (!found) return new Color(0, 0, 0);
  const [from, to, t] = found;
  return toColor(
    (from.color[0] + (to.color[0] - from.color[0]) * t) * scale,
    (from.color[1] + (to.color[1] - from.color[1]) * t) * scale,
    (from.color[2] + (to.color[2] - from.color[2]) * t) * scale
  );
}

function sampleLight(curve: WorldEnvLight[], hour: number, scale: number): Color {
  const found = bracket(curve, hour);
  if (!found) return new Color(0, 0, 0);
  const [from, to, t] = found;
  // Colour and brightness interpolate apart and meet at the end -- see
  // WorldEnvLight. Doing it the other way rounds a dawn's 450 into the span
  // and gives the wrong hue halfway through every transition.
  const brightness = ((from.brightness + (to.brightness - from.brightness) * t) / 255) * scale;
  return toColor(
    (from.color[0] + (to.color[0] - from.color[0]) * t) * brightness,
    (from.color[1] + (to.color[1] - from.color[1]) * t) * brightness,
    (from.color[2] + (to.color[2] - from.color[2]) * t) * brightness
  );
}

export function resolveLighting(env: WorldEnv | null | undefined, hour: number = DEFAULT_HOUR): ResolvedLighting {
  // Cycle 0 is the ordinary day. The other three are the dusk, dawn and
  // cursed-sword cycles, which the server switches the client into; nothing
  // decodes that packet yet, and guessing one would change the whole world's
  // colour on no evidence.
  const cycle = env?.cycles?.[0];
  if (!cycle) return UNLIT;

  const at = ((hour % 24) + 24) % 24;

  return {
    terrainAmbient: sampleColor(cycle.ambient.terrain, at, 0.5),
    terrainSun: sampleLight(cycle.light.terrain, at, 0.5),
    meshAmbient: sampleColor(cycle.ambient.staticMesh, at, 0.5),
    meshSun: sampleLight(cycle.light.staticMesh, at, 32 / 255),
  };
}

/**
 * Which baked shadow plane stands for an hour.
 *
 * The planes are the midpoints of equal slices of the day -- eight of them, at
 * 1.5h, 4.5h and so on -- so the one to use is simply the nearest midpoint.
 * The client blends the two neighbours as time moves; with the hour fixed
 * there is nothing to blend, and a second texture per map to pay for it.
 */
export function shadowPlaneAt(times: number[], hour: number): number {
  if (times.length <= 1) return 0;
  const at = ((hour % 24) + 24) % 24;

  let best = 0;
  let bestDistance = Infinity;
  for (let index = 0; index < times.length; index++) {
    // Round the clock, so 23h is near the 1.5h plane rather than far from it.
    const raw = Math.abs(times[index] - at);
    const distance = Math.min(raw, 24 - raw);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}
