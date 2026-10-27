/**
 * Reads the client's Unreal Engine 2 maps (`MAPS/<x>_<y>.unr`) and writes, per
 * map, everything needed to put the real world on screen:
 *
 *   assets/highfive/maps/<x>_<y>/scene.json     terrain metadata + actor placement
 *   assets/highfive/maps/<x>_<y>/heightmap.bin  256x256 16-bit heights, raw
 *   assets/highfive/maps/<x>_<y>/quads.bin      per-quad visibility + edge turn bits
 *
 * and, with `--meshes`, the geometry those actors point at, plus the textures
 * that geometry wears:
 *
 *   assets/highfive/static-meshes/<Package>/    glTF per mesh, via umodel
 *   assets/highfive/static-meshes/meshes.json   per mesh: its textures, LOD chain, size
 *   assets/highfive/static-mesh-textures/<Package>/<Name>.ktx2
 *
 * This is the one part of the client nothing off the shelf reads. umodel
 * covers the assets -- it is what exports the meshes here -- but it has no
 * classes for `TerrainInfo`, `StaticMeshActor` or `Light`, and it refuses
 * `TEXF_G16` outright, which is the format of every heightmap. The readers
 * doing the work are the vendored forks in `packages/unreal-l2js-*`; see
 * `packages/assets-server/README.md` for the format itself.
 *
 * Everything written here derives from the copyrighted client and must never
 * be committed -- it lands under assets/, covered by its blanket .gitignore,
 * same policy as the icons and geodata.
 *
 * Run with:
 *
 *     pnpm --filter @lineage2js/assets-server convert:maps \
 *       --client="D:\Games\Lineage2\L2_HighFive_Client" \
 *       --umodel="C:\ue_viewer\umodel_64.exe" --meshes
 *
 * `--mesh-table` rewrites `static-meshes/meshes.json` alone, from the scene
 * files already baked -- no umodel, no encoder, seconds rather than an hour.
 *
 * `--only=20_18,22_22` restricts to named maps; without `--meshes` it writes
 * the scene files alone, which needs no umodel and takes seconds per map.
 *
 * Textures are the whole weight of this: one map is ~5.6MB of geometry against
 * ~38MB of textures, because umodel *decompresses* them -- the client ships
 * DXT1, umodel writes RGB(A). Re-encoding to KTX2 gets that back and then some
 * (measured on one package: 15.2MB of TGA against 6.2MB of the original DXT,
 * and ~12% of TGA as a modern codec), and unlike PNG or WebP a KTX2 stays
 * block-compressed on the GPU instead of expanding to RGBA in video memory --
 * which matters at fifteen thousand instances. Needs Khronos KTX-Software's
 * `ktx` on PATH (or `--ktx=<path>`).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readClientEnv } from "./client-data/env-config";
import { grayPng } from "./gray-png";
import {
  hsvToRgb,
  openClient,
  quietly,
  saturationToBrightness,
  tolerateInexactReads,
  type ClientLoader,
} from "./unreal/node-loader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAPS_OUT = path.join(__dirname, "../assets/highfive/maps");
const MESHES_OUT = path.join(__dirname, "../assets/highfive/static-meshes");
const TEXTURES_OUT = path.join(__dirname, "../assets/highfive/static-mesh-textures");

/**
 * A map covers exactly one geodata region: 256 terrain quads of 128 units.
 * Mirrors GEO_REGION_SIZE in packages/ui/src/config/geodata.ts, and the two
 * agreeing is not a coincidence -- see the README.
 */
const MAP_SIZE = 32768;
const MAP_ZERO_X = 20;
const MAP_ZERO_Y = 18;

const MAP_FILE_PATTERN = /^(\d+)_(\d+)$/;

interface TerrainLayerInfo {
  texture: string | null;
  /** Its mask over the map; layer 0 is the unmasked base. */
  alphaMap: string | null;
  /**
   * World position -> this layer's texture UV: `uv = (world - offset) * scale`,
   * over the two axes `axis` names.
   *
   * Worked out here rather than in the client because it comes from the
   * terrain's own world->heightmap transform divided by the layer's scale,
   * which is what the engine does (see calcLayerTexCoords in the vendored
   * reader). Pan is folded in; across all 205 maps exactly one layer uses it.
   */
  uvScale: [number, number];
  uvOffset: [number, number];
  /**
   * Which world plane the texture projects down: 0 = XY (the ground, 932 of
   * 974 layers across the client), 1 = XZ, 2 = YZ -- the vertical projections
   * used on cliff faces.
   */
  axis: number;
}

interface ActorInfo {
  mesh: number;
  pos: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  /**
   * `bSunAffect = false`: this actor is indoors and the sun does not reach it.
   * Present only when false, which is the minority -- 312 of 800 actors on
   * 20_18, none at all on an open field map.
   */
  sun?: 0;
  /**
   * What lights it instead: its zone's `AmbientVector`, 0..255.
   *
   * Only on an actor the sun does not reach, and the client's own fallback for
   * exactly that case. Resolved from the actor's own `Region`, which names its
   * zone outright -- no BSP walk, because the editor already did it.
   *
   * A zero here is a real answer, and means the actor is lit by nothing but
   * `lit` below.
   */
  amb?: [number, number, number];
  /**
   * What the `Light` actors around this placement add to it, 0..255, averaged
   * over the mesh.
   *
   * The editor's own answer, out of `UStaticMeshInstance.colorStream` -- one
   * colour per mesh vertex, which is where a torchlit interior gets its
   * light. Present on 8.7% of placements, and the only thing lighting the
   * ones whose zone ambient is zero: of 103 such actors on 20_18, 100 have
   * this and all 103 have the `sceneLights` it was baked from.
   *
   * Averaged because a colour per vertex cannot ride on an `InstancedMesh`,
   * and the spread it gives up is real -- over 20_18's lit instances the
   * standard deviation within one of them is about the size of its own mean,
   * so a wall lit from one end comes out evenly lit. See the README.
   */
  lit?: [number, number, number];
}

/**
 * A `Light` actor: where the light in `ActorInfo.lit` comes from.
 *
 * Baked for what reads them next -- nothing draws one yet, and the per-vertex
 * bake above is the editor's own answer for the static world. The colour is
 * the engine's `getColor()` with brightness already folded in, and the radius
 * is `worldLightRadius()`, the client's `25 * (LightRadius + 1)` rather than
 * the raw property.
 */
interface LightInfo {
  pos: [number, number, number];
  color: [number, number, number];
  radius: number;
}

