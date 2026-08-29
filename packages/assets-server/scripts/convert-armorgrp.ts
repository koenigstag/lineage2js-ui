/**
 * Converts the client's armour table into JSON the web can read.
 *
 * `system/armorgrp.dat` is RSA-encrypted and zlib-packed, and holds, for every
 * armour item, the mesh and texture it puts on each of the sixteen player
 * rigs. That is the client's own answer to which art dresses which body -- the
 * thing the rig converter used to infer from texture names, and got wrong for
 * the mystics' legs and the Kamael's gloves.
 *
 * The output is derived from NCsoft's copyrighted client data and must never
 * be committed; it lands under assets/, covered by its blanket .gitignore.
 *
 * Run with:
 *   pnpm --filter @lineage2js/assets-server convert:armorgrp -- \
 *     --client="D:\Games\Lineage2\L2_HighFive_Client"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bareBodies, BODY_SLOTS, readArmorgrp } from "./client-data/armorgrp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../assets/highfive/data");
const OUT_FILE = path.join(OUT_DIR, "armorgrp.json");
const BARE_FILE = path.join(OUT_DIR, "bare-bodies.json");

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

async function main(): Promise<void> {
  const client = readArg("--client") ?? process.env.L2_CLIENT_DIR;
  if (!client) {
    console.error(
      'Required, e.g. --client="D:\\Games\\Lineage2\\L2_HighFive_Client" (or set L2_CLIENT_DIR).'
    );
    process.exitCode = 1;
    return;
  }

  const source = path.join(client, "system", "armorgrp.dat");
  if (!fs.existsSync(source)) {
    console.error(`No armour table at ${source}`);
    process.exitCode = 1;
    return;
  }

  const records = readArmorgrp(source);
  const bare = bareBodies(records);
  const rigs = BODY_SLOTS.filter((slot) => slot !== "spare");
  const generated = new Date().toISOString();

  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  // The whole table, unindented: 3650 records of mostly strings, and this is
  // the copy something fetches rather than reads.
  await fs.promises.writeFile(
    OUT_FILE,
    JSON.stringify({ source: "system/armorgrp.dat", generated, rigs, items: records })
  );
  // The empty-slot bodies on their own, indented, because this is the one a
  // person opens to see which texture belongs on which rig.
  await fs.promises.writeFile(
    BARE_FILE,
    `${JSON.stringify({ source: "system/armorgrp.dat", generated, rigs, bare }, null, 2)}\n`
  );

  const size = (await fs.promises.stat(OUT_FILE)).size;
  console.log(`${records.length} armour records -> ${OUT_FILE} (${(size / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`empty-slot bodies -> ${BARE_FILE}`);
  for (const [slot, bodies] of Object.entries(bare)) {
    const dressed = Object.keys(bodies).length;
    console.log(`  bare ${slot.padEnd(6)} ${dressed} rigs, e.g. MMagic ${bodies.MMagic?.texture.join(", ")}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
