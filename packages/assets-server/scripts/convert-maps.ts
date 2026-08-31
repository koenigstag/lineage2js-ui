/**
 * Reads the client's Unreal Engine 2 maps (`MAPS/<x>_<y>.unr`) and writes, per
 * map, everything needed to put the real world on screen:
 *
 *   assets/highfive/maps/<x>_<y>/scene.json     terrain metadata + actor placement
 *   assets/highfive/maps/<x>_<y>/heightmap.bin  256x256 16-bit heights, raw
 *
 * and, with `--meshes`, the geometry those actors point at:
 *
 *   assets/highfive/static-meshes/<Package>/    glTF per mesh, via umodel
 *
 * This is the one part of the client nothing off the shelf reads. umodel
 * covers the assets -- it is what exports the meshes here -- but it has no
 * classes for `TerrainInfo`, `StaticMeshActor` or `Light`, and it refuses
 * `TEXF_G16` outright, which is the format of every heightmap. The readers
 * doing the work are the vendored forks in `packages/unreal-l2js-*`; see
 * `packages/assets-server/README.md` for the format itself.
 *
 * Everything written here derives from the copyrighted client and must never
 * be committed -- it lands under assets/, covered by its blanket .gitignore,
 * same policy as the icons and geodata.
 *
 * Run with:
 *
 *     pnpm --filter @lineage2js/assets-server convert:maps \
 *       --client="D:\Games\Lineage2\L2_HighFive_Client" \
 *       --umodel="C:\ue_viewer\umodel_64.exe" --meshes
 *
 * `--only=20_18,22_22` restricts to named maps; without `--meshes` it writes
 * the scene files alone, which needs no umodel and takes seconds per map.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openClient, quietly, type ClientLoader } from "./unreal/node-loader";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAPS_OUT = path.join(__dirname, "../assets/highfive/maps");
const MESHES_OUT = path.join(__dirname, "../assets/highfive/static-meshes");

/**
 * A map covers exactly one geodata region: 256 terrain quads of 128 units.
 * Mirrors GEO_REGION_SIZE in packages/ui/src/config/geodata.ts, and the two
 * agreeing is not a coincidence -- see the README.
 */
const MAP_SIZE = 32768;
const MAP_ZERO_X = 20;
const MAP_ZERO_Y = 18;

const MAP_FILE_PATTERN = /^(\d+)_(\d+)$/;

interface TerrainLayerInfo {
  texture: string | null;
  alphaMap: string | null;
  uScale: number;
  vScale: number;
}

