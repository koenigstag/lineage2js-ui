export interface GeoTile {
  cellsX: number;
  cellsY: number;
  /** Height per cell (L2's Z axis), row-major: index = y * cellsX + x. */
  heights: Int16Array;
  /** NSWE passability bitmask per cell: EAST=1, WEST=2, SOUTH=4, NORTH=8. */
  nswe: Uint8Array;
}
