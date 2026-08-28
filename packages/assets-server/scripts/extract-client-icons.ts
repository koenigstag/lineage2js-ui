/**
 * Extracts icon art out of an installed Lineage 2 client into this server's
 * own icon folders (assets/highfive/icons/{skills,items}), so the UI can
 * serve real icons without any of that art ever entering the repo -- the
 * output folders are covered by assets/.gitignore, same rule as the geodata
 * tiles (see convert-l2j-geodata.ts) and for the same reason.
 *
 * The client stores textures in Unreal packages (SysTextures/*.utx),
 * XOR-encrypted with an "Lineage2Ver121"-style header, so they can't just be
 * unpacked -- this shells out to UE Viewer (umodel, https://www.gildor.org),
 * which knows both that encryption (-game=l2) and the DXT/palette formats,
 * and only does the routing/naming itself.
 *
 * Run with:
 *   pnpm --filter @lineage2js/assets-server extract:icons -- \
 *     --client="D:\Games\Lineage2\L2_HighFive_Client" \
 *     --umodel="C:\ue_viewer\umodel_64.exe"
 *
 * Both can also come from the L2_CLIENT_DIR / UMODEL env vars. Add
 * --dry-run to see the routing without writing anything, and
 * --skills-map/--items-map to also build the index.json files the UI
 * resolves icons through (see below).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OUT_DIR = path.join(__dirname, "../assets/highfive/icons");

type Bucket = "skills" | "items";

/**
 * Source packages, in priority order (a name held by two of them is taken
 * from the first). Icon.utx is the retail set -- skills, equipment,
 * consumables -- while BranchSys2/branchSys hold item-mall and event items.
 */
const PACKAGES = ["SysTextures/Icon.utx", "SysTextures/BranchSys2.utx", "SysTextures/branchSys.utx"];

/**
 * Textures that aren't icons of anything. Kept deliberately narrow: an
 * unnecessary file in the output folders costs nothing (the UI only ever
 * requests the names its id -> file mapping lists), whereas a rule that's
 * too eager silently drops real art. Everything below was checked against
 * the retail High Five packages -- note e.g. that "magic43" is a marker but
 * "magic_pouch_belt_i00" is a real item, hence the anchored digits.
 */
const SKIP: RegExp[] = [
  /^item_(normal|canuse|system)\d+$/i, // inventory slot frames
  /^magic\d+$/i, // "magic type" markers on skill tooltips
  /^action\d+$/i, // social actions -- their own icon kind, see icons/actions
  /^icon\d+$/i,
  /^\$+/, // placeholder textures shipped with the client
];

/**
 * Only the skills side needs rules -- whatever survives SKIP and doesn't
 * match here is item art (equipment, consumables, quest items, the
 * "time_*" rental duplicates of weapons, the whole item-mall set), which
 * is far too varied to enumerate: the retail Icon.utx alone names items
 * "belt_i00", "adena", "yogi_stick_i00", "xmas_present_i00" and so on with
 * no shared prefix.
 */
const SKILL_ICONS: RegExp[] = [
  // skill0001..skill4295, plus the per-variant suffixes (skill5076_a/_b/_c).
  /^skill\d/i,
  // Herbs cast a buff on pickup, so their icon belongs with the buffs
  // (etc_crt_force_herb_i01, br_herb_rose_red_i00, ...) rather than with
  // the consumables -- this has to be checked before the item default.
  /herb/i,
];

interface Options {
  clientDir: string;
  umodel: string;
  dryRun: boolean;
  keepRaw: boolean;
  idMaps: Partial<Record<Bucket, string>>;
}

