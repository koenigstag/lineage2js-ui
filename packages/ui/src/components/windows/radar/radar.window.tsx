import { observer } from "mobx-react-lite";
import { useGameStore } from "../../../stores/StoreContext";
import { GEO_CELL_SIZE, GEO_TILE_CELLS } from "../../../config/geodata";
import { worldToBlockCoords, worldToCellCoords, worldToRegionCoords, worldToTileCoords } from "../../../utils/geodata/world-to-tile";
import { classifyBlockType } from "../../../utils/geodata/block-type";
import { useGeoTiles } from "../../../utils/geodata/use-geo-tiles";

const WIDTH = 150;

/**
 * Placeholder for the real minimap -- no map art/rendering exists yet (see
 * TODO.md), so for now this just surfaces the debug info needed to track
 * down geodata bugs: the player's raw world position, the real L2 server's
 * coarse "sector" (32768-unit map-file grid, e.g. "20_22" for Dion), this
 * project's own finer streaming geodata "chunk" within it, and -- one level
 * finer still -- the raw L2J geodata "block" (8x8 cells) and "cell" (both
 * region-relative, matching how a .l2j geodata editor addresses them) plus
 * that block's heuristically-classified type (see block-type.ts).
 *
 * Calls useGeoTiles a second time (independent of GameScene's own call, no
 * shared cache between hook instances) purely for this debug readout --
 * fine for a small HUD panel, not worth threading the loaded tiles through
 * a shared store for.
 */
export const RadarContent = observer(function RadarContent() {
  const game = useGameStore();
  const player = game.me !== undefined ? game.creatures.get(game.me) : undefined;
  const tiles = useGeoTiles(player?.x ?? 0, player?.y ?? 0);

  if (!player) {
    return <div style={{ width: WIDTH, fontSize: 11, color: "#8a7f6a" }}>No position yet</div>;
  }

  const [regionX, regionY] = worldToRegionCoords(player.x, player.y);
  const [tileX, tileY] = worldToTileCoords(player.x, player.y);
  const [blockX, blockY] = worldToBlockCoords(player.x, player.y);
  const [cellX, cellY] = worldToCellCoords(player.x, player.y);

  const currentTile = tiles.find((t) => t.tileX === tileX && t.tileY === tileY);
  const tileLocalCellX = Math.floor(player.x / GEO_CELL_SIZE) - tileX * GEO_TILE_CELLS;
  const tileLocalCellY = Math.floor(player.y / GEO_CELL_SIZE) - tileY * GEO_TILE_CELLS;
  const blockType = currentTile ? classifyBlockType(currentTile.tile, tileLocalCellX, tileLocalCellY) : undefined;

  const rowStyle = { display: "flex", justifyContent: "space-between", gap: 8 };
  const labelStyle = { color: "#8a7f6a" };
  const valueStyle = { color: "#e6d9be" };

  function row(label: string, value: string) {
    return (
      <div style={rowStyle} key={label}>
        <span style={labelStyle}>{label}</span>
        <span style={valueStyle}>{value}</span>
      </div>
    );
  }

  return (
    <div style={{ width: WIDTH, fontSize: 11, fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 3 }}>
      {row("X", String(player.x))}
      {row("Y", String(player.y))}
      {row("Z", String(player.z))}
      {row("Sector", `${regionX}_${regionY}`)}
      {row("Chunk", `${tileX}_${tileY}`)}
      {row("Block", `${blockX}_${blockY}`)}
      {row("Cell", `${cellX}_${cellY}`)}
      {row("Block type", blockType ?? "…")}
    </div>
  );
});
