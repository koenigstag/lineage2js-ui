/**
 * NOT UPSTREAM -- added by this repo (see README.md).
 *
 * The vendored source references `THREE.Vector3` and friends without importing
 * them, which compiled upstream because `@types/three@~0.146` still published
 * the library as a UMD global (`export as namespace THREE`). The version this
 * workspace is on no longer does, so ~230 files would otherwise need an import
 * added. Re-declaring the global here keeps the vendored source byte-identical
 * to upstream instead.
 */
import * as _THREE from "three";

declare global {
  export import THREE = _THREE;
}
