import { Color, Vector3 } from "three";
import { l2ToThree } from "../coords";
import type { MapLighting } from "./map-scene.types";

/**
 * One map's lighting, resolved once and handed to everything that lights
 * anything.
 *
 * There used to be two answers to "how bright is it here". The terrain shader
 * carried three constants written by hand; the static meshes were lit by a
 * three.js ambient plus directional derived from the sky colour. They
 * disagreed by four or five times -- a tree trunk measured (19,17,10) against
 * the grass at (90,99,37) it was standing on -- and neither number came out of
 * the client. This is the one place that answers it now, from what the map
 * says.
 */
export interface ResolvedLighting {
  /** Ambient, 0..1 linear-ish, in the space the materials are written in. */
  ambient: Color;
  /** The sun's colour, same scale. */
  sunColor: Color;
  /** Unit vector *towards* the sun, in three.js space. */
  sunDirection: Vector3;
}

/**
 * What a map gets when it carries no lighting of its own.
 *
 * Deliberately the darkest honest answer rather than a flattering one: a map
 * with nothing to say should look obviously unlit, not plausibly lit by
 * numbers this file made up.
 */
const UNLIT: MapLighting = { sun: null, ambient: [0, 0, 0], zoneAmbient: [] };

function toColor([r, g, b]: [number, number, number]): Color {
  // Deliberately *not* decoded as sRGB, unlike the sky and fog colours this
  // project takes off the client. Those are colours someone picked and looked
  // at; these are multipliers a fixed-function pipeline applied to a texel,
  // and the client had no sRGB framebuffer to encode them for. Reading them as
  // sRGB would push them through a decode they were never encoded by, and a
  // sun of 59/255 would land at 0.044 instead of 0.233 -- dark by a factor of
  // five, on top of the baked shadow term we do not have yet.
  //
  // setRGB without a colour space means "already in the working space", which
  // is what a multiplier is.
  return new Color().setRGB(r / 255, g / 255, b / 255);
}

/** The median of the zone ambients, by luminance. See resolveLighting. */
function medianZoneAmbient(zones: Array<[number, number, number]>): [number, number, number] | null {
  if (!zones.length) return null;
  const sorted = [...zones].sort(
    (a, b) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2] - (0.2126 * b[0] + 0.7152 * b[1] + 0.0722 * b[2])
  );
  return sorted[sorted.length >> 1];
}

/**
 * An Unreal rotator to the direction light arrives *from*.
 *
 * The sun actor's rotator points the way its light travels, so the vector a
 * lambert term wants is the negation of it.
 */
function sunDirectionFrom([pitch, yaw]: [number, number, number]): Vector3 {
  const p = (pitch / 65536) * Math.PI * 2;
  const y = (yaw / 65536) * Math.PI * 2;
  const travel = l2ToThree(Math.cos(p) * Math.cos(y), Math.cos(p) * Math.sin(y), Math.sin(p));
  return travel.normalize().negate();
}

export function resolveLighting(lighting: MapLighting | null | undefined): ResolvedLighting {
  const map = lighting ?? UNLIT;

  // The level's ambient when it has one, the zones' median otherwise. Most
  // maps leave LevelInfo at or near zero and put the real figure on every
  // ZoneInfo -- 22_22's level says 0 while its seventeen zones run 17 to 68 --
  // so reading only the level would black out half the world. Picking the
  // median of the zones is a stand-in for standing in one of them, and it goes
  // away the day something reads the BSP those zones are cut from.
  const levelAmbient = map.ambient;
  const isDark = levelAmbient[0] + levelAmbient[1] + levelAmbient[2] < 1;
  const ambient = (isDark && medianZoneAmbient(map.zoneAmbient)) || levelAmbient;

  return {
    ambient: toColor(ambient),
    sunColor: map.sun ? toColor(map.sun.color) : new Color(0, 0, 0),
    sunDirection: map.sun ? sunDirectionFrom(map.sun.rotation) : new Vector3(0, 1, 0),
  };
}
