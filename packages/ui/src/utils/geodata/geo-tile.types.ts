export interface GeoTile {
  cellsX: number;
  cellsY: number;
  /**
   * Height per cell (L2's Z axis), row-major: index = y * cellsX + x. Top
   * layer only -- the fast path for consumers (geo-tile-height.ts) that
   * don't care about multilayer cells. See layerHeights for every layer of
   * a cell (bridges/tunnels stacked over open ground).
   */
  heights: Int16Array;
  /** NSWE passability bitmask per cell, same indexing/fast-path as heights: EAST=1, WEST=2, SOUTH=4, NORTH=8. */
  nswe: Uint8Array;
  /** Layers per cell (>=1; >1 means a bridge/tunnel), row-major: index = y * cellsX + x. */
  layerCounts: Uint8Array;
  /**
   * CSR row-pointer into layerHeights/layerNswe: cell i's layers (bottom to
   * top) are layerHeights[layerOffsets[i] .. layerOffsets[i + 1]). Length is
   * cellsX * cellsY + 1 (the last entry is the total layer count).
   */
  layerOffsets: Uint32Array;
  /** Height per layer, bottom to top, flattened across every cell -- slice with layerOffsets/layerCounts. */
  layerHeights: Int16Array;
  /** NSWE passability bitmask per layer, same order/length as layerHeights. */
  layerNswe: Uint8Array;
}
