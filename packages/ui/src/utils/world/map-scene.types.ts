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
  /** Five distance bands, near to far, in L2 world units. */
  fogRanges: Array<[number, number]>;
  times: MapEnvironmentTime[];
  /** Unreal rotator (pitch, yaw, roll) and the billboard's own radius. */
  sun: { radius: number; rotation: [number, number, number] } | null;
  moon: { radius: number; rotation: [number, number, number] } | null;
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
}

export interface MapScene {
  map: [number, number];
  /** L2 world coordinates of the map's minimum corner. */
  worldOrigin: [number, number];
  worldSize: number;
  terrain: MapTerrain | null;
  environment: MapEnvironment | null;
  /** Qualified mesh names, `Package.Group.Name`; actors index into this. */
  meshes: string[];
  actors: MapActor[];
}
