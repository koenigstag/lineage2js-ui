/**
 * NOT UPSTREAM -- added by this repo (see README.md).
 *
 * The public type surface of this package, hand-written on purpose.
 *
 * Pointing `types` at `src/unreal-index.ts` instead would drag 22k lines of
 * vendored source into every consumer's typecheck, and that source does not
 * come out clean under this workspace's settings (see the `typecheck` note in
 * the README) -- so importing the readers would break an unrelated package's
 * build. Emitting declarations from the vendored source has the same problem
 * plus the ambient globals it leans on.
 *
 * The types are deliberately loose. The vendored code is not typed well enough
 * for anything tighter to be honest, and a consumer that wants a specific
 * field should read the reader it comes from.
 */

/** A loaded Unreal package: name/import/export tables and the objects in them. */
export interface UnrealPackage {
  readonly path: string;
  readonly exports: any[];
  readonly imports: any[];
  /** Exports bucketed by class name, e.g. `exportGroups["StaticMeshActor"]`. */
  readonly exportGroups: Record<string, { index: number; export: any }[]>;
  readonly header: { getArchiveFileVersion(): number; getLicenseeVersion(): number };
  /** 1-based object reference, as stored in the tables. */
  fetchObject<T = any>(objref: number): T;
  fetchObjectByType<T = any>(className: string, objectName: string, groupName?: string): T;
  /** Fully qualified `package.group.name`, package segment lower-cased. */
  getObjectPath(objref: number | any): string;
  loadNativeClasses(): void;
  isDecoded(): boolean;
}

/**
 * Registry of every package in a client, and the only way to open one.
 *
 * Reading bytes is left abstract because upstream fetches them over HTTP;
 * `packages/assets-server/scripts/unreal/node-loader.ts` is the offline
 * implementation.
 */
export declare abstract class AAssetLoader {
  protected constructor();
  protected init(assetList: Record<string, string>, library: unknown): this;
  protected abstract createPackage(constructor: any, downloadPath: string): any;
  protected abstract createNativePackage(constructor: any): any;
  getPackage(name: string, importClass?: string): UnrealPackage;
  getCorePackage(): UnrealPackage;
  getEnginePackage(): UnrealPackage;
  getNativePackage(): UnrealPackage;
  load<T>(pkg: T): Promise<T>;
}

export declare const UPackage: any;
export declare const UNativePackage: any;
export declare const UEnginePackage: any;
export declare const UCorePackage: any;

export declare const ULevel: any;
export declare const ULevelInfo: any;
/** Terrain: heightmap, `toWorld`, layers, sectors. See the assets-server README. */
export declare const ATerrainInfo: any;
export declare const UTerrainSector: any;
export declare const UTexture: any;
export declare const ETextureFormat: Record<string, number>;
export declare const UStaticMesh: any;
export declare const UStaticMeshActor: any;
export declare const ULight: any;
export declare const FZoneInfo: any;
export declare const USkyZoneInfo: any;

export declare const FVector: any;
export declare const FRotator: any;
export declare const FCoords: any;
export declare const FBox: any;
export declare const FColor: any;
export declare const FPlane: any;

export declare const BufferValue: any;
export declare const UObject: any;
export declare const crypto: any;
