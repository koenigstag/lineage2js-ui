import BufferValue from "../buffer-value";
import UExport from "./un-export";
import FArrayPrimitive from "./un-array-primitive";

class FArray<T extends C.UObject | FArrayPrimitive<C.NumberTypes_T | C.StringTypes_T> | IConstructable> extends Array<T> implements IConstructable {
    declare ["constructor"]: typeof FArray;

    protected Constructor: { new(...pars: any): T };

    public getElemCount() { return this.length; }
    public getElem(idx: number): T { return this[idx]; }
    public getConstructor() { return this.Constructor; }

    public constructor(constr: { new(...pars: any): T }, len = 0) {
        super(len);

        if (!constr)
            debugger;

        this.Constructor = constr;
    }

    public map<T2>(fnMap: (value: T, index: number, array: T[]) => T2): T2[] { return [...this].map(fnMap); }

    public load(pkg: C.APackage, tag?: C.PropertyTag): this {
        const hasTag = tag !== null && tag !== undefined;
        const beginIndex = hasTag ? pkg.tell() : null;
        const count = pkg.read("compat32");

        this.length = count;

        if (count === 0) return this;

        const headerSize = hasTag ? pkg.tell() - beginIndex : null;
        const dataBytes = hasTag ? tag.dataSize - headerSize : null;
        const isFixedSize = hasTag ? (dataBytes % this.length) === 0 : false;
        const elementSize = isFixedSize ? dataBytes / this.length : null;

        for (let i = 0, len = this.length; i < len; i++) {
            const exp = hasTag ? (function () {
                const exp = new UExport();

                const elementOffset = pkg.tell();

                exp.index = -1;  // Fake exports don't have a real index
                exp.idClass = 0;
                exp.idSuper = 0;
                exp.idPackage = pkg.getActiveObjectRef();
                exp.idObjectName = 0;
                exp.objectName = `${tag.name}[${i + 1}/${count}]`;
                exp.flags = 0;
                exp.offset = elementOffset;
                exp.size = isFixedSize ? elementSize : tag.dataSize - (elementOffset - beginIndex);
                exp.isFake = true;

                return exp;
            })() : null;

            this[i] = new (this.Constructor as any)().load(pkg, exp);
        }

        if (hasTag) console.assert((pkg.tell() - beginIndex - tag.dataSize) === 0);

        return this;
    }

    public copy(other: FArray<T>): this {
        if (!other)
            debugger;

        if (!other)
            return this;

        this.Constructor = other.Constructor;

        for (const v of other)
            this.push(v);

        return this;
    }

    public nativeClone(): FArray<T> { return new this.constructor(this.Constructor).copy(this); }
    public toString() {
        return `Array<${this.Constructor?.name ?? undefined}>(len=${this.getElemCount()}, ...)`;
    }
}

class FArrayLazy<T extends C.UObject | FArrayPrimitive<C.NumberTypes_T | C.StringTypes_T> | IConstructable> extends FArray<T> {
    protected posBegin: number;
    protected posEnd: number;
    protected isLoaded: boolean = false;

    protected pkg: C.APackage;
    protected tag?: C.PropertyTag


    public get size() { return this.posEnd - this.posBegin; }



    public getElem(idx: number): T {
        if (!this.isLoaded) {
            const offset = this.pkg.tell(); // in case we fuck up the cursor when it's reading

            this.pkg.seek(this.posBegin, "set");

            super.load(this.pkg, this.tag);

            this.pkg.seek(offset, "set"); // move cursor back to
            this.isLoaded = true;
        }

        return super.getElem(idx);
    }

    public load(pkg: C.APackage, tag?: C.PropertyTag): this {
        this.pkg = pkg;
        this.tag = tag;

        this.posEnd = pkg.read("int32") as number;
        this.posBegin = pkg.tell();
        this.length = pkg.read("compat32");

        pkg.seek(this.posEnd, "set");

        // super.load(pkg, tag);

        console.assert((pkg.tell() - this.posEnd) === 0);

        return this;
    }

    public copy(other: FArrayLazy<T>): this {
        if (!other)
            return this;

        this.posEnd = other.posEnd;

        return this;
    }

    public toString() {
        return `ArrayLazy<${this.Constructor?.name ?? undefined}>(len=${this.getElemCount()}, bytes=${this.size}, ready=${this.isLoaded}, ...)`;
    }
}

