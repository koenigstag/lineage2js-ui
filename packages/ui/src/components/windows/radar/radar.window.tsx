import { observer } from "mobx-react-lite";
import { useGameStore } from "../../../stores/StoreContext";
import { worldToRegionCoords, worldToTileCoords } from "../../../utils/geodata/world-to-tile";

const WIDTH = 150;

/**
 * Placeholder for the real minimap -- no map art/rendering exists yet (see
 * TODO.md), so for now this just surfaces the debug info needed to track
 * down geodata-tile-boundary/loading bugs: the player's raw world position,
 * the real L2 server's coarse "sector" (32768-unit map-file grid, e.g.
 * "20_22" for Dion), and this project's own finer streaming geodata
 * "chunk" within that sector (see world-to-tile.ts for both formulas).
 */
export const RadarContent = observer(function RadarContent() {
  const game = useGameStore();
  const player = game.me !== undefined ? game.creatures.get(game.me) : undefined;

  if (!player) {
    return <div style={{ width: WIDTH, fontSize: 11, color: "#8a7f6a" }}>No position yet</div>;
  }

  const [regionX, regionY] = worldToRegionCoords(player.x, player.y);
  const [tileX, tileY] = worldToTileCoords(player.x, player.y);

  const rowStyle = { display: "flex", justifyContent: "space-between", gap: 8 };
  const labelStyle = { color: "#8a7f6a" };
  const valueStyle = { color: "#e6d9be" };

  return (
    <div style={{ width: WIDTH, fontSize: 11, fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={rowStyle}>
        <span style={labelStyle}>X</span>
        <span style={valueStyle}>{player.x}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Y</span>
        <span style={valueStyle}>{player.y}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Z</span>
        <span style={valueStyle}>{player.z}</span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Sector</span>
        <span style={valueStyle}>
          {regionX}_{regionY}
        </span>
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>Chunk</span>
        <span style={valueStyle}>
          {tileX}_{tileY}
        </span>
      </div>
    </div>
  );
});
