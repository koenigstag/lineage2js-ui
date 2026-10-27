/**
 * The shape of a baked map file (`assets/highfive/maps/<x>_<y>/scene.json`).
 * Written by packages/assets-server/scripts/convert-maps.ts -- keep the two in
 * step.
 *
 * Everything here is in the client's own units: positions in L2 world units,
 * rotations in Unreal rotator units (65536 to the turn). Converting happens at
 * the point of use, the same way creature positions off the wire are handled.
 */

export interface MapTerrainLayer {
  /** Qualified texture name, e.g. "T_oren.Obase_1". */
  texture: string | null;
  /** Its mask over the map; layer 0 is the unmasked base. */
  alphaMap: string | null;
  /**
   * World position -> this layer's texture UV: `uv = (world - uvOffset) * uvScale`,
   * over the two axes `axis` names. Precomputed by the converter from the
   * terrain's own world->heightmap transform and the layer's scale.
   */
  uvScale: [number, number];
  uvOffset: [number, number];
  /** Which world plane the texture projects down: 0 = XY, 1 = XZ, 2 = YZ. */
  axis: number;
}

export interface MapTerrain {
  /** TerrainScale: world units per quad in x/y, and the z factor. */
  scale: [number, number, number];
  heightmap: { width: number; height: number; format: "g16"; file: string };
  /**
   * Two bit-per-quad maps in one file, visibility then edge turn. Absent on a
   * map baked before they were extracted -- see parseTerrainQuads.
   */
  quads?: { file: string };
  /**
   * Heightmap sample -> world, as the client stores it. Unreal's
   * TransformPointBy subtracts the origin first:
   *   world = ((hx, hy, height) - origin) . (xAxis, yAxis, zAxis)
   */
  toWorld: {
    origin: [number, number, number];
    xAxis: [number, number, number];
    yAxis: [number, number, number];
    zAxis: [number, number, number];
  };
  /**
   * The sun intensity the editor baked per terrain vertex, as one greyscale
   * image per hour of the day the client bakes for.
   *
   * This is what the client's terrain uses in place of a diffuse term: it has
   * no dot product against a sun direction at all, because the bake already
   * accounts for the slope and for everything standing on it. See
   * resolveLighting and readShadowMaps. Absent on a map baked before they were
   * extracted.
   */
  shadow?: { width: number; height: number; times: number[]; files: string[] };
  sectors: number;
  layers: MapTerrainLayer[];
}

/** One entry of the map's day: the time it applies at, and the colours then. */
export interface MapEnvironmentTime {
  /** Hours, 0..24. */
  time: number;
  /** 0..255 sRGB. */
  fog: [number, number, number];
  sky: [number, number, number];
  haze: [number, number, number] | null;
}

/**
 * Sky and fog, which the map states outright rather than leaving to taste.
 *
 * From the map's `L2FogInfo` plus its `NSun`/`NMoon` billboards. A map has one
 * fog info per zone and the converter takes the first: picking by the zone the
 * camera stands in needs the BSP the zones are defined by, which nothing reads
 * yet.
 */
export interface MapEnvironment {
  /**
   * The `L2FogInfo`'s own five bands, near to far, in L2 world units.
   *
   * **A local override, not the map's fog.** It applies only while the camera
   * stands inside the actor's `AffectRange` -- 3000 to 4000 units, a swamp or
   * a cave mouth -- and there it replaces the world's fog outright, which is
   * why every near here is 0: a zone fog does start at the camera. Placing it
   * needs the BSP the zones are cut from, so nothing reads it yet and the fog
   * comes from WorldEnvFog. Kept for when that lands.
   */
  fogRanges: Array<[number, number]>;
  times: MapEnvironmentTime[];
  /** Unreal rotator (pitch, yaw, roll) and the billboard's own radius. */
  sun: { radius: number; rotation: [number, number, number] } | null;
  moon: { radius: number; rotation: [number, number, number] } | null;
}

/**
 * The lighting actors in the level itself.
 *
 * **Not where the world's light comes from**, which is the useful thing to
 * know about this block. The runtime reads `env.json`'s curves for colour (see
 * WorldEnv and resolveLighting); on 192 of the client's 203 maps the
 * `LevelInfo` ambient here is below 1, because nothing ever asks it.
 *
 * What is used is `sun.rotation` -- the direction the static meshes are lit
 * from. The rest is recorded because it is real level data the BSP work will
 * want. Colours are 0..255 with brightness already folded in, the way the
 * engine's own `getColor()` returns them.
 */