function parseArgs(argv: string[]): Options {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match) {
      throw new Error(`Unrecognized argument: ${arg}`);
    }
    flags.set(match[1], match[2] ?? "true");
  }

  const clientDir = flags.get("client") ?? process.env.L2_CLIENT_DIR;
  const umodel = flags.get("umodel") ?? process.env.UMODEL;
  if (!clientDir || !umodel) {
    throw new Error(
      "Both a client folder and a umodel binary are required, e.g.\n" +
        '  --client="D:\\Games\\Lineage2\\L2_HighFive_Client" --umodel="C:\\ue_viewer\\umodel_64.exe"\n' +
        "(or set L2_CLIENT_DIR / UMODEL)."
    );
  }

  const idMaps: Options["idMaps"] = {};
  if (flags.has("skills-map")) idMaps.skills = flags.get("skills-map");
  if (flags.has("items-map")) idMaps.items = flags.get("items-map");

  return { clientDir, umodel, dryRun: flags.get("dry-run") === "true", keepRaw: flags.get("keep-raw") === "true", idMaps };
}

/**
 * Object name a client icon reference points at: the datapack/DB writes them
 * as "<package>.<group>.<object>" (e.g.
 * "BranchSys2.icon.etc_crt_force_herb_i01", or just "icon.skill1563"), and
 * only the last segment names the texture. Everything in front of it --
 * the package (BranchSys2, Icon, L2UI, ...) and the group (icon, ui, sys,
 * ...) -- is addressing, not part of the name, and never reaches a file
 * name here: extracted files are written flat as "<object>.png".
 */
function iconRefToFileName(ref: string): string {
  const object = ref
    .trim()
    .replace(/\.(png|tga|dds|bmp)$/i, "") // some dumps carry the extension
    .split(".")
    .pop();
  return `${(object ?? "").toLowerCase()}.png`;
}

/** Target folder for a texture, or null when it isn't an icon at all (see SKIP). */
function bucketFor(name: string): Bucket | null {
  if (SKIP.some((rule) => rule.test(name))) {
    return null;
  }
  return SKILL_ICONS.some((rule) => rule.test(name)) ? "skills" : "items";
}

/** Every *.png under a directory tree, with its bare file name. */
async function collectPngs(dir: string): Promise<{ file: string; name: string }[]> {
  const found: { file: string; name: string }[] = [];
  async function walk(current: string): Promise<void> {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.toLowerCase().endsWith(".png")) {
        found.push({ file: full, name: path.parse(entry.name).name });
      }
    }
  }
  await walk(dir);
  return found;
}

/**
 * id -> icon reference, from a dump of whatever table holds the client icon
 * for each skill/item. Accepts JSON (an object keyed by id, or an array of
 * {id, icon} rows) and CSV/TSV with an "id,icon" pair per line -- a header
 * row is detected and skipped.
 */
