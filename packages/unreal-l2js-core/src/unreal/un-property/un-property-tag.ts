class PropertyTag {
    protected constructor() { }

    public name: string;
    public type: UNP_PropertyTypes;
    public structName: string;
    public arrayIndex: number;
    public dataSize: number;
    public boolValue: boolean;
    public enumName: string;

    // Configurable object pool to reduce allocations
    private static pool: PropertyTag[] = [];
    private static poolSize = 0;
    private static maxPoolSize = 10000; // Configurable pool size

    // Configure pool size (call before loading packages)
    static setMaxPoolSize(size: number): void {
        PropertyTag.maxPoolSize = Math.max(0, size);
        // Trim pool if shrinking
        if (PropertyTag.poolSize > PropertyTag.maxPoolSize) {
            PropertyTag.pool.length = PropertyTag.maxPoolSize;
            PropertyTag.poolSize = PropertyTag.maxPoolSize;
        }
    }

    static getMaxPoolSize(): number {
        return PropertyTag.maxPoolSize;
    }

    static from(pkg: C.APackage, offset: number): PropertyTag {
        // Try to get from pool first
        let tag: PropertyTag;
        if (PropertyTag.poolSize > 0) {
            tag = PropertyTag.pool[--PropertyTag.poolSize];
        } else {
            tag = new PropertyTag();
        }

        return tag.load(pkg, offset);
    }

    // Return to pool when done (call this after using the tag)
    release(): void {
        // Reset fields for reuse
        this.name = undefined;
        this.type = undefined;
        this.structName = undefined;
        this.arrayIndex = 0;
        this.dataSize = 0;
        this.boolValue = false;
        this.enumName = undefined;

        if (PropertyTag.poolSize < PropertyTag.maxPoolSize) {
            PropertyTag.pool[PropertyTag.poolSize++] = this;
        }
    }

    public isValid() { return this.name && this.name !== "None"; }

    protected load(pkg: C.APackage, offset: number) {
        pkg.seek(offset, "set");

        const nameIndex = pkg.read("compat32") as number;

        const propName = nameIndex >= 0 && nameIndex < pkg.nameTable.length
            ? pkg.nameTable[nameIndex].name
            : "None";

        this.name = propName;

        if (propName === "None") return this;

        const info = pkg.read("int8") as number;
        const isArray = (info & UNP_PropertyMasks.PROPERTY_ARRAY_MASK) !== 0;
        this.type = info & UNP_PropertyMasks.PROPERTY_TYPE_MASK;

        if (this.type === UNP_PropertyTypes.UNP_StructProperty) {
            const structNameIndex = pkg.read("compat32") as number;
            this.structName = pkg.nameTable[structNameIndex].name;
        }



        switch (info & UNP_PropertyMasks.PROPERTY_SIZE_MASK) {
            case UNP_DataTypeSizes.StaticSize1: this.dataSize = 1; break;
            case UNP_DataTypeSizes.StaticSize2: this.dataSize = 2; break;
            case UNP_DataTypeSizes.StaticSize4: this.dataSize = 4; break;
            case UNP_DataTypeSizes.StaticSize12: this.dataSize = 12; break;
            case UNP_DataTypeSizes.StaticSize16: this.dataSize = 16; break;
            case UNP_DataTypeSizes.DynamicSizeUint8: this.dataSize = pkg.read("uint8"); break;
            case UNP_DataTypeSizes.DynamicSizeUint16: this.dataSize = pkg.read("uint16"); break;
            case UNP_DataTypeSizes.DynamicSizeUint32: this.dataSize = pkg.read("uint32"); break;
        }

        this.arrayIndex = 0;

        if (isArray && this.type !== UNP_PropertyTypes.UNP_BoolProperty) {
            const b = pkg.read("int8") as number;

            if (b < 0x80) {
                this.arrayIndex = b;
            } else {
                const b2 = pkg.read("int8") as number;

                if (b & 0x40) { // really, (b & 0xC0) == 0xC0
                    const b3 = pkg.read("int8") as number;
                    const b4 = pkg.read("int8") as number;
                    this.arrayIndex = ((b << 24) | (b2 << 16) | (b3 << 8) | b4) & 0x3FFFFF;
                } else this.arrayIndex = ((b << 8) | b2) & 0x3FFF;
            }
        }

        this.boolValue = this.type === UNP_PropertyTypes.UNP_BoolProperty ? isArray : false;

        return this;
    }

    public getTypeName() { return getPropertyTypeName(this.type); }

    public toString() {
        if (this.name === "None")
            return `PropertyTag[None]`;
        return `PropertyTag<${this.getTypeName()}${this.type === UNP_PropertyTypes.UNP_StructProperty ? `<${this.structName}>` : ""}>[${this.name}](size=${this.dataSize})`;
    }
}