export interface MapLighting {
  /** `NMovableSunLight`: the colour it casts, and the Unreal rotator it casts along. */
  sun: { color: [number, number, number]; rotation: [number, number, number] } | null;
  /** `LevelInfo`'s ambient. Near zero on nearly every map -- see above. */
  ambient: [number, number, number];
  /**
   * Every `ZoneInfo`'s ambient, unresolved. 22_22 runs 17 to 68 against a
   * level ambient of 0. Which one applies needs the BSP the zones are defined
   * by, which nothing reads yet.
   */
  zoneAmbient: Array<[number, number, number]>;
}

/** One point of a colour curve over the day. Hours 0..24, channels 0..255. */
export interface WorldEnvColor {
  time: number;
  color: [number, number, number];
}

/**
 * One point of a light curve: the colour at full value, and the brightness it
 * is scaled by.
 *
 * The two are interpolated apart and multiplied last, which is the client's
 * own order -- `UL2NTimeLight::GetColorPlane` converts both ends of the span
 * from HSB at value 255, lerps the colours, then lerps the brightnesses and
 * multiplies. Brightness is over 255 and goes past it: 450 at dawn.
 */
export interface WorldEnvLight extends WorldEnvColor {
  brightness: number;
}

/** The four surface classes the client lights from separate curves. */
export interface WorldEnvSurfaces<T> {
  terrain: T;
  staticMesh: T;
  actor: T;
  bsp: T;
}

export interface WorldEnvCycle {
  /** 0 normal, 1 dusk, 2 dawn, 3 cursed sword. Only 0 is reachable so far. */
  type: number;
  ambient: WorldEnvSurfaces<WorldEnvColor[]>;
  light: WorldEnvSurfaces<WorldEnvLight[]>;
}

/**
 * The world's lighting, one set for the whole client
 * (`assets/highfive/maps/env.json`).
 *
 * Read from `system/env.int` and the `timeenv<n>.int` curves it names -- see
 * packages/assets-server/scripts/client-data/env-config.ts, which also
 * explains why this and not the level's own `LevelInfo` ambient.
 */
/**
 * The five fog bands, in L2 world units, one per view-distance setting.
 *
 * This is the fog, everywhere except inside an `L2FogInfo`'s affect range --
 * see MapEnvironment.fogRanges, which is the local override and the reason
 * those start at 0.
 */
export interface WorldEnvFog {
  ranges: Array<[number, number]>;
  speed: number;
}

export interface WorldEnv {
  startTime: number;
  timeRatio: number;
  fog: WorldEnvFog;
  shadowMapCount: number;
  shadowMapTimes: number[];
  staticLightingAdjust: number;
  cycles: WorldEnvCycle[];
}

export interface MapActor {
  /** Index into MapScene.meshes. */
  mesh: number;
  /** L2 world units. */
  pos: [number, number, number];
  /** Unreal rotator (pitch, yaw, roll); absent when the actor is unrotated. */
  rot?: [number, number, number];
  /** Absent when the actor is at its mesh's own scale. */
  scale?: [number, number, number];
  /**
   * `bSunAffect = false`: the sun does not reach this actor, so it is lit by
   * `amb` instead of by the world's light. Present only when false -- 312 of
   * 800 actors on 20_18, none at all on an open field map.
   */
  sun?: 0;
  /**
   * The zone ambient that lights it instead, 0..255. Only on an actor the sun
   * does not reach; a zero here is a real answer, and means the actor is lit
   * by nothing but `lit`.
   */
  amb?: [number, number, number];
  /**
   * What the `Light` actors around this placement add, 0..255, averaged over
   * the mesh -- added on top of the sun or the zone ambient rather than
   * replacing either.
   *
   * Computed by the converter the way the client computes it, rather than
   * taken from the editor's bake, which is missing on exactly the placements
   * that need it most. Averaged because a colour per vertex cannot ride on an
   * `InstancedMesh`; the spread given up is about the size of the mean, so a
   * wall lit from one end comes out evenly lit.
   */
  lit?: [number, number, number];
}

/**
 * A `Light` actor, in L2 world units with the colour's brightness already
 * folded in. Baked but not drawn yet -- `MapActor.lit` is the editor's own
 * answer for the static world, and these are where it came from.
 */
export interface MapLight {
  pos: [number, number, number];
  color: [number, number, number];
  radius: number;
}

export interface MapScene {
  map: [number, number];
  /** L2 world coordinates of the map's minimum corner. */
  worldOrigin: [number, number];
  worldSize: number;
  terrain: MapTerrain | null;
  environment: MapEnvironment | null;
  lighting: MapLighting | null;
  /** Every `Light` actor on the map. See MapLight. */
  lights?: MapLight[];
  /** Qualified mesh names, `Package.Group.Name`; actors index into this. */
  meshes: string[];
  actors: MapActor[];
}