async function readIdMap(file: string): Promise<Map<string, string>> {
  const raw = await fs.readFile(file, "utf8");
  const map = new Map<string, string>();

  if (path.extname(file).toLowerCase() === ".json") {
    const parsed: unknown = JSON.parse(raw);
    const rows = Array.isArray(parsed)
      ? (parsed as { id?: unknown; icon?: unknown }[]).map((row) => [String(row.id), String(row.icon)] as const)
      : Object.entries(parsed as Record<string, string>);
    for (const [id, icon] of rows) {
      if (id && icon && icon !== "undefined") {
        map.set(String(id), String(icon));
      }
    }
    return map;
  }

  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [id, icon] = line.split(/[,;\t]/).map((cell) => cell.trim().replace(/^["']|["']$/g, ""));
    if (!id || !icon || !/^\d+$/.test(id)) {
      continue; // header row, or a line that isn't an id/icon pair
    }
    map.set(id, icon);
  }
  return map;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const rawDir = await fs.mkdtemp(path.join(os.tmpdir(), "l2-icons-"));
  const routed = new Map<string, { bucket: Bucket; file: string; from: string }>();
  const collisions: string[] = [];
  const skipped = new Map<string, number>();

  try {
    for (const file of PACKAGES) {
      const packagePath = path.join(options.clientDir, file);
      try {
        await fs.access(packagePath);
      } catch {
        console.warn(`Skipping ${file} -- not found under ${options.clientDir}`);
        continue;
      }

      console.log(`Exporting ${file} ...`);
      // Each package gets its own temp folder (umodel writes
      // <out>/<package>/<class>/<object>.png inside it) so that a name held
      // by two packages -- 19 of them across the retail ones -- can be
      // spotted below instead of one export silently overwriting the other.
      const packageRawDir = path.join(rawDir, path.parse(file).name);
      const result = spawnSync(
        options.umodel,
        [`-path=${options.clientDir}`, "-game=l2", "-export", "-png", `-out=${packageRawDir}`, file.replace(/\//g, path.sep)],
        // umodel logs a line per exported texture -- thousands of them for
        // Icon.utx alone, well past spawnSync's 1MB default (which fails the
        // whole call with ENOBUFS rather than truncating).
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
      );
      if (result.error) {
        throw result.error;
      }
      if (result.status !== 0) {
        throw new Error(`umodel failed on ${file} (exit ${result.status}):\n${result.stderr || result.stdout}`);
      }

      for (const { file: pngFile, name } of await collectPngs(packageRawDir)) {
        // Flat, lowercased, object name only -- no package/group prefix and
        // no umodel subfolder. Lowercasing keeps the names stable between
        // the case-insensitive filesystem they're extracted on and the
        // case-sensitive one they're usually served from.
        const key = name.toLowerCase();
        const existing = routed.get(key);
        if (existing) {
          collisions.push(`${key} (kept ${existing.from}, ignored ${file})`);
          continue;
        }
        const bucket = bucketFor(name);
        if (!bucket) {
          const group = key.replace(/\d+$/, "") || key;
          skipped.set(group, (skipped.get(group) ?? 0) + 1);
          continue;
        }
        routed.set(key, { bucket, file: pngFile, from: file });
      }
    }

    const counts: Record<Bucket, number> = { skills: 0, items: 0 };
    for (const [key, { bucket, file }] of routed) {
      counts[bucket]++;
      if (options.dryRun) {
        continue;
      }
      const target = path.join(OUT_DIR, bucket);
      await fs.mkdir(target, { recursive: true });
      await fs.copyFile(file, path.join(target, key + ".png"));
    }

    console.log(
      `\n${options.dryRun ? "[dry run] " : ""}skills: ${counts.skills} icon(s), items: ${counts.items} icon(s)` +
        `${options.dryRun ? "" : ` -> ${OUT_DIR}`}`
    );
    if (collisions.length > 0) {
      console.log(`Name taken by more than one package (first one wins): ${collisions.join(", ")}`);
    }
    if (skipped.size > 0) {
      const top = [...skipped.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      const total = [...skipped.values()].reduce((sum, n) => sum + n, 0);
      console.log(`Not an icon, left behind (${total} texture(s)): ${top.map(([p, n]) => `${p}* x${n}`).join(", ")}`);
    }

    for (const [bucket, mapFile] of Object.entries(options.idMaps) as [Bucket, string][]) {
      const idMap = await readIdMap(mapFile);
      const index: Record<string, string> = {};
      const missing: string[] = [];
      for (const [id, ref] of idMap) {
        const fileName = iconRefToFileName(ref);
        if (routed.has(path.parse(fileName).name)) {
          index[id] = fileName;
        } else {
          missing.push(`${id} (${ref})`);
        }
      }

      const indexPath = path.join(OUT_DIR, bucket, "index.json");
      if (!options.dryRun) {
        await fs.mkdir(path.dirname(indexPath), { recursive: true });
        await fs.writeFile(indexPath, JSON.stringify(index, null, 2));
      }
      console.log(
        `${options.dryRun ? "[dry run] " : ""}${bucket}/index.json: ${Object.keys(index).length} id(s) mapped` +
          (missing.length > 0 ? `, ${missing.length} without a matching texture (e.g. ${missing.slice(0, 3).join(", ")})` : "")
      );
    }
  } finally {
    if (options.keepRaw) {
      console.log(`Raw umodel output kept at ${rawDir}`);
    } else {
      await fs.rm(rawDir, { recursive: true, force: true });
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
