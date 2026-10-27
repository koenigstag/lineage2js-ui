/**
 * Reading the client's global lighting configuration: `system/env.int` and the
 * `system/timeenv<n>.int` curves it names.
 *
 * This is where the world's brightness actually comes from, and finding that
 * out corrected a wrong answer. A level package carries a `LevelInfo` ambient
 * and an `NMovableSunLight`, which look like the obvious source and are not:
 * on 192 of the client's 203 maps the LevelInfo ambient is below 1, because
 * the runtime never reads it. It reads these files instead -- one set for the
 * whole client, a curve per hour of the day, and a *separate* curve per
 * surface class, so terrain, static meshes, BSP and actors are each lit by
 * their own pair of numbers.
 *
 * The field names and the arithmetic are the vendored reader's
 * (unreal-l2js-objects: assets/unreal/conf-files/un-conf-env.ts for the setup,
 * rendering/l2-env.ts for how a curve is sampled), which took them from the
 * client's own disassembly. What is here is the parse; the sampling lives in
 * the UI, where the hour is known.
 *
 * The files are hand-maintained and show it -- a missing closing paren, a
 * missing comma between fields -- so every value is read by pulling
 * `NAME=number` pairs out of it rather than by matching a shape. Being strict
 * here would mean rejecting the client's own data.
 */
import path from "node:path";
import { readConfigFile } from "./l2-dat";

/** A colour at an hour of the day. Hours run 0..24, with both ends present. */
export interface EnvTimeColor {
  time: number;
  color: [number, number, number];
}

/**
 * A light at an hour of the day, already out of the client's HSB space.
 *
 * The client stores hue/saturation/brightness and converts with a curve of its
 * own (`hsvToRgb` in the vendored package), where "saturation" lerps towards
 * white and brightness may exceed 255. It converts at full value and scales by
 * the brightness afterwards, interpolating the two separately -- so the pair
 * is kept apart here, and multiplying them is the consumer's last step.
 */
export interface EnvTimeLight {
  time: number;
  /** hsvToRgb(hue, saturation, 255), 0..255 per channel. */
  color: [number, number, number];
  /** The brightness the colour is scaled by, over 255. Reaches 450 at dawn. */
  brightness: number;
}

/** The four surface classes the client lights separately. */
export interface EnvSurfaces<T> {
  terrain: T;
  staticMesh: T;
  actor: T;
  bsp: T;
}

export interface EnvCycle {
  /** 0 normal, 1 dusk, 2 dawn, 3 cursed-sword -- the file's own `EnvType`. */
  type: number;
  ambient: EnvSurfaces<EnvTimeColor[]>;
  light: EnvSurfaces<EnvTimeLight[]>;
}

/**
 * The five fog bands, in world units, one per view-distance setting.
 *
 * `[FOG]` states them as `StartRange1=1.0`, and the client multiplies by
 * **2048** -- not the 2000 the file's own comment claims. The factor is the
 * vendored renderer's, taken from a trace of the real client (`2.5 * 2048 =
 * 5120`, rendering/render-manager.ts), so it is the one that matches what the
 * game draws. Converted here so that nothing downstream has to carry it.
 *
 * These are the fog, except where the camera stands inside an `L2FogInfo`'s
 * affect range -- a swamp, a cave mouth -- which replaces them outright. That
 * override is what `MapEnvironment.fogRanges` holds, and why those start at 0.
 */
export interface EnvFog {
  ranges: Array<[number, number]>;
  speed: number;
}

export interface ClientEnv {
  /** Hour the client starts the day at, and how many times real time it runs. */
  startTime: number;
  timeRatio: number;
  fog: EnvFog;
  /** Shadow maps baked per terrain sector, and the hours they stand for. */
  shadowMapCount: number;
  shadowMapTimes: number[];
  /** Read and recorded, not used yet: the editor's static-lighting multiplier. */
  staticLightingAdjust: number;
  cycles: EnvCycle[];
}

type HsvToRgb = (hue: number, saturation: number, value: number) => [number, number, number];

/** `NAME=number` pairs anywhere in a value, which is all the shape we trust. */
function fields(value: string): Map<string, number> {
  const found = new Map<string, number>();
  for (const [, name, raw] of value.matchAll(/([A-Za-z]+)\s*=\s*(-?[\d.]+)/g)) {
    found.set(name.toLowerCase(), Number(raw));
  }
  return found;
}

/**
 * Splits a config into sections, each a list of `key -> value` in file order.
 *
 * Keys repeat within a section (`Color1`, `Color2`, ...) and the index in the
 * name is not load-bearing -- the entry's own `T` is -- so the name is kept
 * only to tell one kind of row from another.
 */
function sections(text: string): Map<string, Array<[string, string]>> {
  const found = new Map<string, Array<[string, string]>>();
  let current: Array<[string, string]> = [];

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.replace(/;.*$/, "").trim();
    if (!trimmed) continue;

    const header = trimmed.match(/^\[([^\]]+)\]$/);
    if (header) {
      current = [];
      found.set(header[1].toLowerCase(), current);
      continue;
    }

    const at = trimmed.indexOf("=");
    if (at > 0) current.push([trimmed.slice(0, at).trim().toLowerCase(), trimmed.slice(at + 1).trim()]);
  }

  return found;
}

