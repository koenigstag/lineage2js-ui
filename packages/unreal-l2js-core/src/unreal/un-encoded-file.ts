import BufferValue from "../buffer-value";
import * as decoders from "../crypto/decryption/decoders";
import * as _gmp from "gmp-wasm";
import * as modKeys from "../crypto/keys/modulo";

let gmp: _gmp.GMPLib = null;

const decoderUTF16 = new TextDecoder("utf-16");

interface IEncodedFile {
    read(target: number | "guid"): DataView<ArrayBuffer>;
    read(target: "char" | "utf16"): string;
    read<T extends C.PrimitiveNumberTypes_T | "compat32">(target: T): number;
    read<T extends C.BigNumberTypes_T>(target: T): bigint;
    read<T extends C.ValueTypeNames_T>(target: BufferValue<T>): BufferValue<T>;
};

const numberTypes = [
    "int64", "uint64",
    "float",
    "compat32",
    "int32", "uint32",
    "int8", "uint8",
    "int16", "uint16",
    "guid", "char", "utf16"
] as const;

type InstancedTypes = C.NumberTypes_T | "guid" | "char" | "utf16";
const buffInstances: Record<InstancedTypes, BufferValue<InstancedTypes>> = numberTypes.reduce((acc, t) => {
    acc[t] = new BufferValue(BufferValue[t]);
    return acc;
}, {} as any);


// const instances: Record<C.NumberTypes_T, BufferValue<any>> = {
//     compat32: new BufferValue(BufferValue.compat32)
// }



abstract class UEncodedFile implements IEncodedFile {
    public readonly path: string;
    public readonly isReadable = false;

    protected moduloCryptKey: number;
    protected signature: number;

    protected handle: this = null;
    protected promiseDecoding: Promise<BufferValue>;
    protected buffer: ArrayBuffer = null;
    protected offset = 0;
    protected contentOffset = 0;
    protected version: string;

    constructor(path: string) {
        this.path = path;
    }

    public free() {
        this.signature = undefined;
        this.moduloCryptKey = undefined;
        this.version = undefined;
        this.offset = 0;
        this.contentOffset = 0;
        this.buffer = null;
        this.promiseDecoding = null;
    }

    public asReadable(): this {

        // if (this.isReadable)
        //     throw new Error("Already readable!");

        const readable = new class Readable { }

        Object.setPrototypeOf(readable, this);
        Object.assign(readable, this, { isReadable: true, handle: this });

        return readable as this;
    }

    public ensureReadable() {
        if (!this.isReadable)
            throw new Error("Stream is not readable!");
    }

    public seek(offset: number, origin: C.Seek_T = "current") {
        this.ensureReadable();

        switch (origin) {
            case "current": this.offset = this.offset + offset; break;
            case "set": this.offset = offset + this.contentOffset; break;
            default: throw new Error(`Seek type not supported: ${origin}`);
        }
    }

    public readPrimitive(byteOffset: number, byteLength: number) {
        return new DataView(this.buffer, byteOffset + this.contentOffset, byteLength)
    }

    public read(target: number | "guid"): DataView<ArrayBuffer>;
    public read(target: "char" | "utf16"): string;
    public read<T extends C.PrimitiveNumberTypes_T | "compat32">(target: T): number;
    public read<T extends C.BigNumberTypes_T>(target: T): bigint;
    public read<T extends C.ValueTypeNames_T>(target: BufferValue<T>): BufferValue<T>;

    public read(target: any) {
        this.ensureReadable();

        if (target in buffInstances) {
            target = buffInstances[target as C.NumberTypes_T | "guid"];

            this.offset += target.readValue(this.buffer, this.offset);

            return target.value;

        } else if (typeof target === "number") {
            const _target = BufferValue.allocBytes(target);

            this.offset += _target.readValue(this.buffer, this.offset);

            return _target.value;
        } else if (target instanceof BufferValue) {
            this.offset += target.readValue(this.buffer, this.offset);

            return target;
        } else {
            throw new Error("Invalid argument");
        }
    }

    public tell() { return this.offset - this.contentOffset; }

