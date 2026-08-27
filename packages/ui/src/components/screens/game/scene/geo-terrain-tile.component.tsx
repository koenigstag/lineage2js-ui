import { useMemo, type MutableRefObject } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { GEO_CELL_SIZE, GEO_TILE_SIZE } from "../../../../config/geodata";
import { IS_GEODATA_TERRAIN_SMOOTH } from "../../../../config/env";
import { l2ToThree } from "../../../../utils/coords";
import { NSWE_EAST, NSWE_NORTH, NSWE_SOUTH, NSWE_WEST } from "../../../../utils/geodata/geo-cells";
import {
  CORNERS_PER_CELL,
  computeCornerHeights,
  type GeoTileNeighbors,
} from "../../../../utils/geodata/terrain-corner-heights";
import type { GeoTile } from "../../../../utils/geodata/geo-tile.types";

interface GeoTerrainTileProps {
  tileX: number;
  tileY: number;
  tile: GeoTile;
  /**
   * The 8 surrounding tiles, as far as they're loaded -- only read to weld
   * quad corners across the tile seam (see computeCornerHeights), never to
   * render anything outside this tile.
   */
  neighbors?: GeoTileNeighbors;
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

interface CandidateEdge {
  a: number;
  b: number;
  delta: number;
}

/**
 * Splits a tile's (cell, layer) nodes into disjoint "sheets" so a bridge/
 * tunnel doesn't get meshed together with the ground underneath it (or,
 * more generally, so any two unrelated stacked surfaces -- a cave floor
 * under a room, a multi-story tower's separate rings -- never get meshed
 * together just because a "closest available" height match happened to
 * exist somewhere along their shared edge).
 *
 * A pair of cells that are both single-layer is always connected --
 * matches the pre-multilayer behavior of one continuous grid, and NSWE was
 * never a mesh-connectivity signal there (most cells stay single-layer even
 * on maps that have bridges somewhere).
 *
 * Once either side of an edge has more than one layer, this used to just
 * greedily connect each layer to its single closest-height NSWE-open
 * neighbor candidate. That has no way to reject a match that's merely the
 * *least bad* option -- verified against real multi-layer tiles (a 3-ring
 * tower structure) that a "closest available" match can still be over a
 * thousand L2 units off when nothing better exists on either side, and
 * that neither an absolute distance cutoff (no clean gap between genuine
 * and spurious deltas in real data -- values are smeared continuously) nor
 * a two-sided "mutual nearest" check (both sides can genuinely agree a bad
 * match is their best available option) catches it. Whenever that
 * spurious link fuses two of the SAME cell's own layers into the same
 * sheet, cellSheetNode's Map (below) can only keep one -- the other
 * silently never renders, which was the actual reported symptom.
 *
 * Fixed as a hard structural invariant instead of a distance judgment: a
 * single (x, y) cell can never validly contribute two different heights to
 * one continuous surface, so no sheet may ever contain two layers of the
 * same cell. Every NSWE-open (my layer, neighbor layer) pair across the
 * whole tile becomes a candidate edge, processed Kruskal-style in
 * ascending height-delta order (closest, most-confident matches first),
 * accepting a union only when it doesn't violate that invariant. This
 * generalizes the old "closest available" heuristic without any magic
 * number: matches are still preferred smallest-delta-first, but a
 * connection with no valid partner anywhere just doesn't happen, leaving a
 * legitimate seam in the mesh there instead of guessing.
 */
function buildSheets(tile: GeoTile): DisjointSet {
  const { cellsX, cellsY, layerCounts, layerOffsets, layerHeights, layerNswe } = tile;
  const totalNodes = layerOffsets[cellsX * cellsY];
  const sheets = new DisjointSet(totalNodes);

  function cellIndex(x: number, y: number): number {
    return y * cellsX + x;
  }

  const edges: CandidateEdge[] = [];

  function collectEdges(x: number, y: number, dx: number, dy: number, direction: number): void {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || nx >= cellsX || ny < 0 || ny >= cellsY) {
      return;
    }

    const ci = cellIndex(x, y);
    const nci = cellIndex(nx, ny);
    const myStart = layerOffsets[ci];
    const myCount = layerCounts[ci];
    const neighborStart = layerOffsets[nci];
    const neighborCount = layerCounts[nci];

    if (myCount === 1 && neighborCount === 1) {
      sheets.union(myStart, neighborStart);
      return;
    }

    for (let layer = 0; layer < myCount; layer++) {
      const node = myStart + layer;
      if ((layerNswe[node] & direction) === 0) {
        continue; // blocked that way -- this is what actually splits sheets apart.
      }
      const myHeight = layerHeights[node];
      for (let n = neighborStart; n < neighborStart + neighborCount; n++) {
        edges.push({ a: node, b: n, delta: Math.abs(layerHeights[n] - myHeight) });
      }
    }
  }

  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      collectEdges(x, y, 1, 0, NSWE_EAST);
      collectEdges(x, y, -1, 0, NSWE_WEST);
      collectEdges(x, y, 0, 1, NSWE_SOUTH);
      collectEdges(x, y, 0, -1, NSWE_NORTH);
    }
  }

  edges.sort((a, b) => a.delta - b.delta);

  // root -> every cell that currently has one of its layers in that sheet
  // -- tracked explicitly (rather than re-derived from the DisjointSet each
  // time) so accepting/rejecting an edge against the "no cell twice in one
  // sheet" invariant is O(smaller side) instead of an O(totalNodes) rescan.
  // Seeded via sheets.find(node), not node itself -- the single-single fast
  // path above has already unioned some nodes together by this point, so
  // grouping by each node's OWN index would silently split an
  // already-merged sheet's membership across several stale, never-queried
  // map entries (every Kruskal lookup below is keyed by a live root from
  // sheets.find(), which the singleton-per-node seeding would undercount).
  const cellsInRoot = new Map<number, Set<number>>();
  for (let ci = 0; ci < cellsX * cellsY; ci++) {
    for (let node = layerOffsets[ci]; node < layerOffsets[ci + 1]; node++) {
      const root = sheets.find(node);
      let set = cellsInRoot.get(root);
      if (!set) {
        set = new Set();
        cellsInRoot.set(root, set);
      }
      set.add(ci);
    }
  }

  for (const { a, b } of edges) {
    const rootA = sheets.find(a);
    const rootB = sheets.find(b);
    if (rootA === rootB) {
      continue;
    }

    const setA = cellsInRoot.get(rootA)!;
    const setB = cellsInRoot.get(rootB)!;
    const [small, large] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
    let collides = false;
    for (const cell of small) {
      if (large.has(cell)) {
        collides = true;
        break;
      }
    }
    if (collides) {
      continue; // would give some cell two layers in the same sheet -- reject, leave a seam.
    }

    sheets.union(a, b);
    const newRoot = sheets.find(a);
    const oldRoot = newRoot === rootA ? rootB : rootA;
    const survivingSet = cellsInRoot.get(newRoot)!;
    for (const cell of cellsInRoot.get(oldRoot)!) {
      survivingSet.add(cell);
    }
    cellsInRoot.delete(oldRoot);
  }

  return sheets;
}

