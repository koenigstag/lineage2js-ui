/**
 * Writing an 8-bit greyscale PNG, by hand.
 *
 * The converters here produce raw `.bin` for anything the UI reads on the CPU
 * (the heightmap, the geodata tiles), and let umodel write the PNGs for art.
 * A baked light map is neither: the UI uploads it straight to a texture, so a
 * format the browser decodes for itself saves a DataTexture and the width and
 * height that would have to travel beside a raw buffer -- and deflate takes a
 * smooth intensity field down to a fraction of its 64kB. The other reason is
 * plainer: a PNG can be opened and looked at, which is how you tell a shadow
 * map from a mistake.
 *
 * Fifty lines rather than a dependency, and `zlib` is already in node. The
 * CRC is implemented here because `zlib.crc32` is newer than this package's
 * `@types/node`, and a typecheck failure is a worse trade than a table.
 */
import zlib from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let index = 0; index < data.length; index++) c = CRC_TABLE[(c ^ data[index]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(type, 4, "ascii");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
}

/**
 * One byte per pixel, row-major, into a greyscale PNG of the same size.
 *
 * Rows are filtered with Up (each byte minus the one above it), which costs a
 * subtraction and is what turns a smooth field into mostly zeroes for deflate.
 */
export function grayPng(width: number, height: number, pixels: Uint8Array): Buffer {
  if (pixels.length !== width * height) {
    throw new Error(`grayPng: ${pixels.length} bytes for ${width}x${height}`);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // colour type: greyscale
  header[10] = 0; // deflate
  header[11] = 0; // adaptive filtering
  header[12] = 0; // no interlace

  const raw = Buffer.alloc(height * (width + 1));
  for (let y = 0; y < height; y++) {
    const at = y * (width + 1);
    raw[at] = 2; // filter: Up
    for (let x = 0; x < width; x++) {
      const here = pixels[y * width + x];
      const above = y > 0 ? pixels[(y - 1) * width + x] : 0;
      raw[at + 1 + x] = (here - above) & 0xff;
    }
  }

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