class FIndexArray extends FArray<FArrayPrimitive<"compat32">> {
    public constructor(len = 0) {
        super(FArrayPrimitive.forType(BufferValue.compat32), len);
    }

    public static loadOfSize(pkg: C.APackage, size: number): FIndexArray {
        const indexArray = new FIndexArray();
        const Constructor = FArrayPrimitive.forType(BufferValue.compat32);

        for (let i = 0; i < size; i++)
            indexArray.push(new Constructor().load(pkg));

        return indexArray;
    }

    public toString() {
        return `IndexArray(len=${this.getElemCount()}, ...)`;
    }
}

class FStringArray extends FArray<FArrayPrimitive<"char">> {
    public constructor(len = 0) {
        super(FArrayPrimitive.forType(BufferValue.char), len);
    }

    public toString() {
        return `StringArray(len=${this.getElemCount()}, ...)`;
    }
}

class FObjectArray<T extends C.UObject = C.UObject> extends Array<T> implements IConstructable {
    protected indexArray = new FIndexArray();

    public static loadOfIndex<T extends C.UObject = C.UObject>(indexArray: FIndexArray, pkg: C.APackage, tag?: C.PropertyTag): FObjectArray<T> {
        const objectArray = new FObjectArray<T>();
        objectArray.indexArray = indexArray;

        let i = 0;
        for (const index of indexArray)
            objectArray[i++] = pkg.fetchObject<T>(index.value);

        return objectArray;
    }

    public static loadOfSize<T extends C.UObject = C.UObject>(size: number, pkg: C.APackage, tag?: C.PropertyTag): FObjectArray<T> {
        const objectArray = new FObjectArray<T>();
        objectArray.indexArray = FIndexArray.loadOfSize(pkg, size);

        let i = 0;
        for (const index of objectArray.indexArray)
            objectArray[i++] = pkg.fetchObject<T>(index.value);

        return objectArray;
    }

    public load(pkg: C.APackage, tag?: C.PropertyTag): this {
        this.indexArray.load(pkg, tag);

        let i = 0;

        for (const index of this.indexArray)
            this[i++] = pkg.fetchObject<T>(index.value);

        return this;
    }

    public getIndexList(): number[] { return this.indexArray.map(v => v.value); }

    public loadSelf(): this {
        for (const obj of this)
            obj?.loadSelf(); // null elements are legal - deleted objects serialize as None

        return this;
    }

    public copy(other: FObjectArray<T>): this {
        if (!other)
            return this;

        this.indexArray = other.indexArray;

        for (const v of other)
            this.push(v);

        return this;
    }

    public nativeClone(): FObjectArray<T> { return new FObjectArray<T>().copy(this); }
    public getElemCount() { return this.length; }
    public toString() {
        return `ObjectArray(len=${this.getElemCount()}, ...)`;
    }
}

class FNameArray extends Array<string> implements IConstructable {

    protected indexArray = new FIndexArray();

    public load(pkg: C.APackage, tag?: C.PropertyTag): this {
        this.indexArray.load(pkg, tag);

        let i = 0;

        for (const index of this.indexArray)
            this[i++] = pkg.nameTable[index.value].name;

        return this;
    }

    public loadSelf(): this { return this; }

    public copy(other: FNameArray): this {
        if (!other)
            return this;

        this.indexArray = other.indexArray;

        for (const v of other)
            this.push(v);

        return this;
    }

    public nativeClone(): FNameArray { return new FNameArray().copy(this); }
    public getElemCount() { return this.length; }

    public toString() {
        return `NameArray(len=${this.getElemCount()}, ...)`;
    }
}

class FPrimitiveArray<T extends C.AllPrimitiveNumberTypes_T> implements IConstructable {
    declare ["constructor"]: typeof FPrimitiveArray;

    protected array = new DataView(new ArrayBuffer(0));
    protected Constructor: C.ValidTypes_T<T>;

    public toString() {
        return `PrimitiveArray<${this.Constructor?.name ?? undefined}>(len=${this.getElemCount()}, ...)`;
    }