/**
 * Default terrain geometry: one independent quad per (cell, layer), no
 * vertices shared with neighboring cells at all -- matches how the real G3D
 * geodata editor renders it (confirmed by decompiling G3DEditor.jar: every
 * cell is its own small self-contained platform, positioned and drawn with
 * zero connectivity/merging logic between neighbors; see config/env.ts's
 * IS_GEODATA_TERRAIN_SMOOTH). Unlike buildSheets, nothing here is merged or
 * re-triangulated -- each cell's own layers can't touch anything outside
 * themselves, so no layer can go missing however the heights line up.
 *
 * The quads aren't necessarily flat, though: each one's four corners come
 * from computeCornerHeights, which pulls corners shared with a
 * nearly-level neighbor to their common average (see
 * GEO_TERRAIN_WELD_MAX_DELTA). Cells that only differ by the geodata's own
 * 8-unit Z quantization therefore meet exactly and read as one continuous
 * surface, while a real wall or ledge keeps every corner at its own exact
 * height and stays as sharp a step as it is without any welding.
 */
function buildCellQuads(
  tileX: number,
  tileY: number,
  tile: GeoTile,
  cornerHeights: Float32Array
): THREE.BufferGeometry {
  const { cellsX, cellsY, layerOffsets } = tile;
  const totalNodes = layerOffsets[cellsX * cellsY];

  const positions = new Float32Array(totalNodes * 4 * 3);
  const indices: number[] = [];
  const v = new THREE.Vector3();
  let vertexIndex = 0;

  function writeVertex(l2X: number, l2Y: number, height: number): number {
    l2ToThree(l2X, l2Y, height, v);
    const i = vertexIndex++;
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    return i;
  }

  for (let y = 0; y < cellsY; y++) {
    for (let x = 0; x < cellsX; x++) {
      const ci = y * cellsX + x;
      const l2X0 = tileX * GEO_TILE_SIZE + x * GEO_CELL_SIZE;
      const l2Y0 = tileY * GEO_TILE_SIZE + y * GEO_CELL_SIZE;
      const l2X1 = l2X0 + GEO_CELL_SIZE;
      const l2Y1 = l2Y0 + GEO_CELL_SIZE;

      for (let node = layerOffsets[ci]; node < layerOffsets[ci + 1]; node++) {
        // Same corner layout/winding as buildSheets' quads (A/B/C/D =
        // (x,y)/(x+1,y)/(x,y+1)/(x+1,y+1), triangles A-C-B and B-C-D), which
        // is also the slot order cornerHeights is indexed by.
        const corner = node * CORNERS_PER_CELL;
        const a = writeVertex(l2X0, l2Y0, cornerHeights[corner]);
        const b = writeVertex(l2X1, l2Y0, cornerHeights[corner + 1]);
        const c = writeVertex(l2X0, l2Y1, cornerHeights[corner + 2]);
        const d = writeVertex(l2X1, l2Y1, cornerHeights[corner + 3]);
        indices.push(a, c, b, b, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Wireframe mesh(es) for one geodata tile, converted from L2 world space to
 * three.js via utils/coords. Defaults to buildCellQuads (independent
 * per-cell/layer quads whose shared corners are welded wherever the layers
 * meeting there are already nearly level, see its own doc comment) unless
 * IS_GEODATA_TERRAIN_SMOOTH opts into buildSheets' fully stitched mesh:
 * where every cell is single-layer (the common case) that degenerates to
 * one continuous grid, identical to before multilayer support existed;
 * where a cell has multiple layers (a bridge or tunnel stacked over open
 * ground), buildSheets splits the tile's (cell, layer) nodes into disjoint
 * components -- each becomes its own mesh, so a bridge deck and the ground
 * underneath never get connected by a stray triangle just because they
 * happen to share (x, y).
 */
export function GeoTerrainTile({
  tileX,
  tileY,
  tile,
  neighbors = {},
  onGroundClick,
  orbitDragActiveRef,
}: GeoTerrainTileProps) {
  // Pulled apart field by field (and put back together inside the memo)
  // because GeoTerrainField rebuilds the neighbors object on every render
  // while the tiles in it are stable -- parsed once and cached by
  // use-geo-tiles. Depending on the tiles themselves rebuilds this mesh
  // exactly when a neighbor loads or gets evicted, which is when the border
  // corners can actually change.
  const { north, south, west, east, northWest, northEast, southWest, southEast } = neighbors;

  const geometries = useMemo(() => {
    if (!IS_GEODATA_TERRAIN_SMOOTH) {
      const cornerHeights = computeCornerHeights(tile, {
        north,
        south,
        west,
        east,
        northWest,
        northEast,
        southWest,
        southEast,
      });
      return [buildCellQuads(tileX, tileY, tile, cornerHeights)];
    }

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
  }, [tileX, tileY, tile, north, south, west, east, northWest, northEast, southWest, southEast]);

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
