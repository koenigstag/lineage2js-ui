/**
 * Converts lineage2ts's item datapack CSV into this project's own
 * public/item-stats/data.json -- the per-item stats (P.Atk, P.Def, attack
 * speed, ...) the inventory tooltip shows.
 *
 * None of this comes off the wire. Every item packet sends an item
 * *instance* -- object id, template id, count, enchant, augmentation,
 * attributes -- and nothing about what the template is worth in combat (see
 * GameClientPacket.readItem, and DatapackStore.itemGrades' comment for the
 * same gap on grade). A real client reads its own local item tables for
 * that; this is ours.
 *
 * Source: https://gitlab.com/MrTREX/lineage2ts/-/blob/master/cli/overrides/data/csv/items/items.csv
 * Download it to scripts/data/items.csv (or pass a path as the first
 * argument) and run:
 *
 *   pnpm --filter @lineage2js/ui convert:items
 *
 * The CSV itself isn't committed -- it's 3.4MB of someone else's datapack
 * and only the derived table is useful here. The output is, same as the
 * other public/ datapack tables.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DEFAULT_INPUT = path.join(__dirname, "data", "items.csv");
const OUTPUT = path.join(__dirname, "..", "public", "item-stats", "data.json");

/**
 * Only equipment gets an entry. etcitem/questitem rows carry nothing the
 * tooltip would show beyond weight, and there are 11k of them -- including
 * them grows the file by half again for one line of text nobody reads on a
 * quest scroll.
 */
const EQUIPMENT_TYPES = new Set(["weapon", "armor", "accessary"]);

/**
 * CSV column -> output key, for the numeric stats. Zero and blank are
 * dropped rather than emitted: "0 P.Atk" on a pair of boots is noise, and
 * across 7.7k items the omission is most of the file size.
 */
const NUMERIC_FIELDS: [column: string, key: string][] = [
  ["physicalDamage", "pAtk"],
  ["magicalDamage", "mAtk"],
  ["physicalDefense", "pDef"],
  ["magicalDefense", "mDef"],
  ["shieldDefense", "shieldDef"],
  ["shieldDefenseRate", "shieldRate"],
  ["avoidModify", "evasion"],
  ["attackSpeed", "atkSpd"],
  ["critical", "crit"],
  ["attackRange", "range"],
  ["hitModify", "accuracy"],
  ["soulshotCount", "soulshots"],
  ["spiritshotCount", "spiritshots"],
  ["mpConsume", "mpConsume"],
  ["weight", "weight"],
];

/** Same, for the short enum-ish strings. */
const TEXT_FIELDS: [column: string, key: string][] = [
  ["weaponType", "weaponType"],
  ["armorType", "armorType"],
  ["materialType", "material"],
];

/**
 * RFC4180-ish reader. Written out rather than pulled in as a dependency
 * because this is the only CSV in the project -- but not skipped either:
 * 458 rows in the source quote a field (useCondition's `|`-joined values),
 * and splitting on commas alone would carry the quote characters through
 * into the values.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char !== '"') {
        field += char;
      } else if (text[i + 1] === '"') {
        field += '"'; // an escaped quote inside a quoted field
        i++;
      } else {
        quoted = false;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

/** Parses a stat cell, returning undefined for blank, zero and anything unparseable -- all of which mean "don't show a line for this". */
function statValue(raw: string | undefined): number | undefined {
  if (!raw) {
    return undefined;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value !== 0 ? value : undefined;
}

async function main(): Promise<void> {
  const input = process.argv[2] ?? DEFAULT_INPUT;

  let csv: string;
  try {
    csv = await fs.readFile(input, "utf8");
  } catch {
    console.error(
      `No items CSV at ${input}.\n` +
        `Download it from lineage2ts (cli/overrides/data/csv/items/items.csv) to that path, ` +
        `or pass its location as the first argument.`
    );
    process.exitCode = 1;
    return;
  }

  const [header, ...rows] = parseCsv(csv);
  const columnIndex = new Map(header.map((name, index) => [name, index]));
  for (const column of [...NUMERIC_FIELDS, ...TEXT_FIELDS].map(([c]) => c).concat("itemId", "type")) {
    if (!columnIndex.has(column)) {
      throw new Error(`Column "${column}" is missing -- the source CSV's layout changed, check the field lists above.`);
    }
  }
  const cell = (row: string[], column: string): string | undefined => row[columnIndex.get(column)!];

  const stats: Record<string, Record<string, number | string>> = {};
  let skipped = 0;

  for (const row of rows) {
    if (row.length <= 1) {
      continue; // trailing newline
    }
    if (!EQUIPMENT_TYPES.has(cell(row, "type") ?? "")) {
      skipped++;
      continue;
    }

    const entry: Record<string, number | string> = {};
    for (const [column, key] of NUMERIC_FIELDS) {
      const value = statValue(cell(row, column));
      if (value !== undefined) {
        entry[key] = value;
      }
    }
    for (const [column, key] of TEXT_FIELDS) {
      const value = cell(row, column);
      if (value) {
        entry[key] = value;
      }
    }

    if (Object.keys(entry).length > 0) {
      stats[cell(row, "itemId")!] = entry;
    }
  }

  // Sorted numerically so regenerating from an updated CSV produces a
  // reviewable diff instead of a reshuffled file.
  const sorted: typeof stats = {};
  for (const id of Object.keys(stats).sort((a, b) => Number(a) - Number(b))) {
    sorted[id] = stats[id];
  }

  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(sorted));

  const bytes = (await fs.stat(OUTPUT)).size;
  console.log(
    `Wrote ${Object.keys(sorted).length} equipment entries to ${path.relative(process.cwd(), OUTPUT)} ` +
      `(${(bytes / 1024).toFixed(0)} KB), skipping ${skipped} non-equipment rows.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