    public dump(lineCount: number = 1, restore: boolean = true, printHeaders: boolean = true) {
        this.ensureReadable();

        let oldHeader = this.offset;
        let constructedString = "";
        let divisor = 0XF, lineCountHex = 1;
        const buff = BufferValue.allocBytes(2);

        do {
            if ((lineCount / divisor) < 1) break;
            divisor = divisor * 0X10 + 0XF; // shift divisor
            lineCountHex++;
        } while (true);

        const offsetHeader = printHeaders ? new Array(5 + lineCountHex).fill("-").join("") : null;

        if (printHeaders) {
            console.log(`${offsetHeader}--------------------------------------------------------`);
            console.log(`${offsetHeader}------------------- Dumping lines ----------------------`);
            console.log(`${offsetHeader}--------------------------------------------------------`);
        }

        for (let i = 0; i < lineCount; i++) {
            const bytes = Math.min(this.buffer.byteLength - this.offset, 8);
            const groups = new Array(bytes).fill('.').map(() => this.read(buff));

            const string1 = groups.map(g => g.hex.slice(2)).join(" ");
            const string2 = groups.map(g => g.string).join("");

            constructedString += string2;
            constructedString = constructedString.slice(-100);

            if (lineCount <= 256) {
                if (true || string1.match(/(^0005)|(^0077)|(^0007)/)) {

                    const extraArgs: any[] = [];

                    let finalString = string1;

                    const bits = i.toString(16).toUpperCase();
                    const head = new Array(lineCountHex - bits.length).fill("0").join("");

                    console.log(
                        [
                            `(0x${head}${bits})`,
                            finalString,
                            string2,
                        ].join(" "),
                        ...extraArgs
                    );
                } else {
                    console.log(
                        string1,
                        string2
                    );
                }
            }
        }

        if (printHeaders)
            console.log(`${offsetHeader}--------------------------------------------------------`);

        if (restore) this.offset = oldHeader;
    }

    public async decode(): Promise<this> {
        if (this.buffer) return this;
        if (!this.promiseDecoding) await this._doDecode();
        else await this.promiseDecoding;

        return this;
    }

    protected abstract readArrayBuffer(): Promise<ArrayBuffer>;

    protected _doDecode(): Promise<BufferValue> {
        this.ensureReadable();

        if (this.promiseDecoding) return this.promiseDecoding;

        // console.log(`%cStarted loading package: %c${this.path}`, "color: blue", "color: gray");

        // async IIFE because a throw inside new Promise(async resolve => ...) never rejects, it just hangs
        return this.handle.promiseDecoding = this.promiseDecoding = (async () => {
            this.buffer = await this.readArrayBuffer();

            const signature = this.read(new BufferValue(BufferValue.uint32));
            const HEADER_SIZE = 28;
            const HEADER_VER_OFFSET = 22;

            if (signature.value === 0x0069004C) {
                this.seek(HEADER_VER_OFFSET, "set");

                const vv = this.read(6);
                const version = decoderUTF16.decode(vv);

                this.seek(HEADER_SIZE, "set");

                let tStart;

                this.version = version;

                if (version.startsWith("1")) {

                    if (this.version === "111") {
                        this.moduloCryptKey = modKeys.modulo111;
                    } else {
                        this.moduloCryptKey = (this.read("uint8") as number) ^ modKeys.modulo121;
                    }

                    this.contentOffset = HEADER_SIZE;
                    this.seek(0, "set");

                    tStart = performance.now();

                    this.buffer = decoders.decryptModulo(new Uint8Array(this.buffer, HEADER_SIZE), this.moduloCryptKey);

                    this.read(signature);
                } else if (version.startsWith("4")) {
                    if (gmp === null) {
                        gmp = await _gmp.init();
                    }

                    this.buffer = decoders.rsa.decryptEncdec(gmp, new Uint8Array(this.buffer, HEADER_SIZE));
                    this.contentOffset = 0;
                    this.seek(0, "set");

                } else {
                    throw new Error(`Unsupported file version: ${version}`)
                }

                const size = this.buffer.byteLength;
                let sizeString: string;

                if (size >= szGB) sizeString = `${(size / szGB).toFixed(2)}GB`;
                else if (size >= szMB) sizeString = `${(size / szMB).toFixed(2)}MB`;
                else if (size >= szKB) sizeString = `${(size / szKB).toFixed(2)}kB`;
                else sizeString = `${size.toFixed(2)}B`;

                // if (size > 1024 * 1024)
                //     console.log(`'${this.path}' loaded in ${(performance.now() - tStart).toFixed(3)} ms (${sizeString})`);

                this.signature = signature.value;
                return signature;
            } else {
                // no encoding
                this.contentOffset = 0;
                this.signature = signature.value;

                return signature;
            }

        })();
    }

    public abstract toBuffer(): ArrayBuffer;
}

export default UEncodedFile;
export { UEncodedFile };

const szKB = 1024, szMB = szKB * 1024, szGB = szMB * 1024;