import { decryptModulo as decryptModulo } from "../decryption/decrypt-modulo";

function encryptModulo(array: Uint8Array, key: number) {
    return decryptModulo(array, key);
}

export { encryptModulo };