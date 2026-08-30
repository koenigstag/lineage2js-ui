function decryptModulo(array: Uint8Array, cryptKey: number): ArrayBuffer {
    for (let i = 0, len = array.length; i < len; i++)
        array[i] ^= cryptKey;

    return array.buffer as ArrayBuffer;
}

export default decryptModulo;
export { decryptModulo };