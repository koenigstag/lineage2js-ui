import { useMemo, type MutableRefObject } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { GEO_CELL_SIZE, GEO_TILE_SIZE } from "../../../../config/geodata";
import { l2ToThree } from "../../../../utils/coords";
import type { GeoTile } from "../../../../utils/geodata/geo-tile.types";

interface GeoTerrainTileProps {
  tileX: number;
  tileY: number;
  tile: GeoTile;
  /** Left-click on the terrain surface -- fired with the raycast hit point (three.js space). */
  onGroundClick?: (event: ThreeEvent<MouseEvent>) => void;
  /**
   * Set by game-scene.component.tsx's handleOrbitPointerDown while a
   * single-finger touch drag is rotating the camera. Touch has no separate
   * "orbit" button the way right-click does, so a ground tap can't tell
   * itself apart from the start of an orbit drag at pointerdown time --
   * unlike mouse, its action is deferred to pointerup and only committed if
   * this stayed false for the whole gesture.
   */
  orbitDragActiveRef?: MutableRefObject<boolean>;
}

const NSWE_EAST = 1;
const NSWE_WEST = 2;
const NSWE_SOUTH = 4;
const NSWE_NORTH = 8;

/** Disjoint-set over (cell, layer) nodes -- node id = layerOffsets[cell] + layer, matching layerHeights/layerNswe's own flat index. */
class DisjointSet {
  private readonly parent: Int32Array;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
    }
  }

  find(x: number): number {
    while (this.parent[x] !== x) {
      this.parent[x] = this.parent[this.parent[x]];
      x = this.parent[x];
    }
    return x;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent[rootA] = rootB;
    }
  }
}

/**
 * Splits a tile's (cell, layer) nodes into disjoint "sheets" so a bridge/
 * tunnel doesn't get meshed together with the ground underneath it.
 *
 * A pair of cells that are both single-layer is always connected --
 * matches the pre-multilayer behavior of one continuous grid, and NSWE was
 * never a mesh-connectivity signal there (most cells stay single-layer even
 * on maps that have bridges somewhere). Only once either side of an edge
 * has more than one layer does the connection get gated by NSWE (bit set =
 * passable, GeoTile's existing convention) and pick the neighbor's
 * closest-height layer -- that's the one place real ambiguity exists (which
 * layer this layer is actually touching).
 */
function buildSheets(tile: GeoTile): DisjointSet {
  const { cellsX, cellsY, layerCounts, layerOffsets, layerHeights, layerNswe } = tile;
  const totalNodes = layerOffsets[cellsX * cellsY];
  const sheets = new DisjointSet(totalNodes);

  function cellIndex(x: number, y: number): number {
    return y * cellsX + x;
  }

  function connect(x: number, y: number, layer: number, dx: number, dy: number, direction: number): void {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= cellsX || ny < 0 || ny >= cellsY) {
      return;
    }

    const ci = cellIndex(x, y);
    const nci = cellIndex(nx, ny);
    const neighborStart = layerOffsets[nci];
    const neighborCount = layerCounts[nci];

    if (layerCounts[ci] === 1 && neighborCount === 1) {
      sheets.union(layerOffsets[ci], neighborStart);
      return;
    }

    const node = layerOffsets[ci] + layer;
    if ((layerNswe[node] & direction) === 0) {
      return; // blocked that way -- this is what actually splits sheets apart.
    }

    const myHeight = layerHeights[node];
    let bestNode = neighborStart;
    let bestDelta = Math.abs(layerHeights[neighborStart] - myHeight);
    for (let n = neighborStart + 1; n < neighborStart + neighborCount; n++) {
      const delta = Math.abs(layerHeights[n] - myHeight);
      if (delta < bestDelta) {
        bestDelta = delta;
        bestNode = n;
      }
    }
    sheets.union(node, bestNode);
  }

  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      const ci = cellIndex(x, y);
      const start = layerOffsets[ci];
      const count = layerCounts[ci];
      for (let layer = 0; layer < count; layer++) {
        connect(x, y, layer, 1, 0, NSWE_EAST);
        connect(x, y, layer, -1, 0, NSWE_WEST);
        connect(x, y, layer, 0, 1, NSWE_SOUTH);
        connect(x, y, layer, 0, -1, NSWE_NORTH);
      }
    }
  }

  return sheets;
}

/**
 * Wireframe mesh(es) for one geodata tile, converted from L2 world space to
 * three.js via utils/coords. Where every cell is single-layer (the common
 * case) this degenerates to one continuous grid, identical to before
 * multilayer support existed. Where a cell has multiple layers (a bridge or
 * tunnel stacked over open ground), buildSheets splits the tile's (cell,
 * layer) nodes into disjoint components -- each becomes its own mesh, so a
 * bridge deck and the ground underneath never get connected by a stray
 * triangle just because they happen to share (x, y).
 */