function getPropertyTypeName(type: UNP_PropertyTypes) {
    switch (type) {
        case UNP_PropertyTypes.UNP_ByteProperty: return "Byte";
        case UNP_PropertyTypes.UNP_IntProperty: return "Int";
        case UNP_PropertyTypes.UNP_BoolProperty: return "Bool";
        case UNP_PropertyTypes.UNP_FloatProperty: return "Float";
        case UNP_PropertyTypes.UNP_ObjectProperty: return "Object";
        case UNP_PropertyTypes.UNP_NameProperty: return "Name";
        case UNP_PropertyTypes.UNP_StrProperty: return "Str";
        case UNP_PropertyTypes.UNP_StringProperty: return "String";
        case UNP_PropertyTypes.UNP_ArrayProperty: return "Array";
        case UNP_PropertyTypes.UNP_ClassProperty: return "Class";
        case UNP_PropertyTypes.UNP_VectorProperty: return "Vector";
        case UNP_PropertyTypes.UNP_RotatorProperty: return "Rotator";
        case UNP_PropertyTypes.UNP_MapProperty: return "Map";
        case UNP_PropertyTypes.UNP_FixedArrayProperty: return "FixedArray";
        case UNP_PropertyTypes.UNP_StructProperty: return "Struct";
        default: throw new Error(`Unknwon tag type ${type}`);
    }
}

enum UNP_PropertyTypes {
    UNP_ByteProperty /*      */ = 0x1,
    UNP_IntProperty /*       */ = 0x2,
    UNP_BoolProperty /*      */ = 0x3,
    UNP_FloatProperty /*     */ = 0x4,
    UNP_ObjectProperty /*    */ = 0x5,
    UNP_NameProperty /*      */ = 0x6,
    UNP_StringProperty /*    */ = 0x7,
    UNP_ClassProperty /*     */ = 0x8,
    UNP_ArrayProperty /*     */ = 0x9,
    UNP_StructProperty /*    */ = 0xA,
    UNP_VectorProperty /*    */ = 0xB,
    UNP_RotatorProperty /*   */ = 0xC,
    UNP_StrProperty /*       */ = 0xD,
    UNP_MapProperty /*       */ = 0xE,
    UNP_FixedArrayProperty /**/ = 0xF
};

enum UNP_PropertyMasks {
    PROPERTY_TYPE_MASK /* */ = 0x0F,
    PROPERTY_SIZE_MASK /* */ = 0x70,
    PROPERTY_ARRAY_MASK /**/ = 0x80
};

enum UNP_DataTypeSizes {
    StaticSize1 = 0x00,
    StaticSize2 = 0x10,
    StaticSize4 = 0x20,
    StaticSize12 = 0x30,
    StaticSize16 = 0x40,
    DynamicSizeUint8 = 0x50,
    DynamicSizeUint16 = 0x60,
    DynamicSizeUint32 = 0x70,
};

export default PropertyTag;
export { PropertyTag, UNP_PropertyTypes, UNP_PropertyMasks, UNP_DataTypeSizes, getPropertyTypeName };