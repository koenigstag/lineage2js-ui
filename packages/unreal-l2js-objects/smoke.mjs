// Temporary smoke test: does the vendored reader open a High Five map, and can
// it get to the terrain and its heightmap?
// Run: node smoke.mjs [path-to-client]
import { readFile, readdir } from "node:fs/promises";
import * as path from "node:path";
import * as Lib from "./dist/index.js";

const { AAssetLoader } = Lib;
const CLIENT = process.argv[2] ?? "D:/Games/Lineage2/L2_HighFive_Client";

/** Reads package bytes off disk instead of fetching them over HTTP. */
function nodePackage(Base) {
  return class NodePackage extends Base {
    async readArrayBuffer() {
      const buf = await readFile(this.path);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    }
    toBuffer() {
      throw new Error("not implemented");
    }
  };
}

class NodeAssetLoader extends AAssetLoader {
  createNativePackage(UNativePackage) {
    return new (nodePackage(UNativePackage))(this);
  }
  createPackage(UPackage, downloadPath) {
    return new (nodePackage(UPackage))(this, path.join(CLIENT, downloadPath));
  }
  static make(assetList) {
    return new NodeAssetLoader().init(assetList, Lib);
  }
}

/** Every package the client ships, keyed the way the loader expects. */
async function scanClient() {
  const list = {};
  for (const dir of ["system", "MAPS", "Textures", "SysTextures", "StaticMeshes", "Animations", "Sounds"]) {
    let names;
    try {
      names = await readdir(path.join(CLIENT, dir));
    } catch {
      continue;
    }
    for (const name of names) {
      if (!/\.(unr|utx|usx|ukx|uax|u)$/i.test(name)) continue;
      list[name.toLowerCase()] = `${dir}/${name}`;
    }
  }
  return list;
}

const loader = NodeAssetLoader.make(await scanClient());

// Same bootstrap the upstream decode worker runs before any level decode:
// the struct/class layouts the readers build their objects from live in the
// script packages, not in the level.
await loader.load(loader.getNativePackage());
const pkgCore = await loader.load(loader.getCorePackage());
await loader.load(loader.getEnginePackage());
pkgCore.loadNativeClasses();

const pkg = await loader.load(loader.getPackage("20_18", "Level"));

console.log("\n== package ==");
console.log("  file    ", pkg.path.split(/[\\/]/).pop());
console.log("  version ", `${pkg.header.getArchiveFileVersion()}/${pkg.header.getLicenseeVersion()}`);
console.log("  exports ", pkg.exports.length, "imports", pkg.imports.length);

const [terrainEntry] = pkg.exportGroups["TerrainInfo"] ?? [];
if (!terrainEntry) throw new Error("no TerrainInfo export");

const terrain = pkg.fetchObject(terrainEntry.index + 1).loadSelf();

console.log("\n== TerrainInfo ==");
console.log("  terrainScale ", String(terrain.terrainScale));
console.log("  heightmap    ", `${terrain.heightmapX}x${terrain.heightmapY}`);
console.log("  sectors      ", terrain.sectors?.length);
console.log("  toWorld      ", String(terrain.toWorld));
console.log("  layers       ", terrain.layers?.filter?.((l) => l && l.texture)?.length ?? "?");

console.log("\n== heightmap texture ==");
const map = terrain.terrainMap?.loadSelf?.();
console.log("  object   ", map?.objectName);
console.log("  format   ", map?.format, "(10 = TEXF_G16)");
console.log("  size     ", `${map?.width}x${map?.height}`);
const mip = map?.mipmaps?.getElem?.(0) ?? map?.mipmaps?.[0];
const bytes = mip?.dataArray?.getTypedArray?.();
console.log("  mip0     ", bytes ? `${bytes.length} bytes (expect 131072)` : "MISSING");
if (bytes) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < bytes.length; i += 2) {
    const v = bytes[i] | (bytes[i + 1] << 8);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  const { origin, zAxis } = terrain.toWorld;
  const toZ = (h) => (h - origin.z) * zAxis.z;
  console.log("  raw range ", lo, "..", hi);
  console.log("  world Z   ", toZ(lo).toFixed(1), "..", toZ(hi).toFixed(1));
}

console.log("");
console.log("== layers ==");
for (let i = 0; i < (terrain.layers?.length ?? 0); i++) {
  const layer = terrain.layers[i];
  if (!layer?.map) continue;
  console.log(`  ${i}  ${String(layer.map.objectName).padEnd(14)} alpha=${layer.alphaMap?.objectName ?? "-"}`);
}

console.log("");
console.log("== texture sweep: every texture in 12 packages ==");
const texPackages = ["t_20_18", "t_oren", "t_20_19", "t_21_18", "t_22_22", "t_17_25"];
let ok = 0, failed = 0, formats = new Map();
for (const name of texPackages) {
  let texPkg;
  try {
    texPkg = loader.getPackage(name, "Texture");
  } catch {
    continue;
  }
  await loader.load(texPkg);
  for (const entry of texPkg.exportGroups["Texture"] ?? []) {
    try {
      const t = texPkg.fetchObject(entry.index + 1).loadSelf();
      ok++;
      formats.set(t.format, (formats.get(t.format) ?? 0) + 1);
    } catch (e) {
      failed++;
      if (failed < 6) console.log("  FAILED", name, entry.export.objectName, String(e.message).slice(0, 70));
    }
  }
}
console.log(`  ${ok} textures read, ${failed} failed`);
console.log("  formats:", [...formats].map(([f, n]) => `${n}x fmt${f}`).join(", "));

// --- static meshes -----------------------------------------------------
// The format gates on the *package's* licensee version, and this client ships
// every value from 11 to 37 -- packages saved years apart and never re-saved.
// One package per version is what actually exercises the gates; pass
// SMOKE_ALL_MESHES=1 to read all 258 instead (needs a bigger heap).
console.log("");
console.log("== static meshes ==");

const usx = [];
for (const [key, rel] of Object.entries(await scanClient())) {
  if (key.endsWith(".usx")) usx.push(key.replace(/\.usx$/, ""));
}

const seenLicensee = new Map();
let meshTotal = 0, meshExact = 0, meshThrew = 0;

for (const name of usx) {
  let pkg;
  try {
    pkg = await loader.load(loader.getPackage(name, "StaticMesh"));
  } catch {
    continue;
  }
  const lic = pkg.header.getLicenseeVersion();
  if (!process.env.SMOKE_ALL_MESHES && seenLicensee.has(lic)) continue;

  let exact = 0, total = 0;
  for (const entry of pkg.exportGroups["StaticMesh"] ?? []) {
    total++;
    try {
      const mesh = pkg.fetchObject(entry.index + 1).loadSelf();
      if (mesh.readTail - mesh.readHead === 0) exact++;
    } catch {
      meshThrew++;
    }
  }
  meshTotal += total;
  meshExact += exact;
  const prev = seenLicensee.get(lic) ?? { exact: 0, total: 0 };
  seenLicensee.set(lic, { exact: prev.exact + exact, total: prev.total + total });
}

for (const [lic, s] of [...seenLicensee].sort((a, b) => a[0] - b[0])) {
  console.log(`  licensee ${String(lic).padStart(2)}: ${String(s.exact).padStart(4)}/${String(s.total).padStart(4)} consumed exactly`);
}
console.log(`  total ${meshExact}/${meshTotal}, ${meshThrew} threw`);
