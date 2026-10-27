const decoderAnsi = new TextDecoder("windows-1252");
const decoderUTF16 = new TextDecoder("utf-16le");

class FString implements IConstructable {
    public value: string;

    public load(pkg: C.APackage): this {
        const bufLen = pkg.read("compat32");
        const isUnicode = bufLen < 0;
        const byteLength = isUnicode ? -bufLen * 2 : bufLen;

        if (byteLength === 0) {
            this.value = "";

            return this;
        }

        const buf = pkg.read(byteLength);
        const delimiterSize = isUnicode ? 2 : 1;
        const bytes = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength - delimiterSize);

        this.value = (isUnicode ? decoderUTF16 : decoderAnsi).decode(bytes);

        return this;
    }
}

export default FString;
export { FString };
