/**
 * Reading the Lineage 2 client's `system/*.dat` tables.
 *
 * They are RSA-encrypted in 128-byte blocks and then zlib-deflated, with the
 * scheme named by a 28-byte UTF-16 header ("Lineage2Ver413"). Decryption uses
 * the *public* key, which the client has to carry in order to read its own
 * files -- and does, as a plain hex string in its binaries. That is where both
 * keys below come from, so neither is a guess:
 *
 * - the NCsoft key for version 413, in the stock `Engine.dll`, `Core.dll` and
 *   `nwindow.dll` of a High Five client;
 * - the l2encdec key, in a repacked `L2.exe`. Free-server clients are commonly
 *   shipped with their tables re-encrypted by that tool and the executable
 *   patched to match, which leaves the header still saying 413 while the
 *   NCsoft key produces noise. The reference client here is one of them: 53 of
 *   its 54 tables need this key and only `britemgrp.dat` was left untouched.
 *
 * So the version in the header picks the candidates and the file itself picks
 * between them -- a correctly decrypted block always begins `00 00 00 <size>`,
 * which a wrong key satisfies about once in sixteen million.
 */
import fs from "node:fs";
import zlib from "node:zlib";

const HEADER_BYTES = 28;
const BLOCK_BYTES = 128;

interface RsaKey {
  name: string;
  modulus: bigint;
  exponent: bigint;
}

const KEYS: Record<number, RsaKey[]> = {
  413: [
    {
      name: "ncsoft-413",
      modulus: BigInt(
        "0x97df398472ddf737ef0a0cd17e8d172f0fef1661a38a8ae1d6e829bc1c6e4c3c" +
          "fc19292dda9ef90175e46e7394a18850b6417d03be6eea274d3ed1dde5b5d7bd" +
          "e72cc0a0b71d03608655633881793a02c9a67d9ef2b45eb7c08d4be329083ce4" +
          "50e68f7867b6749314d40511d09bc5744551baa86a89dc38123dc1668fd72d83"
      ),
      exponent: 0x35n,
    },
    {
      name: "l2encdec",
      modulus: BigInt(
        "0x75b4d6de5c016544068a1acf125869f43d2e09fc55b8b1e289556daf9b875763" +
          "5593446288b3653da1ce91c87bb1a5c18f16323495c55d7d72c0890a83f69bfd" +
          "1fd9434eb1c02f3e4679edfa43309319070129c267c85604d87bb65bae205de3" +
          "707af1d2108881abb567c3b3d069ae67c3a4c6a3aa93d26413d4c66094ae2039"
      ),
      exponent: 0x1dn,
    },
  ],
};

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let factor = base % modulus;
  for (let rest = exponent; rest > 0n; rest >>= 1n) {
    if (rest & 1n) result = (result * factor) % modulus;
    factor = (factor * factor) % modulus;
  }
  return result;
}

function decryptBlock(block: Buffer, key: RsaKey): Buffer {
  const plain = modPow(BigInt(`0x${block.toString("hex")}`), key.exponent, key.modulus);
  // Left-padded back to the full block: the payload's offset is measured from
  // the end, so a value that happens to be a few bits short would shift it.
  return Buffer.from(plain.toString(16).padStart(BLOCK_BYTES * 2, "0"), "hex");
}

/** A block carries its length in its fourth byte, after three zeroes. */
function blockPayload(decrypted: Buffer): Buffer | undefined {
  if (decrypted[0] !== 0 || decrypted[1] !== 0 || decrypted[2] !== 0) return undefined;
  const size = decrypted[3];
  if (size > 124) return undefined;
  const start = BLOCK_BYTES - size - ((124 - size) % 4);
  return decrypted.subarray(start, start + size);
}

/**
 * Decrypts and inflates one table, returning the plain record stream.
 *
 * The last 20 bytes of every one of these files sit outside the block stream
 * and are dropped, as the client does.
 */
export function readDatFile(file: string): Buffer {
  const data = fs.readFileSync(file);
  const header = data.subarray(0, HEADER_BYTES).toString("utf16le");
  if (!header.startsWith("Lineage2Ver")) {
    throw new Error(`${file}: not a Lineage 2 table (header ${JSON.stringify(header)})`);
  }
  const version = Number(header.slice("Lineage2Ver".length));
  const candidates = KEYS[version];
  if (!candidates) {
    throw new Error(
      `${file}: version ${version} is not one this reads -- only the RSA+zlib 413 tables are, ` +
        "and only with the two keys taken from the reference client's binaries."
    );
  }

  const body = data.subarray(HEADER_BYTES);
  const blocks = Math.floor(body.length / BLOCK_BYTES);
  const key = candidates.find((candidate) =>
    blockPayload(decryptBlock(body.subarray(0, BLOCK_BYTES), candidate))
  );
  if (!key) {
    throw new Error(
      `${file}: none of the version ${version} keys fits. The client it came from was probably ` +
        "repacked with a key of its own, which its patched L2.exe would carry as a hex string."
    );
  }

  const parts: Buffer[] = [];
  for (let index = 0; index < blocks; index++) {
    const at = index * BLOCK_BYTES;
    const payload = blockPayload(decryptBlock(body.subarray(at, at + BLOCK_BYTES), key));
    if (!payload) throw new Error(`${file}: block ${index} did not decrypt with key ${key.name}`);
    parts.push(payload);
  }

  const stream = Buffer.concat(parts);
  const expected = stream.readUInt32LE(0);
  const plain = zlib.inflateSync(stream.subarray(4));
  if (plain.length !== expected) {
    throw new Error(`${file}: inflated to ${plain.length} bytes, header says ${expected}`);
  }
  return plain;
}

/**
 * A cursor over a decrypted table.
 *
 * Everything in these files is packed with no alignment, and strings are a
 * byte length followed by UTF-16 with no terminator.
 */
export class DatReader {
  private at = 0;

  constructor(private readonly data: Buffer) {}

  get offset(): number {
    return this.at;
  }

  get done(): boolean {
    return this.at >= this.data.length;
  }

  get rest(): Buffer {
    return this.data.subarray(this.at);
  }

  u16(): number {
    const value = this.data.readUInt16LE(this.at);
    this.at += 2;
    return value;
  }

  u32(): number {
    const value = this.data.readUInt32LE(this.at);
    this.at += 4;
    return value;
  }

  i32(): number {
    const value = this.data.readInt32LE(this.at);
    this.at += 4;
    return value;
  }

  string(): string {
    const bytes = this.u32();
    if (this.at + bytes > this.data.length) {
      throw new Error(`string of ${bytes} bytes at ${this.at - 4} runs past the end of the table`);
    }
    const value = this.data.subarray(this.at, this.at + bytes).toString("utf16le");
    this.at += bytes;
    return value;
  }

  /** A count followed by that many items. */
  list<T>(read: () => T): T[] {
    const count = this.u32();
    const items: T[] = [];
    for (let index = 0; index < count; index++) items.push(read());
    return items;
  }

  /** A fixed number of slots, of which the unused ones are empty strings. */
  strings(slots: number): string[] {
    const values: string[] = [];
    for (let index = 0; index < slots; index++) values.push(this.string());
    return values.filter((value) => value.length > 0);
  }

  skip(ints: number): number[] {
    const values: number[] = [];
    for (let index = 0; index < ints; index++) values.push(this.i32());
    return values;
  }
}