function scalar(rows: Array<[string, string]> | undefined, key: string, fallback: number): number {
  const row = rows?.find(([name]) => name === key);
  const value = row ? Number.parseFloat(row[1]) : NaN;
  return Number.isFinite(value) ? value : fallback;
}

/** Entries of one curve, in time order, dropping any row without a time. */
function curve<T extends { time: number }>(
  rows: Array<[string, string]> | undefined,
  prefix: string,
  build: (values: Map<string, number>, time: number) => T | null
): T[] {
  const entries: T[] = [];
  for (const [name, value] of rows ?? []) {
    if (!name.startsWith(prefix) || name === "num") continue;
    const values = fields(value);
    const time = values.get("t");
    if (time === undefined) continue;
    const entry = build(values, time);
    if (entry) entries.push(entry);
  }
  return entries.sort((a, b) => a.time - b.time);
}

function colorCurve(rows: Array<[string, string]> | undefined): EnvTimeColor[] {
  return curve(rows, "color", (values, time) => {
    const r = values.get("r");
    const g = values.get("g");
    const b = values.get("b");
    if (r === undefined || g === undefined || b === undefined) return null;
    return { time, color: [r, g, b] as [number, number, number] };
  });
}

function lightCurve(rows: Array<[string, string]> | undefined, hsvToRgb: HsvToRgb): EnvTimeLight[] {
  return curve(rows, "light", (values, time) => {
    const hue = values.get("hue");
    const saturation = values.get("sat");
    const brightness = values.get("bri");
    if (hue === undefined || saturation === undefined || brightness === undefined) return null;
    // Converted at full value, as the client does, so the brightness can be
    // interpolated on its own afterwards.
    return { time, color: hsvToRgb(hue, saturation, 255), brightness };
  });
}

/** `[FOG]`: StartRangeN/EndRangeN as a pair each, in world units. See EnvFog. */
function readFog(rows: Array<[string, string]> | undefined): EnvFog {
  const RANGE_UNITS = 2048;
  const ranges: Array<[number, number]> = [];

  for (let index = 1; ; index++) {
    const start = scalar(rows, `startrange${index}`, NaN);
    const end = scalar(rows, `endrange${index}`, NaN);
    if (!Number.isFinite(start) || !Number.isFinite(end)) break;
    ranges.push([start * RANGE_UNITS, end * RANGE_UNITS]);
  }

  return { ranges, speed: scalar(rows, "fogspeed", 1) };
}

/**
 * Reads the whole lighting configuration out of an installed client.
 *
 * `hsvToRgb` is passed in rather than imported so that the one implementation
 * the project has -- the vendored reader's, which is the client's -- stays the
 * only one. See packages/unreal-l2js-objects/src/utils/hsv-to-rgb.ts.
 */
export function readClientEnv(clientDir: string, hsvToRgb: HsvToRgb): ClientEnv {
  const systemDir = path.join(clientDir, "system");
  const env = sections(readConfigFile(path.join(systemDir, "env.int")));

  const setup = env.get("envsetup");
  const shadowMapCount = Math.max(1, Math.round(scalar(env.get("terrainshadowmap"), "num", 8)));

  const fileCount = Math.max(0, Math.round(scalar(setup, "timeenvfilenum", 0)));
  const cycles: EnvCycle[] = [];

  for (let index = 0; index < fileCount; index++) {
    const name = setup?.find(([key]) => key === `timeenvfilename${index}`)?.[1];
    if (!name) continue;

    const cycle = sections(readConfigFile(path.join(systemDir, name.toLowerCase())));
    cycles.push({
      type: Math.round(scalar(cycle.get("envtype"), "envtype", index)),
      ambient: {
        terrain: colorCurve(cycle.get("terrainambient")),
        staticMesh: colorCurve(cycle.get("staticmeshambient")),
        actor: colorCurve(cycle.get("actorambient")),
        bsp: colorCurve(cycle.get("bspambient")),
      },
      light: {
        terrain: lightCurve(cycle.get("hsvterrainlight"), hsvToRgb),
        staticMesh: lightCurve(cycle.get("hsvstaticmeshlight"), hsvToRgb),
        actor: lightCurve(cycle.get("hsvactorlight"), hsvToRgb),
        bsp: lightCurve(cycle.get("hsvbsplight"), hsvToRgb),
      },
    });
  }

  if (!cycles.length) throw new Error(`${systemDir}: env.int named no TimeEnv files`);

  return {
    startTime: scalar(setup, "starttime", 0),
    timeRatio: scalar(setup, "timeratio", 6),
    fog: readFog(env.get("fog")),
    shadowMapCount,
    // `AutoTimeGeneration=true`, and this is the generated series: the midpoint
    // of each equal slice of the day. Same arithmetic as the sector reader's,
    // which is the client's.
    shadowMapTimes: Array.from(
      { length: shadowMapCount },
      (_, index) => (index * 24) / shadowMapCount + 12 / shadowMapCount
    ),
    staticLightingAdjust: scalar(setup, "staticlightingadjust", 1),
    cycles,
  };
}
