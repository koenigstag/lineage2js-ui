/**
 * Reads the client's npcstring table into assets/highfive/data/npcstring-<lang>.json.
 *
 * These are the strings the server refers to by number rather than sending:
 * an html dialogue arrives carrying `<fstring>1001004</fstring>` and the
 * client is expected to look 1001004 up in this table and draw "Oren". Every
 * one of those is a bare number in a client that can't (see lineage2ts's
 * CastleOwnerStatus, which builds a whole territory page out of them).
 *
 * Same shape as convert-armorgrp / convert-chargrp: point it at an installed
 * client and it writes one JSON next to their output.
 *
 *   pnpm --filter @lineage2js/assets-server convert:npcstring -- --client="D:\Games\Lineage2\L2_HighFive_Client"
 *
 * The record schema is just `id` + string, but the string is an Unreal
 * FString whose length is a compact index *and* whose sign picks the
 * encoding -- this table mixes single-byte and UTF-16 rows freely, so
 * assuming either one drifts a byte and then reads garbage (see
 * DatReader.fstring). The parse has to land exactly on the file's
 * SafePackage marker, same line armorgrp.ts and chargrp.ts hold: a schema
 * that "mostly works" fails loudly instead of returning plausible nonsense.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatReader, readDatFile } from "./client-data/l2-dat";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../assets/highfive/data");

function readArg(name: string): string | undefined {
  const prefix = `${name}=`;
  const hit = process.argv.find((argument) => argument.startsWith(prefix));
  return hit?.slice(prefix.length).replace(/^"|"$/gu, "");
}

function main(): void {
  const client = readArg("--client") ?? process.env.L2_CLIENT_DIR;
  if (!client) {
    console.error("--client is required.");
    console.error('e.g. --client="D:\\Games\\Lineage2\\L2_HighFive_Client" (or set L2_CLIENT_DIR).');
    process.exitCode = 1;
    return;
  }

  const lang = readArg("--lang") ?? "e";
  const file = path.join(client, "system", `npcstring-${lang}.dat`);
  if (!fs.existsSync(file)) {
    console.error(`No ${path.basename(file)} in ${path.join(client, "system")}.`);
    process.exitCode = 1;
    return;
  }

  const reader = new DatReader(readDatFile(file));
  const count = reader.u32();
  const strings: Record<string, string> = {};

  for (let index = 0; index < count; index++) {
    const id = reader.u32();
    const value = reader.fstring();
    if (value) {
      strings[id] = value;
    }
  }

  // The trailer is the table's own ASCII marker, and reaching it exactly is
  // the proof the schema consumed every record correctly.
  const trailer = reader.pascalString();
  if (trailer !== "SafePackage") {
    throw new Error(
      `read ${count} records but landed on ${JSON.stringify(trailer)} instead of "SafePackage" ` +
        `at offset ${reader.offset} -- the record schema is wrong.`
    );
  }
  if (!reader.done) {
    throw new Error(`${reader.rest.length} bytes left after SafePackage -- the record schema is wrong.`);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `npcstring-${lang}.json`);
  fs.writeFileSync(out, JSON.stringify(strings));

  const bytes = fs.statSync(out).size;
  console.log(
    `Wrote ${Object.keys(strings).length} strings (of ${count} records) to ` +
      `${path.relative(process.cwd(), out)} (${(bytes / 1024).toFixed(0)} KB).`
  );
}

main();
