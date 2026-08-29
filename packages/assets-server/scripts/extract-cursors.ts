/**
 * Copies a folder of loose .cur (Windows cursor) files into this server's
 * own assets/highfive/cursors/, so the UI can serve real cursor art without
 * any of it ever entering the repo -- same gitignored-output rule as
 * icons/models/geodata (see assets/.gitignore).
 *
 * Unlike extract-client-icons.ts there's no client package to unpack here:
 * .cur is already a plain, valid file format browsers render directly via
 * CSS `cursor: url(...)`, so this only normalizes file names -- it doesn't
 * decode or convert anything. Source is typically a fan-made cursor pack
 * (loose .cur files, sometimes bundled with a Windows .crs scheme file that
 * names the built-in Windows pointer roles it's meant to replace) -- the
 * .crs, if present, is ignored: which game *state* gets which cursor is a
 * separate mapping decided in the UI, not the small set of Windows roles a
 * .crs enumerates.
 *
 * Run with:
 *   pnpm --filter @lineage2js/assets-server extract:cursors -- \
 *     --source="D:\Downloads\Internet\l2combo"
 *
 * --source can also come from the CURSOR_SOURCE_DIR env var. Add --dry-run
 * to see the renaming without writing anything.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../assets/highfive/cursors");

interface Options {
  source: string;
  dryRun: boolean;
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

  const source = flags.get("source") ?? process.env.CURSOR_SOURCE_DIR;
  if (!source) {
    throw new Error(
      'A source folder is required, e.g.\n  --source="D:\\Downloads\\Internet\\l2combo"\n(or set CURSOR_SOURCE_DIR).'
    );
  }
  return { source, dryRun: flags.get("dry-run") === "true" };
}

/**
 * "Lineage 2 anti-spell caster.cur" -> "anti-spell-caster.cur"; the bare
 * "Lineage 2.cur" (nothing left after stripping the prefix) -> "default.cur".
 */
function normalizeFileName(fileName: string): string {
  const base = path.parse(fileName).name;
  const stripped = base.replace(/^lineage\s*2\s*/i, "").trim();
  const slug = (stripped || "default").toLowerCase().replace(/\s+/g, "-");
  return `${slug}.cur`;
}

async function main(): Promise<void> {
  const { source, dryRun } = parseArgs(process.argv.slice(2));

  const entries = await fs.readdir(source, { withFileTypes: true });
  const curFiles = entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".cur"));
  if (curFiles.length === 0) {
    throw new Error(`No .cur files found under ${source}.`);
  }

  if (!dryRun) {
    await fs.mkdir(OUT_DIR, { recursive: true });
  }

  const written: string[] = [];
  const collisions: string[] = [];
  const seen = new Map<string, string>();
  for (const entry of curFiles) {
    const outName = normalizeFileName(entry.name);
    const existing = seen.get(outName);
    if (existing) {
      collisions.push(`${outName} (kept ${existing}, ignored ${entry.name})`);
      continue;
    }
    seen.set(outName, entry.name);
    if (!dryRun) {
      await fs.copyFile(path.join(source, entry.name), path.join(OUT_DIR, outName));
    }
    written.push(`${entry.name} -> ${outName}`);
  }

  console.log(`${dryRun ? "[dry run] " : ""}${written.length} cursor(s):\n  ${written.join("\n  ")}`);
  if (collisions.length > 0) {
    console.log(`Name collision after normalizing (first one wins): ${collisions.join(", ")}`);
  }
  if (!dryRun) {
    console.log(`-> ${OUT_DIR}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
