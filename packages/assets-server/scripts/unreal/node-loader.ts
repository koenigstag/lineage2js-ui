/**
 * Node backend for the vendored Unreal Engine 2 readers.
 *
 * `@lineage2js/unreal-l2js-objects` was written for the browser: a package
 * fetches its own bytes over HTTP. Everything else about it is environment
 * neutral, so running it offline is a matter of overriding one method and
 * telling the loader which files exist.
 *
 * See `packages/unreal-l2js-objects/README.md` for what the readers cover and
 * where they diverge from upstream.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import * as Lib from "@lineage2js/unreal-l2js-objects";

const { AAssetLoader } = Lib as any;

/**
 * Every directory of the installed client that holds packages.
 *
 * `SysTextures` earns its place: leaving it out costs roughly 500 static
 * meshes, and not loudly -- they resolve a texture package to nothing and
 * throw well after their geometry has been read, which reads like a mesh
 * format problem rather than a missing directory.
 */
const PACKAGE_DIRS = ["system", "MAPS", "Textures", "SysTextures", "StaticMeshes", "Animations", "Sounds"];

const PACKAGE_EXTENSIONS = /\.(unr|utx|usx|ukx|uax|u)$/i;

/** Reads package bytes off disk instead of fetching them. */
function nodePackage(Base: any): any {
  return class NodePackage extends Base {
    protected async readArrayBuffer(): Promise<ArrayBuffer> {
      const buffer = await readFile(this.path);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    }

    public toBuffer(): ArrayBuffer {
      throw new Error("Writing packages is not supported.");
    }
  };
}

export interface ClientLoader {
  /** Fetches a package by name and import class, e.g. ("20_18", "Level"). */
  getPackage(name: string, importClass: string): any;
  load<T>(pkg: T): Promise<T>;
  /** Lower-cased base names of every package found, keyed by extension. */
  packageNames: Map<string, string[]>;
}

/**
 * Opens an installed client and runs the bootstrap every level decode needs.
 *
 * The struct and class layouts the readers build their objects from live in
 * the script packages, not in the level, so `Core.u` has to be walked before
 * anything else is touched -- exactly the sequence the upstream decode worker
 * performs.
 */
export async function openClient(clientDir: string): Promise<ClientLoader> {
  const assetList: Record<string, string> = {};
  const packageNames = new Map<string, string[]>();

  for (const dir of PACKAGE_DIRS) {
    let entries: string[];
    try {
      entries = await readdir(path.join(clientDir, dir));
    } catch {
      continue; // a client without, say, Voice/ is still a client
    }
    for (const entry of entries) {
      const match = entry.match(PACKAGE_EXTENSIONS);
      if (!match) continue;
      assetList[entry.toLowerCase()] = `${dir}/${entry}`;
      const ext = match[1].toLowerCase();
      const list = packageNames.get(ext) ?? [];
      list.push(entry.slice(0, -(ext.length + 1)).toLowerCase());
      packageNames.set(ext, list);
    }
  }

  class NodeAssetLoader extends AAssetLoader {
    protected createNativePackage(UNativePackage: any): any {
      return new (nodePackage(UNativePackage))(this);
    }

    protected createPackage(UPackage: any, downloadPath: string): any {
      return new (nodePackage(UPackage))(this, path.join(clientDir, downloadPath));
    }

    static open(list: Record<string, string>): any {
      return new NodeAssetLoader().init(list, Lib);
    }
  }

  const loader = NodeAssetLoader.open(assetList);

  await loader.load(loader.getNativePackage());
  const core = await loader.load(loader.getCorePackage());
  await loader.load(loader.getEnginePackage());
  core.loadNativeClasses();

  loader.packageNames = packageNames;
  return loader as ClientLoader;
}

/**
 * Silences the readers while a batch runs.
 *
 * They are chatty by design -- an unresolvable reference warns and carries on,
 * which is what Unreal itself does -- and a whole-client pass produces tens of
 * thousands of those lines. `console.assert` matters more: the bundle turns it
 * into a throw, which is how a mesh that did not consume its export exactly
 * announces itself, and that must keep working.
 */
export function quietly<T>(run: () => T): T {
  const warn = console.warn;
  const log = console.log;
  console.warn = () => {};
  console.log = () => {};
  try {
    return run();
  } finally {
    console.warn = warn;
    console.log = log;
  }
}
