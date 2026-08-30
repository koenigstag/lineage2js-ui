// Patched for High Five (see README): upstream left this import commented out,
// so the file never compiled. G16 is the heightmap format, so we need it.
import { DataTexture, DepthFormat, UnsignedShortType } from "three";

async function decodeG16(width: number, height: number, data: Uint8Array) {
    return new DataTexture(new Uint16Array(data.buffer), width, height, DepthFormat, UnsignedShortType);
}

export default decodeG16;
export { decodeG16 };