import * as rsaKeys from "../keys/rsa";
import { decryptRSA } from "./decrypt-rsa";
import { decryptModulo as _decryptModulo } from "./decrypt-modulo";

const DecodersRSA: Readonly<{
    decryptEncdec: DecryptFunc_T;
}> = Object.freeze({
    decryptEncdec: decryptRSA.bind(undefined, ...rsaKeys.encdec)
});

function decryptModulo(array: Uint8Array, key: number): ArrayBuffer {
    return _decryptModulo(array, key);
}

export { decryptModulo };
export { DecodersRSA as rsa };

type DecryptFunc_T = (gmp: import("gmp-wasm").GMPLib, buffer: Uint8Array) => ArrayBuffer;