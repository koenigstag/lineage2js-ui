/**
 * Converts the client's character-appearance table into JSON the web can read.
 *
 * `system/chargrp.dat` holds, per rig, the head mesh and texture for every
 * hair style and the three faces -- the list character creation offers. The
 * model pipeline had been reading that off the package listing, which is not
 * the same thing: a rig publishes head meshes the client never shows.
 *
 * Only the hair and face sections are decoded; see client-data/chargrp.ts.
 *
 * The output is derived from NCsoft's copyrighted client data and must never
 * be committed; it lands under assets/, covered by its blanket .gitignore.
 *
 * Run with:
 *   pnpm --filter @lineage2js/assets-server convert:chargrp -- \
 *     --client="D:\Games\Lineage2\L2_HighFive_Client"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bareHeads, readChargrp } from "./client-data/chargrp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "../assets/highfive/data");
const OUT_FILE = path.join(OUT_DIR, "chargrp.json");

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  const inline = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  return inline?.slice(flag.length + 1);
}

async function main(): Promise<void> {
  const client = readArg("--client") ?? process.env.L2_CLIENT_DIR;
  if (!client) {
    console.error('Required, e.g. --client="D:\\Games\\Lineage2\\L2_HighFive_Client" (or set L2_CLIENT_DIR).');
    process.exitCode = 1;
    return;
  }

  const source = path.join(client, "system", "chargrp.dat");
  if (!fs.existsSync(source)) {
    console.error(`No character table at ${source}`);
    process.exitCode = 1;
    return;
  }

  const records = readChargrp(source);
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  await fs.promises.writeFile(
    OUT_FILE,
    `${JSON.stringify(
      {
        source: "system/chargrp.dat",
        generated: new Date().toISOString(),
        note: "Only the hair and face sections of each record are decoded; see scripts/client-data/chargrp.ts.",
        rigs: records.map((record) => ({
          rig: record.rig,
          face: record.face,
          // What each style puts on a character in the starting set, which is
          // the list creation offers. A style can be more than one piece.
          styles: bareHeads(record),
          hair: record.hair,
        })),
      },
      null,
      2
    )}\n`
  );

  const size = (await fs.promises.stat(OUT_FILE)).size;
  console.log(`${records.length} rigs -> ${OUT_FILE} (${Math.round(size / 1024)} KB)`);
  for (const record of records) {
    const heads = bareHeads(record)
      .map((pieces) => pieces.map((head) => head.mesh.split(".").pop()).join("+") || "-")
      .join(", ");
    console.log(`  ${record.rig.padEnd(9)} ${record.face.texture.length} faces, styles: ${heads}`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