    public getElemCount() { return this.array ? this.array.byteLength / this.Constructor.bytes : 0; }
    public getElem(idx: number): number {
        let funName: string = null;

        switch (this.Constructor.name) {
            case "int64": funName = "getBigInt64"; break;
            case "uint64": funName = "getBigUint64"; break;
            case "int32":
                funName = "getInt32";
                break;
            case "float": funName = "getFloat32"; break;
            case "uint32": funName = "getUint32"; break;
            case "int8": funName = "getInt8"; break;
            case "uint8": funName = "getUint8"; break;
            case "int16": funName = "getInt16"; break;
            case "uint16": funName = "getUint16"; break;
            default: throw new Error(`Unknown type: ${this.Constructor.name}`);
        }

        return (this.array as any)[funName](idx * this.Constructor.bytes, true);

    }

    public constructor(constr: C.ValidTypes_T<T>) { this.Constructor = constr; }

    public *iter(): Generator<number, null, unknown> {
        for (let i = 0, len = this.getElemCount(); i < len; i++)
            yield this.getElem(i);

        return null;
    }

    public map<T>(fnMap: (value: any, index: number, array: any[]) => T): T[] { return [...(this as any as Array<T>)].map(fnMap); }

    public load(pkg: C.APackage, tag?: C.PropertyTag): this {
        const hasTag = tag !== null && tag !== undefined;
        const beginIndex = hasTag ? pkg.tell() : null;
        const elementCount = pkg.read("compat32") as number;

        if (elementCount === 0) {
            this.array = new DataView(new ArrayBuffer(0));
            return this;
        }

        const byteLength = elementCount * this.Constructor.bytes;

        this.array = pkg.readPrimitive(pkg.tell(), byteLength);

        pkg.seek(byteLength);

        if (hasTag && (pkg.tell() - beginIndex - tag.dataSize) !== 0) debugger;
        if (hasTag) console.assert((pkg.tell() - beginIndex - tag.dataSize) === 0);

        return this;
    }

    public getArrayBufferSlice() {
        // throw new Error("not implemented")
        // return this.array.buffer.slice(0, 0);
        return this.array.buffer.slice(this.array.byteOffset, this.array.byteOffset + this.getByteLength());
    }

    public getTypedArray(): ReturnType<T> {
        try {
            return new (this.Constructor.dtype as any)(this.array.buffer, this.array.byteOffset, this.getElemCount()) as any;
        } catch (e) {
            if (e.message.includes("should be a multiple of"))
                return new this.Constructor.dtype(this.getArrayBufferSlice()) as any;

            throw e;
        }
    }

    public getByteLength() { return this.array.byteLength; }

    public nativeClone() { return new this.constructor(this.Constructor).copy(this); }
    public copy(other: FPrimitiveArray<T>): this {
        if (!other)
            return this;

        this.array = new DataView(other.array.buffer, other.array.byteOffset, other.array.byteLength);

        return this;
    }
}

type ReturnType<T extends C.PrimitiveNumberTypes_T | C.BigNumberTypes_T> =
    | T extends "uint8" ? Uint8Array
    : T extends "int8" ? Int8Array
    : T extends "uint16" ? Uint16Array
    : T extends "int16" ? Int16Array
    : T extends "uint32" ? Uint32Array
    : T extends "int32" ? Int32Array
    : T extends "uint64" ? BigUint64Array
    : T extends "int64" ? BigInt64Array
    : never;

class FPrimitiveArrayLazy<T extends C.PrimitiveNumberTypes_T | C.BigNumberTypes_T> extends FPrimitiveArray<T> {
    public unkLazyInt: number;

    public load(pkg: C.APackage, tag?: C.PropertyTag): this {

        this.unkLazyInt = pkg.read("int32") as number;

        super.load(pkg, tag);

        console.assert((pkg.tell() - this.unkLazyInt) === 0);

        return this;
    }

    public copy(other: FPrimitiveArrayLazy<T>): this {
        if (!other)
            return this;

        super.copy(other);
        this.unkLazyInt = other.unkLazyInt;

        return this;
    }

    public toString() {
        return `PrimitiveArrayLazy<${this.Constructor?.name ?? undefined}>(len=${this.getElemCount()}, ...)`;
    }
}

// Symbol.species stays Array so map/filter results don't leak FArray through structured clone, defineProperty because an in-class accessor trips TS2611
for (const ArrayClass of [FArray, FObjectArray, FNameArray])
    Object.defineProperty(ArrayClass, Symbol.species, { value: Array });

export default FArray;
export { FArray, FArrayLazy, FIndexArray, FStringArray, FNameArray, FPrimitiveArray, FObjectArray, FPrimitiveArrayLazy };