/** The tail of a tool's output, which is where its complaint is. */
function lastLines(output: string | undefined, count: number): string {
  return (output ?? "").trim().split(/\r?\n/).slice(-count).join(" ");
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

/**
 * `Package.Group.Name`, the same shape umodel names its export directories by.
 *
 * getObjectPath already returns a fully qualified path, but its first segment
 * is the package name as the name table spells it, which is lower-cased.
 * Names resolve without regard to case (Unreal's FName rule, see the objects
 * package README), so that costs nothing when reading -- but umodel writes its
 * output into a directory named after the file, so the file's own spelling is
 * what a consumer has to look under.
 */
function qualifiedName(object: any): string | null {
  if (!object?.exp || !object?.pkg) return null;
  const pkgName = path.basename(String(object.pkg.path)).replace(/\.[^.]+$/, "");
  const objectPath = String(object.pkg.getObjectPath(object.exp));
  const withoutPackage = objectPath.slice(objectPath.indexOf(".") + 1);
  return `${pkgName}.${withoutPackage}`;
}

function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

/**
 * Sky and fog, which the map states outright rather than leaving to taste.
 *
 * `L2FogInfo` carries five distance bands and, per time of day, the colour of
 * the fog and of the sky (`L2EnvironmentColorInfo`). A map has several -- one
 * per zone -- and the first is taken: picking by the zone the camera stands in
 * needs the BSP the zones are defined by, which nothing here reads yet.
 *
 * `NSun` and `NMoon` are billboards far outside the map, in the sky zone;
 * their rotation is what the light comes from.
 */
function readEnvironment(pkg: any): Record<string, unknown> | null {
  const [fogEntry] = pkg.exportGroups["L2FogInfo"] ?? [];
  if (!fogEntry) return null;

  const fog = pkg.fetchObject(fogEntry.index + 1).loadSelf();
  const range = (r: any): [number, number] => [round(r?.min ?? 0), round(r?.max ?? 0)];
  const color = (c: any): [number, number, number] => [c?.r ?? 255, c?.g ?? 255, c?.b ?? 255];

  const times: Record<string, unknown>[] = [];
  for (let i = 0; i < (fog.colors?.length ?? 0); i++) {
    const entry = fog.colors[i]?.loadSelf?.() ?? fog.colors[i];
    if (!entry) continue;
    times.push({
      time: round(entry.time ?? 0, 2),
      fog: color(entry.fogColor),
      sky: color(entry.skyColor),
      haze: entry.hazeringColor?.length ? color(entry.hazeringColor[0]) : null,
    });
  }

  const celestial = (cls: string): Record<string, unknown> | null => {
    const [entry] = pkg.exportGroups[cls] ?? [];
    if (!entry) return null;
    const body = pkg.fetchObject(entry.index + 1).loadSelf();
    return {
      radius: round(body.radius ?? 0),
      // Unreal rotator; the direction the light arrives from.
      rotation: body.rotation ? [body.rotation.pitch, body.rotation.yaw, body.rotation.roll] : [0, 0, 0],
    };
  };

  return {
    // Five bands, near to far, in world units. The client fades between them;
    // the nearest and the farthest are what a single fog needs.
    fogRanges: [fog.fogRange1, fog.fogRange2, fog.fogRange3, fog.fogRange4, fog.fogRange5].map(range),
    times,
    sun: celestial("NSun"),
    moon: celestial("NMoon"),
  };
}

/**
 * The TerrainInfo that is this map's own ground.
 *
 * Nearly every map has exactly one -- but not all. 12_24 carries a second at
 * half the usual quad size and offset 3296 units from the map's own corner: a
 * piece of set-dressing terrain the level keeps beside the real one. Taking
 * the first export put that one in the scene file, which placed the map's
 * ground 11353 units below its neighbours and off the geodata it is supposed
 * to agree with.
 *
 * The map's own terrain is the one whose heightmap sample (0, 0) lands on the
 * map's minimum corner -- the same arithmetic the scene file's `worldOrigin`
 * uses. Nothing cheaper separates them: both report the same `mapX`/`mapY`.
 */
function pickTerrain(pkg: any, worldOrigin: [number, number]): TerrainPick {
  const entries = pkg.exportGroups["TerrainInfo"] ?? [];
  if (!entries.length) return { terrain: null, exports: 0, onOwnCorner: false };

  const loaded = entries.map((entry: any) => pkg.fetchObject(entry.index + 1).loadSelf());
  const own = loaded.find((terrain: any) => {
    const { origin, xAxis, yAxis } = terrain.toWorld;
    return (
      Math.abs(-origin.x * xAxis.x - worldOrigin[0]) <= 1 && Math.abs(-origin.y * yAxis.y - worldOrigin[1]) <= 1
    );
  });

  // Reported, not logged: this runs inside `quietly`, which silences log and
  // warn alike, and a map with more than one terrain is the one thing here
  // that should never pass unmentioned.
  return { terrain: own ?? loaded[0], exports: entries.length, onOwnCorner: Boolean(own) };
}

interface TerrainPick {
  terrain: any | null;
  /** How many the map carries; more than one is worth saying out loud. */
  exports: number;
  /** Whether the one taken stands on the map's own minimum corner. */
  onOwnCorner: boolean;
}

/**
 * The lighting actors in the level: the sun, and the ambient the level and its
 * zones carry.
 *
 * **Not the world's light**, which was the mistake this block was first
 * written to make. These are the obvious source and the runtime reads none of
 * them for colour: it reads the global curves in `system/env.int` and
 * `timeenv<n>.int` instead (see readClientEnv). The tell is in the data --
 * 192 of the 203 maps leave this LevelInfo ambient below 1 -- and 22_22's
 * zones ranging 17 to 68 against a level ambient of 0 is the same story, not
 * a better source.
 *
 * What the UI takes from here is `sun.rotation`, the direction static meshes
 * are lit from. The rest stays because the zone ambients are real level data
 * the BSP work will want, and because leaving them out would make the
 * measurement above impossible to repeat.
 *
 * `NMovableSunLight` is an actual light rather than the `NSun` billboard, and
 * its `getColor()` folds brightness into the colour. The ambients sit on
 * `AmbientBrightness`/`Hue`/`Saturation` with no method of their own, so they
 * go through the engine's `hsvToRgb` directly.
 */
function readLighting(pkg: any): Record<string, unknown> | null {
  const colorOf = (brightness: number, hue: number, saturation: number): [number, number, number] => {
    const [r, g, b] = hsvToRgb(hue ?? 0, saturation ?? 255, 255);
    const scale = saturationToBrightness(brightness ?? 0);
    return [round(r * scale, 2), round(g * scale, 2), round(b * scale, 2)];
  };

  const first = (cls: string): any => {
    const [entry] = pkg.exportGroups[cls] ?? [];
    return entry ? pkg.fetchObject(entry.index + 1).loadSelf() : null;
  };

  const sunLight = first("NMovableSunLight");
  // Its own rotator where it has one; the NSun billboard otherwise, which is
  // the same direction expressed on the thing you can see.
  const sunRotation = sunLight?.rotation ?? first("NSun")?.rotation;
  const sun = sunLight
    ? {
        color: sunLight.getColor().map((c: number) => round(c, 2)) as [number, number, number],
        rotation: sunRotation ? [sunRotation.pitch, sunRotation.yaw, sunRotation.roll] : [0, 0, 0],
      }
    : null;

  const level = first("LevelInfo");
  const ambient = level
    ? colorOf(level.ambientBrightness, level.ambientHue, level.ambientSaturation)
    : ([0, 0, 0] as [number, number, number]);

  const zones: Array<[number, number, number]> = [];
  for (const entry of pkg.exportGroups["ZoneInfo"] ?? []) {
    try {
      const zone = pkg.fetchObject(entry.index + 1).loadSelf();
      zones.push(colorOf(zone.ambientBrightness, zone.ambientHue, zone.ambientSaturation));
    } catch {
      // a zone that will not read says nothing about the others
    }
  }

  if (!sun && !level && !zones.length) return null;
  return { sun, ambient, zoneAmbient: zones };
}

function readTerrain(terrain: any): Record<string, unknown> | null {
  if (!terrain) return null;

  // World -> heightmap index. A layer's texture UV is that index divided by
  // the layer's own scale.
  const toHeightMap = terrain.toHeightMap;

  const layers: TerrainLayerInfo[] = [];
  for (let i = 0; i < (terrain.layers?.length ?? 0); i++) {
    const layer = terrain.layers[i];
    if (!layer?.map) continue;

    const uScale = layer.scaleW || 1;
    const vScale = layer.scaleH || 1;
    layers.push({
      texture: qualifiedName(layer.map),
      alphaMap: qualifiedName(layer.alphaMap),
      uvScale: [round(toHeightMap.xAxis.x / uScale, 9), round(toHeightMap.yAxis.y / vScale, 9)],
      uvOffset: [
        round(toHeightMap.origin.x - (layer.panW ?? 0) * uScale, 3),
        round(toHeightMap.origin.y - (layer.panH ?? 0) * vScale, 3),
      ],
      axis: layer.mapAxis ?? 0,
    });
  }

  const scale = terrain.terrainScale;
  const toWorld = terrain.toWorld;
  const axis = (v: any): [number, number, number] => [round(v.x, 6), round(v.y, 6), round(v.z, 6)];

  return {
    scale: [round(scale.x), round(scale.y), round(scale.z)],
    heightmap: {
      width: terrain.heightmapX,
      height: terrain.heightmapY,
      // TEXF_G16: unsigned 16-bit little-endian, one sample per vertex.
      format: "g16",
      file: "heightmap.bin",
    },
    // Two bit-per-quad maps, concatenated: visibility then edge turn. See
    // readQuadBitmaps.
    quads: { file: "quads.bin" },
    // Unreal's TransformPointBy subtracts the origin before projecting onto
    // the axes, so a sample becomes:
    //   world = ((hx, hy, height) - origin) . (xAxis, yAxis, zAxis)
    toWorld: {
      origin: axis(toWorld.origin),
      xAxis: axis(toWorld.xAxis),
      yAxis: axis(toWorld.yAxis),
      zAxis: axis(toWorld.zAxis),
    },
    sectors: terrain.sectors?.length ?? 0,
    layers,
  };
}

/**
 * The two per-quad bitmaps, packed as the client packs them: one bit per quad
 * at `x + y * heightmapWidth`, least significant bit first.
 *
 * `quadVisibility` is what makes a hole a hole -- a cave mouth is a quad the
 * terrain does not draw, and without it the world is sealed. `edgeTurn` says
 * which diagonal a quad is split along, which decides the silhouette of every
 * ridge and hollow.
 *
 * Written as one file rather than into the scene JSON: 16kB of bits would be
 * 22kB of base64 in a file that is otherwise 63kB.
 */
function readQuadBitmaps(terrain: any): Uint8Array | null {
  if (!terrain) return null;

  const visibility = terrain.quadVisibilityBitmapOrig ?? terrain.quadVisibilityBitmap;
  const edgeTurn = terrain.edgeTurnBitmapOrig ?? terrain.edgeTurnBitmap;
  if (!visibility || !edgeTurn) return null;

  const bytes = (array: any): Uint8Array => {
    const typed = array.getTypedArray?.();
    return typed ? new Uint8Array(typed.buffer, typed.byteOffset, typed.byteLength) : new Uint8Array(0);
  };

  const a = bytes(visibility);
  const b = bytes(edgeTurn);
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

/**
 * The baked sun intensity, one plane per hour of the day the client bakes for.
 *
 * This is the term that makes the world look lit. The client's terrain has no
 * diffuse lighting at all -- no dot product against a sun direction -- because
 * the editor already did that work per vertex and stored the answer here,
 * occlusion included. `UTerrainSector::SetIntensityMap` adds it as
 * `sunColor * intensity / 255 * 0.5`, and the values are a smooth field over
 * the whole range: 213 is typical open ground, and a sixth of a map reads 0
 * where a hill or a building takes the sun away.
 *
 * Each sector stores its own 17x17 bytes, one per vertex of its 16x16 quads,
 * so the planes are assembled the way the sector reader assembles vertices:
 * sample `(x + offsetX, y + offsetY)`, clamped to the heightmap's last row and
 * column. That clamp means adjacent sectors write the same global sample
 * twice, from their own shared edge. They agree almost always -- 116 of 8448
 * shared samples differ on 20_19 -- and where they do not, one of them is the
 * sector a shadow edge happens to end on. Last writer wins; the alternative is
 * duplicating vertices to keep a difference the player cannot see.
 */
function readShadowMaps(terrain: any): { width: number; height: number; times: number[]; planes: Uint8Array[] } | null {
  const sectors: any[] = terrain?.sectors ?? [];
  if (!sectors.length) return null;

  const width = terrain.heightmapX;
  const height = terrain.heightmapY;
  let planes: Uint8Array[] | null = null;
  let times: number[] = [];

  for (const entry of sectors) {
    const sector = entry?.loadSelf?.() ?? entry;
    const maps = sector?.shadowMaps;
    if (!maps?.length) continue;

    if (!planes) {
      times = (sector.shadowMapTimes ?? []).map((time: number) => round(time, 3));
      // Unlit until a sector says otherwise: a map whose sectors do not all
      // carry shadows should show the gap, not a plausible fill.
      planes = Array.from({ length: maps.length }, () => new Uint8Array(width * height));
    }

    for (let plane = 0; plane < planes.length; plane++) {
      const source = maps[plane]?.getTypedArray?.() as Uint8Array | undefined;
      if (!source) continue;
      for (let y = 0; y < 17; y++) {
        const row = Math.min(y + sector.offsetY, height - 1) * width;
        for (let x = 0; x < 17; x++) {
          planes[plane][row + Math.min(x + sector.offsetX, width - 1)] = source[y * 17 + x];
        }
      }
    }
  }

  return planes ? { width, height, times, planes } : null;
}

/** The heightmap is an ordinary texture object -- in the one format umodel will not export. */
function readHeightmap(terrain: any): Uint8Array | null {
  if (!terrain) return null;

  const map = terrain.terrainMap?.loadSelf?.();
  const mip = map?.mipmaps?.getElem?.(0) ?? map?.mipmaps?.[0];
  const bytes = mip?.dataArray?.getTypedArray?.() as Uint8Array | undefined;
  if (!bytes) return null;

  const expected = map.width * map.height * 2;
  if (bytes.length !== expected) {
    throw new Error(`heightmap is ${bytes.length} bytes, expected ${expected} for ${map.width}x${map.height}`);
  }
  return bytes;
}

/**
 * The light the editor baked into one placement, averaged over its vertices.
 *
 * `colorStream` holds one colour per mesh vertex and is the `Light` actors'
 * contribution only -- it sits on top of the sun or the zone ambient rather
 * than replacing either, which is how the client's own shader adds it
 * (`vLitColor = lighting + staticMeshSunAmbient * sunAffected`). An instance
 * with nothing near it has a stream of zeroes, which is most of the world.
 */
function instanceLight(actor: any): [number, number, number] | null {
  const stream = actor.instance?.loadSelf?.()?.colorStream;
  const count = stream?.getElemCount?.() ?? 0;
  if (!count) return null;

  let r = 0;
  let g = 0;
  let b = 0;
  for (let index = 0; index < count; index++) {
    const [cr, cg, cb] = stream.getColor(index);
    r += cr;
    g += cg;
    b += cb;
  }

  if (!r && !g && !b) return null;
  return [round(r / count, 1), round(g / count, 1), round(b / count, 1)];
}

/**
 * Every `Light` actor on the map. See LightInfo.
 *
 * Read off the same `getColor()` the sun uses, so brightness is already in
 * the colour. A light the editor left at zero brightness is dropped: it
 * contributes nothing and there are a lot of them.
 */
function readLights(pkg: any): LightInfo[] {
  const lights: LightInfo[] = [];

  for (const entry of pkg.exportGroups["Light"] ?? []) {
    let light: any;
    try {
      light = pkg.fetchObject(entry.index + 1).loadSelf();
    } catch {
      continue;
    }
    if (!light?.location) continue;

    const [r, g, b] = light.getColor?.() ?? [0, 0, 0];
    if (!r && !g && !b) continue;

    lights.push({
      pos: [round(light.location.x, 2), round(light.location.y, 2), round(light.location.z, 2)],
      color: [round(r, 2), round(g, 2), round(b, 2)],
      radius: round(light.worldLightRadius?.() ?? 0, 1),
    });
  }

  return lights;
}

function readActors(pkg: any): { meshes: string[]; actors: ActorInfo[]; skipped: number } {
  const meshIds = new Map<string, number>();
  const actors: ActorInfo[] = [];
  let skipped = 0;

  for (const entry of pkg.exportGroups["StaticMeshActor"] ?? []) {
    let actor: any;
    try {
      actor = pkg.fetchObject(entry.index + 1).loadSelf();
    } catch {
      skipped++;
      continue;
    }

    const name = qualifiedName(actor.mesh);
    if (!name || !actor.location) {
      // An actor whose mesh reference did not resolve draws nothing in the
      // real client either -- Unreal treats an unresolvable reference as None.
      skipped++;
      continue;
    }

    let mesh = meshIds.get(name);
    if (mesh === undefined) {
      mesh = meshIds.size;
      meshIds.set(name, mesh);
    }

    const record: ActorInfo = {
      mesh,
      // L2 world units, exactly as the client stores them. The UI converts to
      // three.js space itself (utils/coords), the same as it does for creature
      // positions off the wire -- converting here would bake one client's
      // axis convention into the asset.
      pos: [round(actor.location.x, 2), round(actor.location.y, 2), round(actor.location.z, 2)],
    };

    const rot = actor.rotation;
    if (rot && (rot.pitch || rot.yaw || rot.roll)) {
      // Unreal rotator units: 65536 to the turn, not radians.
      record.rot = [rot.pitch, rot.yaw, rot.roll];
    }

    const drawScale = actor.drawScale ?? 1;
    const s = actor.scale;
    const sx = round((s?.x ?? 1) * drawScale, 5);
    const sy = round((s?.y ?? 1) * drawScale, 5);
    const sz = round((s?.z ?? 1) * drawScale, 5);
    if (sx !== 1 || sy !== 1 || sz !== 1) record.scale = [sx, sy, sz];

    // Indoors, the sun is simply switched off for this actor and its zone's
    // ambient takes over -- the client's own branch, see UStaticMeshActor's
    // `if (!this.isSunAffected)`. Both halves have to travel: without the
    // ambient the actor would be black, and a zero ambient is a real answer
    // (103 actors on 20_18), not a missing one.
    if (actor.isSunAffected === false) {
      record.sun = 0;
      const ambient = actor.getZone?.()?.loadSelf?.()?.ambientVector;
      record.amb = [
        round((ambient?.x ?? 0) * 255, 1),
        round((ambient?.y ?? 0) * 255, 1),
        round((ambient?.z ?? 0) * 255, 1),
      ];
    }

    const lit = instanceLight(actor);
    if (lit) record.lit = lit;

    actors.push(record);
  }

  return { meshes: [...meshIds.keys()], actors, skipped };
}

async function convertMap(loader: ClientLoader, mapName: string): Promise<Set<string>> {
  const [, rawX, rawY] = mapName.match(MAP_FILE_PATTERN) ?? [];
  if (!rawX) throw new Error(`Not a map name: ${mapName}`);
  const mapX = Number(rawX);
  const mapY = Number(rawY);

  const pkg = await loader.load(loader.getPackage(mapName, "Level"));

  // World coordinates of the map's minimum corner. Region 20_18 starts at
  // world origin, which is what makes these line up with the geodata tiles --
  // and what tells pickTerrain which TerrainInfo is this map's own ground.
  const worldOrigin: [number, number] = [(mapX - MAP_ZERO_X) * MAP_SIZE, (mapY - MAP_ZERO_Y) * MAP_SIZE];

  const { terrain, heightmap, quads, shadow, environment, lighting, lights, meshes, actors, skipped, pick } = quietly(() => {
    // One pick, shared: the transform, the heightmap and the bitmaps have to
    // come from the same terrain or they describe different ground.
    const pick = pickTerrain(pkg, worldOrigin);
    return {
      pick,
      terrain: readTerrain(pick.terrain),
      heightmap: readHeightmap(pick.terrain),
      quads: readQuadBitmaps(pick.terrain),
      shadow: readShadowMaps(pick.terrain),
      environment: tolerateInexactReads(() => readEnvironment(pkg)).value,
      lighting: readLighting(pkg),
      lights: readLights(pkg),
      ...readActors(pkg),
    };
  });

  const outDir = path.join(MAPS_OUT, mapName);
  await fs.mkdir(outDir, { recursive: true });

  if (terrain && shadow) {
    // One file per hour the client bakes for, so a viewer fetches the two that
    // bracket the time of day rather than all eight.
    terrain.shadow = {
      width: shadow.width,
      height: shadow.height,
      times: shadow.times,
      files: shadow.planes.map((_, index) => `shadow-${index}.png`),
    };
  }

  const scene = {
    map: [mapX, mapY],
    worldOrigin,
    worldSize: MAP_SIZE,
    terrain: terrain ?? null,
    environment: environment ?? null,
    lighting: lighting ?? null,
    lights,
    meshes,
    actors,
  };

  await fs.writeFile(path.join(outDir, "scene.json"), JSON.stringify(scene));
  if (heightmap) await fs.writeFile(path.join(outDir, "heightmap.bin"), heightmap);
  if (quads) await fs.writeFile(path.join(outDir, "quads.bin"), quads);
  if (shadow) {
    await Promise.all(
      shadow.planes.map((plane, index) =>
        fs.writeFile(path.join(outDir, `shadow-${index}.png`), grayPng(shadow.width, shadow.height, plane))
      )
    );
  }

  const packages = new Set(meshes.map((name) => name.split(".")[0].toLowerCase()));

  console.log(
    `${mapName}: ${actors.length} actors, ${meshes.length} meshes from ${packages.size} packages` +
      `${terrain ? `, terrain ${(terrain.heightmap as any).width}x${(terrain.heightmap as any).height}` : ", no terrain"}` +
      `${shadow ? `, ${shadow.planes.length} shadow planes` : ", no shadow maps"}` +
      `, ${lights.length} lights, ${actors.filter((a) => a.lit).length} lit placements` +
      `${skipped ? `, ${skipped} skipped` : ""}` +
      `${
        pick.exports > 1
          ? `, ${pick.exports} TerrainInfo exports (${
              pick.onOwnCorner ? "took the one on the map's own corner" : "NONE on the map's corner, took the first"
            })`
          : ""
      }`
  );

  return packages;
}

/** Every terrain layer texture and mask the written scene files name. */
async function referencedTerrainTextures(mapNames?: string[]): Promise<Set<string>> {
  const wanted = new Set(mapNames);
  const textures = new Set<string>();
  for (const entry of await fs.readdir(MAPS_OUT)) {
    if (mapNames && !wanted.has(entry)) continue;
    let scene: { terrain?: { layers?: { texture?: string | null; alphaMap?: string | null }[] } };
    try {
      scene = JSON.parse(await fs.readFile(path.join(MAPS_OUT, entry, "scene.json"), "utf8"));
    } catch {
      continue;
    }
    for (const layer of scene.terrain?.layers ?? []) {
      if (layer.texture) textures.add(layer.texture);
      if (layer.alphaMap) textures.add(layer.alphaMap);
    }
  }
  return textures;
}

/**
 * Every mesh name the written scene files refer to, restricted to the maps
 * this run covered -- otherwise a `--only` run would go and encode textures
 * for every map ever baked.
 */
async function referencedMeshes(mapNames?: string[]): Promise<Set<string>> {
  const wanted = mapNames ? new Set(mapNames) : null;
  const meshes = new Set<string>();
  for (const entry of await fs.readdir(MAPS_OUT)) {
    if (wanted && !wanted.has(entry)) continue;
    let scene: { meshes?: string[] };
    try {
      scene = JSON.parse(await fs.readFile(path.join(MAPS_OUT, entry, "scene.json"), "utf8"));
    } catch {
      continue;
    }
    for (const mesh of scene.meshes ?? []) meshes.add(mesh);
  }
  return meshes;
}

/**
 * Resolves every referenced mesh's material slots to the textures they wear.
 *
 * Done as its own pass, a package at a time, rather than while the maps are
 * being read: a mesh is referenced by many maps and its materials do not
 * depend on where it stands.
 */
async function collectMeshInfo(loader: ClientLoader, meshes: Set<string>): Promise<Record<string, MeshInfo>> {
  const byPackage = new Map<string, string[]>();
  for (const name of meshes) {
    const pkg = name.split(".")[0].toLowerCase();
    const list = byPackage.get(pkg) ?? [];
    list.push(name);
    byPackage.set(pkg, list);
  }

  const info: Record<string, MeshInfo> = {};
  // Named, not counted: "4 could not be read" out of 8273 is easy to wave off,
  // and which four it is decides whether that matters.
  const failed: string[] = [];

  async function resolve(wanted: Map<string, string[]>): Promise<void> {
    for (const [pkgName, names] of wanted) {
      let pkg: any;
      try {
        pkg = await loader.load(loader.getPackage(pkgName, "StaticMesh"));
      } catch {
        failed.push(...names);
        continue;
      }

      const exports = new Map<string, any>();
      for (const entry of pkg.exportGroups["StaticMesh"] ?? []) {
        exports.set(String(entry.export.objectName).toLowerCase(), entry);
      }

      quietly(() => {
        for (const name of names) {
          const entry = exports.get(name.split(".").pop()!.toLowerCase());
          if (!entry) {
            failed.push(name);
            continue;
          }
          try {
            info[name] = meshInfo(pkg.fetchObject(entry.index + 1).loadSelf(), qualifiedName);
          } catch {
            failed.push(name);
          }
        }
      });
    }
  }

  await resolve(byPackage);

  // A mesh's LOD is a mesh in its own right, with its own materials, and the
  // renderer swaps to it by name -- so it needs its own row or it arrives with
  // no texture and no blend at all, which is a distant tree rendered as a flat
  // green card. The chain is only known once the base mesh has been read,
  // hence the second pass; a LOD naming a LOD of its own would need a third,
  // so this runs to a fixed point.
  for (let pass = 0; pass < 4; pass++) {
    const missing = new Map<string, string[]>();
    for (const entry of Object.values(info)) {
      for (const lod of entry.lods ?? []) {
        if (info[lod] || failed.includes(lod)) continue;
        const pkg = lod.split(".")[0].toLowerCase();
        const list = missing.get(pkg) ?? [];
        list.push(lod);
        missing.set(pkg, list);
      }
    }
    if (missing.size === 0) break;
    await resolve(missing);
  }

  const withLod = Object.values(info).filter((entry) => entry.lods).length;
  console.log(`meshes: ${Object.keys(info).length} resolved (${withLod} with LOD), ${failed.length} could not be read`);
  if (failed.length) console.log(`  unread: ${failed.slice(0, 20).join(", ")}${failed.length > 20 ? ", ..." : ""}`);
  return info;
}

/**
 * How a material slot is blended, when the client wraps it in a Shader.
 *
 * Absent means the slot was a bare `StaticMeshMaterial -> Texture`: opaque,
 * which is what bark, stone and walls are. Present means foliage, glass,
 * water and the like -- drawn opaque, a leaf texture becomes a solid card.
 */
interface SlotBlend {
  /** `Shader.OutputBlending`. Foliage is `normal` *with* an opacity, not `masked`. */
  mode: (typeof BLEND_MODES)[number];
  /** `Shader.AlphaRef` as a 0..1 fraction. The client's leaves use 1/255 and 10/255. */
  alphaRef: number;
  /** Whether the Shader carries an Opacity at all -- the engine's own test for enabling blending. */
  opacity: boolean;
}

/** What the UI needs about a mesh beyond its geometry. */
interface MeshInfo {
  /** Per material slot, the texture it wears. */
  textures: (string | null)[];
  /** Per material slot, how it blends -- only when some slot is not plain opaque. */
  blends?: (SlotBlend | null)[];
  /**
   * Per material slot, `[clampU, clampV]` from the texture's own
   * UClampMode/VClampMode -- only for the slots that do not simply tile.
   */
  clamps?: ([boolean, boolean] | null)[];
  /**
   * The client's own simplified versions, nearest first. Only some meshes have
   * them -- 35 of 603 in one package, and they are the trees, which is also
   * where they pay: LOD1 is about 40% of the base triangle count and LOD2 is a
   * four-triangle crossed billboard.
   */
  lods?: string[];
  /** Bounding sphere radius in client units, for picking a LOD and a load distance. */
  radius: number;
}

/**
 * The texture each of a mesh's material slots resolves to, fully qualified,
 * plus its LOD chain and size.
 *
 * A slot is a `StaticMeshMaterial` wrapping either the texture directly or a
 * `Shader` that wraps it (which is what the client uses for anything masked --
 * foliage, chains, grates). Walking to the texture is the only way to learn
 * which *package* it lives in: umodel names a glTF material after the texture
 * object alone, and the same name occurs in more than one package.
 */
/** `Shader.OutputBlending`, in the engine's own order. */
const BLEND_MODES = ["normal", "masked", "modulate", "translucent", "invisible", "brighten", "darken"] as const;

function meshInfo(mesh: any, qualify: (o: any) => string | null): MeshInfo {
  const textures: (string | null)[] = [];
  const blends: (SlotBlend | null)[] = [];
  const clamps: ([boolean, boolean] | null)[] = [];

  for (let i = 0; i < (mesh.materials?.length ?? 0); i++) {
    let node = mesh.materials[i];
    let texture: string | null = null;
    let blend: SlotBlend | null = null;
    let clamp: [boolean, boolean] | null = null;

    for (let depth = 0; node && depth < 6; depth++) {
      node = node.loadSelf?.() ?? node;
      const name = qualify(node);

      // A Shader on the way down is the client saying how this slot is drawn.
      // Tree bark goes StaticMeshMaterial -> Texture and is simply opaque;
      // foliage goes through a Shader carrying an Opacity, which is what the
      // engine tests for before it enables blending at all:
      //
      //   if (OutputBlending == OB_Normal && !Opacity) glDisable(GL_BLEND);
      //
      // so the Opacity matters as much as the mode does.
      if (node.outputBlending !== undefined) {
        const mode = BLEND_MODES[Number(node.outputBlending?.valueOf?.() ?? node.outputBlending)] ?? "normal";
        const ref = typeof node.alphaTest === "number" ? node.alphaTest : 0;
        blend = { mode, alphaRef: round(ref / 255, 4), opacity: Boolean(node.opacity) };
      }

      // A texture is where the walk stops; anything else is a wrapper whose
      // own `material` is the next link.
      if (node.mipmaps) {
        texture = name;
        // UClampMode/VClampMode, TC_Wrap = 0 and TC_Clamp = 1. Bark, walls and
        // floors tile; three defaults a texture to clamped, which smears the
        // last column of a trunk down its whole length instead of repeating
        // it. Only the exceptions are written -- wrapping is the common case.
        const cu = Number(node.wrapS?.valueOf?.() ?? node.wrapS ?? 0) === 1;
        const cv = Number(node.wrapT?.valueOf?.() ?? node.wrapT ?? 0) === 1;
        if (cu || cv) clamp = [cu, cv];
        break;
      }
      node = node.material ?? node.diffuse;
    }

    textures.push(texture);
    blends.push(blend);
    clamps.push(clamp);
  }

  const lods: string[] = [];
  if (mesh.hasStaticMeshLod) {
    for (const lod of [mesh.staticMeshLod1, mesh.staticMeshLod2]) {
      const name = lod && qualify(lod);
      if (name) lods.push(name);
    }
  }

  const sphere = mesh.boundingSphere;
  const box = mesh.boundingBox;
  const radius =
    sphere?.w ??
    (box ? Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z) / 2 : 0);

  return {
    textures,
    radius: Math.round(radius),
    // Left out entirely when every slot is a plain opaque texture, which is
    // most of them -- this table is already 2.2MB.
    ...(blends.some(Boolean) ? { blends } : {}),
    // Likewise: a texture that tiles is the normal case and says nothing.
    ...(clamps.some(Boolean) ? { clamps } : {}),
    ...(lods.length > 0 ? { lods } : {}),
  };
}

/** Qualified name -> `<Package>/<Name>`, the path this project stores a texture under. */
function texturePath(qualifiedName: string): string {
  const parts = qualifiedName.split(".");
  return `${parts[0]}/${parts[parts.length - 1]}`;
}

/**
 * Re-encodes the textures a map's meshes wear, and points the meshes at them.
 *
 * umodel writes PNG; `ktx` turns that into a KTX2 with Basis supercompression,
 * which is what makes it both small to fetch and cheap in video memory. The
 * glTF files umodel wrote carry no images at all -- just material names -- so
 * each one is rewritten here to reference its textures through
 * KHR_texture_basisu.
 */
function exportTextures(
  umodel: string,
  ktx: string,
  client: string,
  meshes: Record<string, MeshInfo>,
  terrain: Set<string>
): void {
  // The terrain's own layer textures and masks go through the same encode --
  // they are ordinary textures in the map's .utx, and they are the ground.
  const wanted = new Set<string>(terrain);
  for (const entry of Object.values(meshes)) {
    for (const name of entry.textures) if (name) wanted.add(name);
  }

  const packages = new Set([...wanted].map((name) => name.split(".")[0].toLowerCase()));
  // Intermediates go to the OS temp directory, not under assets/ -- everything
  // there is served, and the decompressed PNGs are an order of magnitude
  // larger than the KTX2 files they become (137MB against 3.8MB for one map).
  const staging = path.join(os.tmpdir(), "lineage2js-static-mesh-textures");

  console.log(`textures: ${wanted.size} referenced from ${packages.size} packages`);

  for (const name of [...packages].sort()) {
    // Most textures live in a `.utx`, but not all: a few packages keep their
    // textures inside the static-mesh package that uses them, and asking for
    // the wrong extension is a hard "failed to load provided packages" rather
    // than an empty export. Three of the client's 373 packages are like this
    // (Field_Deco_Artifact_S, gludio_dungeon_enterance_s, innadecobuild), and
    // between them they carry 17 textures.
    let result;
    for (const extension of ["utx", "usx"]) {
      result = spawnSync(
        umodel,
        [`-path=${client}`, "-game=l2", "-export", "-png", `-out=${staging}`, "-nooverwrite", `${name}.${extension}`],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
      );
      if (result.status === 0) break;
    }
    if (result!.status !== 0) {
      console.warn(`  umodel failed on ${name} (.utx and .usx): ${lastLines(result!.stderr || result!.stdout, 2)}`);
    }
  }

  let encoded = 0;
  let missing = 0;
  for (const name of [...wanted].sort()) {
    const source = findExportedPng(staging, name);
    if (!source) {
      missing++;
      continue;
    }
    const target = path.join(TEXTURES_OUT, `${texturePath(name)}.ktx2`);
    fsSync.mkdirSync(path.dirname(target), { recursive: true });
    if (fsSync.existsSync(target)) {
      encoded++;
      continue;
    }
    // basis-lz is the small, universally transcodable encoding; the alternative
    // (uastc) is several times larger and is for textures whose quality has to
    // survive, which scenery colour maps do not.
    const result = spawnSync(
      ktx,
      ["create", "--format", "R8G8B8A8_SRGB", "--encode", "basis-lz", "--generate-mipmap", "--assign-oetf", "srgb", source, target],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
    );
    if (result.status !== 0) {
      console.warn(`  ktx failed on ${name}: ${(result.stderr || result.stdout || "").trim().split("\n").slice(-2).join(" ")}`);
      continue;
    }
    encoded++;
  }

  console.log(`textures: ${encoded} encoded to KTX2, ${missing} had no exported image`);
}

/** umodel lays a texture out by class, and the class differs (Texture, Shader, ...). */
function findExportedPng(staging: string, qualifiedName: string): string | undefined {
  const parts = qualifiedName.split(".");
  const pkg = parts[0];
  const file = `${parts[parts.length - 1]}.png`;
  const root = path.join(staging, pkg);
  if (!fsSync.existsSync(root)) return undefined;
  for (const dir of fsSync.readdirSync(root)) {
    const candidate = path.join(root, dir, file);
    if (fsSync.existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * One umodel call per package, never per object -- whole-package export is the
 * difference between seconds and minutes, and every map that reuses a package
 * reuses the same output.
 */
function exportMeshes(umodel: string, client: string, packages: Set<string>): void {
  let done = 0;
  for (const name of [...packages].sort()) {
    const result = spawnSync(
      umodel,
      [`-path=${client}`, "-game=l2", "-export", "-gltf", `-out=${MESHES_OUT}`, "-nooverwrite", `StaticMeshes/${name}.usx`],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    if (result.status !== 0) {
      console.warn(`  umodel failed on ${name}: ${(result.stderr || result.stdout || "").split("\n").slice(-3).join(" ")}`);
      continue;
    }
    done++;
  }
  console.log(`exported ${done}/${packages.size} mesh packages to assets/highfive/static-meshes`);
}

/**
 * Converting the whole client in one process runs out of memory around two
 * thirds of the way through: the loader keeps every package it has opened, and
 * 208 maps pull in every texture and mesh package they reference. Freeing the
 * decoded buffers between maps makes it *worse* -- packages simply decode
 * again, and the churn costs more than it returns (measured: 85 maps before
 * dying, against 145 without).
 *
 * So each batch gets its own process, which is the only thing that reliably
 * gives the memory back. Re-running the Core.u bootstrap per batch costs about
 * a second.
 */
async function runInBatches(maps: string[], size: number, client: string): Promise<void> {
  const self = fileURLToPath(import.meta.url);
  for (let start = 0; start < maps.length; start += size) {
    const batch = maps.slice(start, start + size);
    const result = spawnSync(
      process.execPath,
      [...process.execArgv, self, "--child", `--client=${client}`, `--only=${batch.join(",")}`],
      {
        stdio: "inherit",
        env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=8192" },
      }
    );
    if (result.status !== 0) {
      console.warn(`batch ${batch[0]}..${batch[batch.length - 1]} exited ${result.status}`);
    }
  }
}

/** Every mesh package referenced by the scene files written so far. */
async function referencedPackages(mapNames?: string[]): Promise<Set<string>> {
  const wanted = mapNames ? new Set(mapNames) : null;
  const packages = new Set<string>();
  for (const entry of await fs.readdir(MAPS_OUT)) {
    if (wanted && !wanted.has(entry)) continue;
    let scene: { meshes?: string[] };
    try {
      scene = JSON.parse(await fs.readFile(path.join(MAPS_OUT, entry, "scene.json"), "utf8"));
    } catch {
      continue;
    }
    for (const mesh of scene.meshes ?? []) packages.add(mesh.split(".")[0].toLowerCase());
  }
  return packages;
}

async function main(): Promise<void> {
  const client = readArg("--client") ?? process.env.L2_CLIENT_DIR;
  if (!client) {
    console.error('--client is required, e.g. --client="D:\\Games\\Lineage2\\L2_HighFive_Client" (or set L2_CLIENT_DIR).');
    process.exitCode = 1;
    return;
  }

  const wantMeshes = process.argv.includes("--meshes");
  const umodel = readArg("--umodel") ?? process.env.UMODEL;
  if (wantMeshes && !umodel) {
    console.error('--meshes needs --umodel="C:\\ue_viewer\\umodel_64.exe" (or set UMODEL).');
    process.exitCode = 1;
    return;
  }

  // Textures ride along with --meshes when an encoder is available. Without
  // one the geometry still converts, and every mesh wears umodel's own
  // placeholder colours -- which is a legible state, not a broken one.
  const ktx = readArg("--ktx") ?? process.env.KTX ?? "ktx";
  const canEncode = wantMeshes && spawnSync(ktx, ["--version"], { encoding: "utf8" }).status === 0;
  if (wantMeshes && !canEncode) {
    console.warn(
      `No usable '${ktx}' found -- skipping textures. Install Khronos KTX-Software ` +
        "(https://github.com/KhronosGroup/KTX-Software/releases) or pass --ktx=<path>."
    );
  }

  const loader = await openClient(client);

  const only = readArg("--only")?.split(",").map((name) => name.trim().toLowerCase());
  const available = (loader.packageNames.get("unr") ?? []).filter((name) => MAP_FILE_PATTERN.test(name));
  const maps = only ? available.filter((name) => only.includes(name)) : available;

  if (maps.length === 0) {
    console.error(only ? `No map matched ${only.join(", ")}. Client has ${available.length}.` : "No maps found in the client.");
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(MAPS_OUT, { recursive: true });

  // The world's lighting curves, written once beside the maps rather than into
  // each of them: there is one set for the whole client. A batch child must
  // not write it -- sixteen processes racing on one file is how you get half a
  // JSON -- and the parent writes it before the children start.
  if (!process.argv.includes("--child")) {
    const env = readClientEnv(client, hsvToRgb);
    await fs.writeFile(path.join(MAPS_OUT, "env.json"), JSON.stringify(env));
    console.log(
      `env.json: ${env.cycles.length} cycles, ${env.cycles[0].ambient.terrain.length} curve points, ` +
        `${env.shadowMapCount} shadow planes per sector at ${env.shadowMapTimes.join("/")}h, ` +
        `${env.fog.ranges.length} fog bands ${env.fog.ranges[0]?.join("..")} .. ${env.fog.ranges.at(-1)?.join("..")}`
    );
    // `--env` stops here. The curves are two files in the client's `system/`
    // and have nothing to do with any map, so adding a field to them should
    // not cost a re-bake of all 203 -- same reasoning as `--mesh-table`.
    if (process.argv.includes("--env")) return;
  }

  // `--mesh-table` refreshes meshes.json alone, from the scene files already
  // on disk. That table is metadata read straight out of the client's
  // packages, so it needs neither umodel nor an encoder -- and when a field is
  // added to it, re-exporting every mesh and every texture to pick the field
  // up costs an hour and changes nothing on disk but that one file.
  if (process.argv.includes("--mesh-table")) {
    await fs.mkdir(MESHES_OUT, { recursive: true });
    await bakeTextures(loader, "", "", client, false, only ? maps : undefined);
    return;
  }

  const batchSize = Number(readArg("--batch") ?? 16);
  const isChild = process.argv.includes("--child");

  if (!isChild && maps.length > batchSize) {
    await runInBatches(maps, batchSize, client);
    const referenced = await referencedPackages(maps);
    // What this run produced, not what is on disk: with --only the two differ,
    // and reporting the directory count once read as "203/18 maps".
    const onDisk = new Set(await fs.readdir(MAPS_OUT));
    const written = maps.filter((name) => onDisk.has(name)).length;
    console.log(`
${written}/${maps.length} maps, ${referenced.size} mesh packages referenced`);
    if (wantMeshes) {
      await fs.mkdir(MESHES_OUT, { recursive: true });
      exportMeshes(umodel!, client, referenced);
      await bakeTextures(loader, umodel!, ktx, client, canEncode, maps);
    }
    return;
  }

  const packages = new Set<string>();
  let failed = 0;
  for (const mapName of maps) {
    try {
      for (const name of await convertMap(loader, mapName)) packages.add(name);
    } catch (error) {
      failed++;
      console.warn(`${mapName}: ${(error as Error).message}`);
      if (process.argv.includes("--verbose")) console.warn((error as Error).stack);
    }
  }

  if (isChild) return;

  console.log(`
${maps.length - failed}/${maps.length} maps, ${packages.size} mesh packages referenced`);

  if (wantMeshes) {
    await fs.mkdir(MESHES_OUT, { recursive: true });
    exportMeshes(umodel!, client, packages);
    await bakeTextures(loader, umodel!, ktx, client, canEncode, maps);
  }
}

/**
 * Writes the per-mesh table, and (when an encoder is available) the KTX2
 * textures themselves. The table is written either way: it is what a later
 * run, or a different pipeline, needs to know which texture belongs where.
 *
 * LOD meshes need no separate export -- they are ordinary meshes in the same
 * package, which whole-package export already wrote.
 */
async function bakeTextures(
  loader: ClientLoader,
  umodel: string,
  ktx: string,
  client: string,
  canEncode: boolean,
  mapNames?: string[]
): Promise<void> {
  const meshes = await collectMeshInfo(loader, await referencedMeshes(mapNames));

  // Merged rather than replaced: a run may cover part of the world, and what
  // an earlier run resolved is still true.
  const target = path.join(MESHES_OUT, "meshes.json");
  let existing: Record<string, MeshInfo> = {};
  try {
    existing = JSON.parse(await fs.readFile(target, "utf8"));
  } catch {
    // first run
  }
  await fs.writeFile(target, JSON.stringify({ ...existing, ...meshes }));
  if (canEncode) {
    await fs.mkdir(TEXTURES_OUT, { recursive: true });
    exportTextures(umodel, ktx, client, meshes, await referencedTerrainTextures(mapNames));
  }
}

main();