interface ActorInfo {
  mesh: number;
  pos: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

/**
 * `Package.Group.Name`, the same shape umodel names its export directories by.
 *
 * getObjectPath already returns a fully qualified path, but its first segment
 * is the package name as the name table spells it, which is lower-cased.
 * Names resolve without regard to case (Unreal's FName rule, see the objects
 * package README), so that costs nothing when reading -- but umodel writes its
 * output into a directory named after the file, so the file's own spelling is
 * what a consumer has to look under.
 */
function qualifiedName(object: any): string | null {
  if (!object?.exp || !object?.pkg) return null;
  const pkgName = path.basename(String(object.pkg.path)).replace(/\.[^.]+$/, "");
  const objectPath = String(object.pkg.getObjectPath(object.exp));
  const withoutPackage = objectPath.slice(objectPath.indexOf(".") + 1);
  return `${pkgName}.${withoutPackage}`;
}

function round(value: number, places = 3): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function readTerrain(pkg: any): Record<string, unknown> | null {
  const [entry] = pkg.exportGroups["TerrainInfo"] ?? [];
  if (!entry) return null;

  const terrain = pkg.fetchObject(entry.index + 1).loadSelf();

  const layers: TerrainLayerInfo[] = [];
  for (let i = 0; i < (terrain.layers?.length ?? 0); i++) {
    const layer = terrain.layers[i];
    if (!layer?.map) continue;
    layers.push({
      texture: qualifiedName(layer.map),
      alphaMap: qualifiedName(layer.alphaMap),
      uScale: round(layer.uScale ?? 1),
      vScale: round(layer.vScale ?? 1),
    });
  }

  const scale = terrain.terrainScale;
  const toWorld = terrain.toWorld;
  const axis = (v: any): [number, number, number] => [round(v.x, 6), round(v.y, 6), round(v.z, 6)];

  return {
    scale: [round(scale.x), round(scale.y), round(scale.z)],
    heightmap: {
      width: terrain.heightmapX,
      height: terrain.heightmapY,
      // TEXF_G16: unsigned 16-bit little-endian, one sample per vertex.
      format: "g16",
      file: "heightmap.bin",
    },
    // Unreal's TransformPointBy subtracts the origin before projecting onto
    // the axes, so a sample becomes:
    //   world = ((hx, hy, height) - origin) . (xAxis, yAxis, zAxis)
    toWorld: {
      origin: axis(toWorld.origin),
      xAxis: axis(toWorld.xAxis),
      yAxis: axis(toWorld.yAxis),
      zAxis: axis(toWorld.zAxis),
    },
    sectors: terrain.sectors?.length ?? 0,
    layers,
  };
}

/** The heightmap is an ordinary texture object -- in the one format umodel will not export. */
function readHeightmap(pkg: any): Uint8Array | null {
  const [entry] = pkg.exportGroups["TerrainInfo"] ?? [];
  if (!entry) return null;

  const terrain = pkg.fetchObject(entry.index + 1).loadSelf();
  const map = terrain.terrainMap?.loadSelf?.();
  const mip = map?.mipmaps?.getElem?.(0) ?? map?.mipmaps?.[0];
  const bytes = mip?.dataArray?.getTypedArray?.() as Uint8Array | undefined;
  if (!bytes) return null;

  const expected = map.width * map.height * 2;
  if (bytes.length !== expected) {
    throw new Error(`heightmap is ${bytes.length} bytes, expected ${expected} for ${map.width}x${map.height}`);
  }
  return bytes;
}

function readActors(pkg: any): { meshes: string[]; actors: ActorInfo[]; skipped: number } {
  const meshIds = new Map<string, number>();
  const actors: ActorInfo[] = [];
  let skipped = 0;

  for (const entry of pkg.exportGroups["StaticMeshActor"] ?? []) {
    let actor: any;
    try {
      actor = pkg.fetchObject(entry.index + 1).loadSelf();
    } catch {
      skipped++;
      continue;
    }

    const name = qualifiedName(actor.mesh);
    if (!name || !actor.location) {
      // An actor whose mesh reference did not resolve draws nothing in the
      // real client either -- Unreal treats an unresolvable reference as None.
      skipped++;
      continue;
    }

    let mesh = meshIds.get(name);
    if (mesh === undefined) {
      mesh = meshIds.size;
      meshIds.set(name, mesh);
    }

    const record: ActorInfo = {
      mesh,
      // L2 world units, exactly as the client stores them. The UI converts to
      // three.js space itself (utils/coords), the same as it does for creature
      // positions off the wire -- converting here would bake one client's
      // axis convention into the asset.
      pos: [round(actor.location.x, 2), round(actor.location.y, 2), round(actor.location.z, 2)],
    };

    const rot = actor.rotation;
    if (rot && (rot.pitch || rot.yaw || rot.roll)) {
      // Unreal rotator units: 65536 to the turn, not radians.
      record.rot = [rot.pitch, rot.yaw, rot.roll];
    }

    const drawScale = actor.drawScale ?? 1;
    const s = actor.scale;
    const sx = round((s?.x ?? 1) * drawScale, 5);
    const sy = round((s?.y ?? 1) * drawScale, 5);
    const sz = round((s?.z ?? 1) * drawScale, 5);
    if (sx !== 1 || sy !== 1 || sz !== 1) record.scale = [sx, sy, sz];

    actors.push(record);
  }

  return { meshes: [...meshIds.keys()], actors, skipped };
}

async function convertMap(loader: ClientLoader, mapName: string): Promise<Set<string>> {
  const [, rawX, rawY] = mapName.match(MAP_FILE_PATTERN) ?? [];
  if (!rawX) throw new Error(`Not a map name: ${mapName}`);
  const mapX = Number(rawX);
  const mapY = Number(rawY);

  const pkg = await loader.load(loader.getPackage(mapName, "Level"));

  const { terrain, heightmap, meshes, actors, skipped } = quietly(() => ({
    terrain: readTerrain(pkg),
    heightmap: readHeightmap(pkg),
    ...readActors(pkg),
  }));

  const outDir = path.join(MAPS_OUT, mapName);
  await fs.mkdir(outDir, { recursive: true });

  const scene = {
    map: [mapX, mapY],
    // World coordinates of the map's minimum corner. Region 20_18 starts at
    // world origin, which is what makes these line up with the geodata tiles.
    worldOrigin: [(mapX - MAP_ZERO_X) * MAP_SIZE, (mapY - MAP_ZERO_Y) * MAP_SIZE],
    worldSize: MAP_SIZE,
    terrain: terrain ?? null,
    meshes,
    actors,
  };

  await fs.writeFile(path.join(outDir, "scene.json"), JSON.stringify(scene));
  if (heightmap) await fs.writeFile(path.join(outDir, "heightmap.bin"), heightmap);

  const packages = new Set(meshes.map((name) => name.split(".")[0].toLowerCase()));

  console.log(
    `${mapName}: ${actors.length} actors, ${meshes.length} meshes from ${packages.size} packages` +
      `${terrain ? `, terrain ${(terrain.heightmap as any).width}x${(terrain.heightmap as any).height}` : ", no terrain"}` +
      `${skipped ? `, ${skipped} skipped` : ""}`
  );

  return packages;
}

/**
 * One umodel call per package, never per object -- whole-package export is the
 * difference between seconds and minutes, and every map that reuses a package
 * reuses the same output.
 */
function exportMeshes(umodel: string, client: string, packages: Set<string>): void {
  let done = 0;
  for (const name of [...packages].sort()) {
    const result = spawnSync(
      umodel,
      [`-path=${client}`, "-game=l2", "-export", "-gltf", `-out=${MESHES_OUT}`, "-nooverwrite", `StaticMeshes/${name}.usx`],
      { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
    if (result.status !== 0) {
      console.warn(`  umodel failed on ${name}: ${(result.stderr || result.stdout || "").split("\n").slice(-3).join(" ")}`);
      continue;
    }
    done++;
  }
  console.log(`exported ${done}/${packages.size} mesh packages to assets/highfive/static-meshes`);
}

/**
 * Converting the whole client in one process runs out of memory around two
 * thirds of the way through: the loader keeps every package it has opened, and
 * 208 maps pull in every texture and mesh package they reference. Freeing the
 * decoded buffers between maps makes it *worse* -- packages simply decode
 * again, and the churn costs more than it returns (measured: 85 maps before
 * dying, against 145 without).
 *
 * So each batch gets its own process, which is the only thing that reliably
 * gives the memory back. Re-running the Core.u bootstrap per batch costs about
 * a second.
 */
async function runInBatches(maps: string[], size: number, client: string): Promise<void> {
  const self = fileURLToPath(import.meta.url);
  for (let start = 0; start < maps.length; start += size) {
    const batch = maps.slice(start, start + size);
    const result = spawnSync(
      process.execPath,
      [...process.execArgv, self, "--child", `--client=${client}`, `--only=${batch.join(",")}`],
      {
        stdio: "inherit",
        env: { ...process.env, NODE_OPTIONS: process.env.NODE_OPTIONS ?? "--max-old-space-size=8192" },
      }
    );
    if (result.status !== 0) {
      console.warn(`batch ${batch[0]}..${batch[batch.length - 1]} exited ${result.status}`);
    }
  }
}

/** Every mesh package referenced by the scene files written so far. */
async function referencedPackages(): Promise<Set<string>> {
  const packages = new Set<string>();
  for (const entry of await fs.readdir(MAPS_OUT)) {
    let scene: { meshes?: string[] };
    try {
      scene = JSON.parse(await fs.readFile(path.join(MAPS_OUT, entry, "scene.json"), "utf8"));
    } catch {
      continue;
    }
    for (const mesh of scene.meshes ?? []) packages.add(mesh.split(".")[0].toLowerCase());
  }
  return packages;
}

async function main(): Promise<void> {
  const client = readArg("--client") ?? process.env.L2_CLIENT_DIR;
  if (!client) {
    console.error('--client is required, e.g. --client="D:\\Games\\Lineage2\\L2_HighFive_Client" (or set L2_CLIENT_DIR).');
    process.exitCode = 1;
    return;
  }

  const wantMeshes = process.argv.includes("--meshes");
  const umodel = readArg("--umodel") ?? process.env.UMODEL;
  if (wantMeshes && !umodel) {
    console.error('--meshes needs --umodel="C:\\ue_viewer\\umodel_64.exe" (or set UMODEL).');
    process.exitCode = 1;
    return;
  }

  const loader = await openClient(client);

  const only = readArg("--only")?.split(",").map((name) => name.trim().toLowerCase());
  const available = (loader.packageNames.get("unr") ?? []).filter((name) => MAP_FILE_PATTERN.test(name));
  const maps = only ? available.filter((name) => only.includes(name)) : available;

  if (maps.length === 0) {
    console.error(only ? `No map matched ${only.join(", ")}. Client has ${available.length}.` : "No maps found in the client.");
    process.exitCode = 1;
    return;
  }

  await fs.mkdir(MAPS_OUT, { recursive: true });

  const batchSize = Number(readArg("--batch") ?? 16);
  const isChild = process.argv.includes("--child");

  if (!isChild && maps.length > batchSize) {
    await runInBatches(maps, batchSize, client);
    const referenced = await referencedPackages();
    const written = (await fs.readdir(MAPS_OUT)).length;
    console.log(`
${written}/${maps.length} maps, ${referenced.size} mesh packages referenced`);
    if (wantMeshes) {
      await fs.mkdir(MESHES_OUT, { recursive: true });
      exportMeshes(umodel!, client, referenced);
    }
    return;
  }

  const packages = new Set<string>();
  let failed = 0;
  for (const mapName of maps) {
    try {
      for (const name of await convertMap(loader, mapName)) packages.add(name);
    } catch (error) {
      failed++;
      console.warn(`${mapName}: ${(error as Error).message}`);
      if (process.argv.includes("--verbose")) console.warn((error as Error).stack);
    }
  }

  if (isChild) return;

  console.log(`
${maps.length - failed}/${maps.length} maps, ${packages.size} mesh packages referenced`);

  if (wantMeshes) {
    await fs.mkdir(MESHES_OUT, { recursive: true });
    exportMeshes(umodel!, client, packages);
  }
}

main();