export function GeoTerrainTile({ tileX, tileY, tile, onGroundClick, orbitDragActiveRef }: GeoTerrainTileProps) {
  const geometries = useMemo(() => {
    const { cellsX, cellsY, layerOffsets, layerHeights } = tile;
    const cellCount = cellsX * cellsY;
    const totalNodes = layerOffsets[cellCount];

    const sheets = buildSheets(tile);

    // One vertex per (cell, layer) node, shared across every sheet's geometry.
    const positions = new Float32Array(totalNodes * 3);
    const v = new THREE.Vector3();
    for (let y = 0; y < cellsY; y++) {
      for (let x = 0; x < cellsX; x++) {
        const ci = y * cellsX + x;
        const l2X = tileX * GEO_TILE_SIZE + x * GEO_CELL_SIZE;
        const l2Y = tileY * GEO_TILE_SIZE + y * GEO_CELL_SIZE;
        for (let node = layerOffsets[ci]; node < layerOffsets[ci + 1]; node++) {
          l2ToThree(l2X, l2Y, layerHeights[node], v);
          positions[node * 3] = v.x;
          positions[node * 3 + 1] = v.y;
          positions[node * 3 + 2] = v.z;
        }
      }
    }
    const positionAttribute = new THREE.BufferAttribute(positions, 3);

    // Per-cell (sheet root -> node) lookup, so a grid quad can find which
    // node each of its 4 corners contributes to a given sheet.
    const cellSheetNode: Map<number, number>[] = new Array(cellCount);
    for (let ci = 0; ci < cellCount; ci++) {
      const map = new Map<number, number>();
      for (let node = layerOffsets[ci]; node < layerOffsets[ci + 1]; node++) {
        map.set(sheets.find(node), node);
      }
      cellSheetNode[ci] = map;
    }

    const sheetIndices = new Map<number, number[]>();
    function addTriangle(root: number, a: number, b: number, c: number): void {
      let indices = sheetIndices.get(root);
      if (!indices) {
        indices = [];
        sheetIndices.set(root, indices);
      }
      indices.push(a, b, c);
    }

    for (let y = 0; y < cellsY - 1; y++) {
      for (let x = 0; x < cellsX - 1; x++) {
        const mapA = cellSheetNode[y * cellsX + x];
        const mapB = cellSheetNode[y * cellsX + (x + 1)];
        const mapC = cellSheetNode[(y + 1) * cellsX + x];
        const mapD = cellSheetNode[(y + 1) * cellsX + (x + 1)];

        for (const [root, nodeA] of mapA) {
          const nodeB = mapB.get(root);
          const nodeC = mapC.get(root);
          const nodeD = mapD.get(root);
          if (nodeB === undefined || nodeC === undefined || nodeD === undefined) {
            continue; // this sheet doesn't reach all 4 corners of the quad.
          }
          addTriangle(root, nodeA, nodeC, nodeB);
          addTriangle(root, nodeB, nodeC, nodeD);
        }
      }
    }

    const result: THREE.BufferGeometry[] = [];
    for (const indices of sheetIndices.values()) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", positionAttribute);
      geo.setIndex(indices);
      geo.computeVertexNormals();
      result.push(geo);
    }
    return result;
  }, [tileX, tileY, tile]);

  function handleGroundPointerDown(event: ThreeEvent<PointerEvent>) {
    // Native "click" only fires after a matching pointerdown+pointerup
    // pair with no drag in between -- pointerdown is more direct and
    // can't be swallowed by that. Left button only (button 0); the
    // right button is reserved for the orbit-camera drag. Touch also
    // reports button 0 here, so it passes this same check.
    if (event.nativeEvent.button !== 0) {
      return;
    }
    event.stopPropagation();

    if (event.nativeEvent.pointerType === "touch") {
      // Unlike mouse, a touch tap can't tell itself apart from the start of
      // a camera-orbit drag yet (see orbitDragActiveRef's doc comment) --
      // defer the actual move/select action to pointerup, and only commit
      // if the gesture never crossed the orbit-drag threshold.
      const handleUp = () => {
        window.removeEventListener("pointerup", handleUp);
        if (!orbitDragActiveRef?.current) {
          onGroundClick?.(event);
        }
      };
      window.addEventListener("pointerup", handleUp);
      return;
    }

    onGroundClick?.(event);
  }

  return (
    <>
      {geometries.map((geometry, index) => (
        <mesh key={index} geometry={geometry} onPointerDown={onGroundClick && handleGroundPointerDown}>
          <meshBasicMaterial color="#3fae63" wireframe />
        </mesh>
      ))}
    </>
  );
}
