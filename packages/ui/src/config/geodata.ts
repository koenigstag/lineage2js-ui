// Geodata layout constants + URL builder. Cell/tile sizes are the real L2J
// geodata constants (cross-checked against lineage2ts's own
// GeoRegion.ts/PolygonSize.ts -- WorldCellShift=4 -> 16 units/cell), not
// something invented for this client. Real .l2j region files are
// pre-sliced into this project's own smaller streaming "tile" unit once,
// offline (see packages/assets-server/scripts/convert-l2j-geodata.ts) --
// the client only ever fetches and deserializes those small pre-baked
// tiles (see utils/geodata/geo-tile-parser.ts), never a whole raw region.

/** World units covered by one geo-cell (matches the original L2 geodata cell size). */
export const GEO_CELL_SIZE = 16;

/** Geo-cells per tile side -- the frontend's own streaming/rendering granularity. */
export const GEO_TILE_CELLS = 64;

/** World units covered by one tile side. */
export const GEO_TILE_SIZE = GEO_CELL_SIZE * GEO_TILE_CELLS;

/** Geo-cells per raw L2J block side (an 8x8 cell polygon -- FLAT/COMPLEX/MULTI, see l2j-region-reader.ts on the assets-server side). */
export const GEO_BLOCK_CELLS = 8;

/** Geo-cells per raw L2J region ("sector") side. */
export const GEO_REGION_CELLS = 2048;

/** World units covered by one region side (matches lineage2ts's L2MapTile.Size). */
export const GEO_REGION_SIZE = GEO_CELL_SIZE * GEO_REGION_CELLS;

// Mirrors world-to-tile.ts's worldToRegionCoords offset (regionX = (x>>15)+20 etc.).
export const GEO_REGION_ZERO_X = 20;
export const GEO_REGION_ZERO_Y = 18;

const GEODATA_TILE_BASE_URL = import.meta.env.VITE_GEODATA_TILE_BASE_URL;

/** URL for the pre-baked tile file at the given tile coordinates (see worldToTileCoords). */
export function getGeodataTileUrl(tileX: number, tileY: number): string | undefined {
  if (!GEODATA_TILE_BASE_URL) {
    return undefined;
  }
  return GEODATA_TILE_BASE_URL.replace("{tileX}", String(tileX)).replace("{tileY}", String(tileY));
}

/**
 * Raw .l2j sentinel height for "there is nothing here" -- a genuine hole in
 * the geometry rather than a walkable surface. Survives the offline bake
 * verbatim (see l2j-region-reader.ts's LOWEST_HEIGHT: such a cell keeps the
 * sentinel as its height and gets nswe 0, fully blocked), so every consumer
 * that picks a layer to stand on has to skip it explicitly -- otherwise
 * "nearest layer below me" happily picks the void 30k units down.
 */
export const GEO_NO_DATA_HEIGHT = -32768;

/**
 * How far up (L2 Z units) a creature may step while walking from one geo-cell
 * to the next. A candidate surface higher than this above the one we're
 * currently standing on isn't a step, it's a wall/ledge at our level, and
 * movement into that cell is refused; dropping *down* is never limited (see
 * geo-path.ts -- falling off a ledge is allowed as long as NSWE lets us leave
 * the cell we're in).
 *
 * A client-side heuristic, not a value read out of the geodata: the .l2j NSWE
 * mask already encodes most genuine walls, so this mainly decides *which*
 * layer of a multi-layer cell (bridge deck vs. the ground under it) counts as
 * "the same level as the player". Deliberately generous enough not to reject
 * ordinary stairs/slopes, while nowhere near the hundreds of units that
 * typically separate two stacked layers.
 */
export const GEO_MAX_STEP_UP_HEIGHT = 64;

/**
 * How far (L2 Z units) the surface a straight-line walk actually lands on may
 * differ from the destination's own Z before the destination counts as being
 * on a *different level* (the far side of a bridge deck we're standing under,
 * a ledge above us) rather than the place that was clicked. Same order of
 * magnitude as GEO_MAX_STEP_UP_HEIGHT on purpose -- both answer the same
 * "is this the layer I'm on?" question.
 */
export const GEO_SAME_LEVEL_TOLERANCE = 64;

/**
 * Upper bound on the number of geo-cells a single straight-path check walks.
 * A move order is never this long in practice (~8000 world units); the cap
 * only stops a nonsense destination from burning a visible amount of CPU on
 * the click. Exceeding it reports "unverified", never "blocked" -- refusing to
 * move because a check gave up would be worse than not checking.
 */
export const GEO_MAX_PATH_CELLS = 512;
