/**
 * NOT UPSTREAM -- added by this repo (see README.md).
 *
 * The upstream entry point (`src/index.ts`) boots a browser app: it pulls in
 * stylesheets, a WebGL renderer, physics and a camera controller. Everything
 * this repo consumes lives one layer below that -- the Unreal Engine 2 asset
 * object model, which is plain TypeScript over a package reader and has no
 * DOM or WebGL context of its own.
 *
 * This file is that layer's entry point, so the offline converters in
 * `@lineage2js/assets-server` can import the readers without dragging the
 * renderer in behind them.
 */
export { default as UPackage, UNativePackage, UEnginePackage, UCorePackage } from "./assets/unreal/un-package";

export { default as ULevel } from "./assets/unreal/un-level";
export { default as ULevelInfo } from "./assets/unreal/un-level-info";
export { default as ATerrainInfo } from "./assets/unreal/un-terrain-info";
export { default as UTerrainSector } from "./assets/unreal/un-terrain-sector";
export { default as UTexture } from "./assets/unreal/un-texture";
export { default as ETextureFormat } from "./assets/unreal/un-tex-format";
export { default as UStaticMesh } from "./assets/unreal/static-mesh/un-static-mesh";
export { default as UStaticMeshActor } from "./assets/unreal/static-mesh/un-static-mesh-actor";
export { default as ULight } from "./assets/unreal/un-light";
export { default as FZoneInfo } from "./assets/unreal/un-zone-info";
export { default as USkyZoneInfo } from "./assets/unreal/un-sky-zone-info";

export { default as FVector } from "./assets/unreal/un-vector";
export { default as FRotator } from "./assets/unreal/un-rotator";
export { default as FCoords } from "./assets/unreal/un-coords";
export { default as FBox } from "./assets/unreal/un-box";
export { default as FColor } from "./assets/unreal/un-color";
export { default as FPlane } from "./assets/unreal/un-plane";

// Re-exported so a Node consumer has one import specifier for the whole
// reader. The core package's own dist is per-file ESM without file
// extensions -- fine for a bundler, not directly loadable by Node -- and this
// bundle already inlines it.
export { AAssetLoader, BufferValue, UObject, crypto } from "@lineage2js/unreal-l2js-core";
