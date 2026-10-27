import BufferValue from "../../buffer-value";
import { flagBitsToDict } from "../../utils/flags";
import FArray, { FNameArray, FObjectArray, FPrimitiveArray } from "../un-array";
import UClass from "../un-class";
import UField from "../un-field";
import UObject from "../un-object";
import APackage from "../un-package";
import PropertyTag, { UNP_PropertyTypes, getPropertyTypeName } from "./un-property-tag";
import UExport from "src/unreal/un-export";

type PropertyConstructorParams_T = PropertyExtraPars_T & {
    propertyName?: string,
    pkg?: C.APackage
};

type ExportPropertyConstructorParams_T = PropertyExtraPars_T & {
    propertyName?: string,
    pkg?: C.APackage,
    valueId?: number
};

abstract class UProperty<T1 = any, T2 = T1> extends UField {
    public abstract readonly type: UNP_PropertyTypes;

    public arrayDimensions: number;
    public flagNames: C.FlagDict<EnumKeys.PropertyFlags_T>;
    public propertyName: string;

    protected flags: number;
    protected replicationOffset: number;
    protected categoryNameId: number;
    protected categoryName: string;
    protected reader: T1;

    public getTypeName() { return getPropertyTypeName(this.type); }

    public constructor(
        {
            arrayDimensions = 1,
            flags = 0,
            categoryNameId = 0,
            categoryName = "None",
            pkg = null,
            propertyName = "None"
        }: PropertyConstructorParams_T = {} as PropertyConstructorParams_T
    ) {
        super();

        this.pkg = pkg;
        this.arrayDimensions = arrayDimensions;
        this.flags = flags;

        this.flagNames = flagBitsToDict(this.flags, PropertyFlags_T);
        this.propertyName = propertyName;

        this.categoryNameId = categoryNameId;
        this.categoryName = categoryName
        this.reader = this.makeReader();
    }

    protected doLoad(pkg: APackage, exp: C.UExport): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        this.arrayDimensions = pkg.read("uint32");
        this.flags = pkg.read("uint32");
        this.flagNames = flagBitsToDict(this.flags, PropertyFlags_T);

        this.categoryNameId = pkg.read("compat32");
        this.categoryName = pkg.nameTable[this.categoryNameId].name;

        if (this.flags & PropertyFlags_T.CPF_Net)
            this.replicationOffset = pkg.read("uint16");

        this.readHead = pkg.tell();
    }

    public copy(other: UProperty<T1, T2>) {
        if (this.constructor.name !== other.constructor.name)
            throw new Error("Invalid constructor");

        this.isReady = other.isReady;
        this.isLoading = other.isLoading;

        this.arrayDimensions = other.arrayDimensions;
        this.flags = other.flags;

        this.flagNames = other.flagNames;
        this.categoryNameId = other.categoryNameId;
        this.categoryName = other.categoryName;
        this.replicationOffset = other.replicationOffset;

        this.propertyName = this.propertyName;

        this.pkg = other.pkg;
        this.exp = other.exp;

        return this;
    }

    protected abstract makeReader(): T1;
    public abstract readValue(pkg: APackage, tag: PropertyTag): T2;

    protected abstract makeDefaultValue(): T2;
    public getDefaultValue(): T2 | T2[] {
        console.assert(this.arrayDimensions >= 1, `Invalid array dimensions: ${this.arrayDimensions}`);

        if (this.arrayDimensions === 1)
            return this.makeDefaultValue();

        return new Array<T2>(this.arrayDimensions).fill(this.makeDefaultValue());
    }

    public readProperty(pkg: APackage, tag: PropertyTag, propertyDict: Map<string, any>) {
        const value = this.readValue(pkg, tag);

        console.assert(this.arrayDimensions >= 1, `Invalid array dimensions: ${this.arrayDimensions}`);

        if (this.arrayDimensions === 1) propertyDict.set(tag.name, value);
        else propertyDict.get(tag.name)[tag.arrayIndex] = value;

        return this;
    }

    public nativeClone(): any {
        const Constructor = this.constructor as any as new () => UProperty<T1, T2>;
        const clone = new Constructor();

        clone.copy(this);

        return clone as any;
    }

    protected preLoad(pkg: APackage, exp: UExport<UObject>): void {
        this.propertyName = exp.objectName;
        super.preLoad(pkg, exp);
    }

    public toJSON() { throw new Error("Not implemented message."); }

    public toString(className: string, classTemplate: string) {
        return `${className}${classTemplate ? `<${classTemplate}>` : ""}${this.arrayDimensions > 1 ? `[${this.arrayDimensions}]` : ""}(name=${this.propertyName})`;
    }
}

abstract class UBaseExportProperty<T1 extends UObject, T2 = T1, T3 = T2> extends UProperty<T2, T3> {
    public valueId: number;
    public _value: C.UStruct;

    constructor({ valueId = 0 } = {} as ExportPropertyConstructorParams_T) {
        super(...arguments);

        this.valueId = valueId;
    }

    public get value() {
        if (this.valueId !== 0 && !this._value)
            this._value = this.pkg.fetchObject(this.valueId);

        return this._value;
    }

    protected doLoad(pkg: APackage, exp: C.UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.valueId = pkg.read("compat32");
        this.readHead = pkg.tell();
    }

    public copy(other: UBaseExportProperty<T1, T2, T3>): this {
        super.copy(other);

        this.valueId = other.valueId;

        return this;
    }
}

class UObjectProperty<T extends UObject = UObject> extends UBaseExportProperty<UObject, BufferValue<"compat32">, T> {
    public readonly type = UNP_PropertyTypes.UNP_ObjectProperty;

    protected makeReader(): BufferValue<"compat32"> { return new BufferValue(BufferValue.compat32); }
    public readValue(pkg: APackage): T { return pkg.fetchObject(pkg.read(this.reader).value); }
    protected makeDefaultValue(): T { return null; }

    public toString() {
        const friendlyName = this.valueId === 0 ? null : (this._value?.friendlyName || "<eval>");

        return super.toString("ObjectProperty", friendlyName);
    }
}


class UClassProperty extends UBaseExportProperty<UClass, BufferValue<"compat32">, UClass> {
    public readonly type = UNP_PropertyTypes.UNP_ClassProperty;

    protected metaClassId: number;
    protected _metaClass: UClass;

    protected makeReader(): BufferValue<"compat32"> { return new BufferValue(BufferValue.compat32); }
    public readValue(pkg: APackage): UClass { return pkg.fetchObject(pkg.read(this.reader).value); }
    protected makeDefaultValue(): UClass { return null; }

    protected doLoad(pkg: APackage, exp: C.UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.metaClassId = pkg.read("compat32");
        this.readHead = pkg.tell();
    }

    public get metaClass() {
        if (this.metaClassId !== 0 && !this._metaClass)
            this._metaClass = this.pkg.fetchObject(this.metaClassId);

        return this._value;
    }

    public copy(other: UClassProperty): this {
        super.copy(other);

        this.metaClassId = other.metaClassId;

        return this;
    }

    public toString() {
        const friendlyName = this.valueId === 0 ? null : (this._value?.friendlyName || "<eval>");

        return super.toString("ClassProperty", friendlyName);
    }
}

class UStructProperty<T extends UObject = UObject> extends UBaseExportProperty<C.UStruct, T, T> {
    public readonly type = UNP_PropertyTypes.UNP_StructProperty;

    protected makeDefaultValue(): T { return null; }
    public initializeDefault(pkgNative: C.ANativePackage): T {
        const Constructor = this.value.loadSelf().buildClass<T>(pkgNative)

        return new Constructor();
    }

    public readValue(pkg: APackage, tag: PropertyTag): T {
        const native = pkg.loader.getNativePackage();
        const verArchive = pkg.header.getArchiveFileVersion();

        const struct = this.initializeDefault(native)
        const isNative = ["Vector", "Rotator", "Color"].includes(tag?.structName || null) || verArchive < 0x76;

        struct.load(pkg, isNative ? null : tag);

        return struct;
    }

    protected makeReader(): T { return null; }

    public toString() {
        const friendlyName = this.valueId === 0 ? null : (this._value?.friendlyName || "<eval>");

        return super.toString("StructProperty", friendlyName);
    }
}

abstract class UNumericProperty<T extends C.NumberTypes_T | C.StringTypes_T> extends UProperty<BufferValue<T>, ReturnType<T>> implements IBufferValueProperty<T> {
    declare ["constructor"]: typeof UNumericProperty & { dtype: C.ValidTypes_T<T> };

    public toString() { return super.toString(this.constructor.name, undefined); }

    public readValue(pkg: APackage) { return pkg.read(this.reader).value; }
    protected makeReader() { return new BufferValue<T>(this.constructor.dtype); }
}

class UFloatProperty extends UNumericProperty<"float"> {
    public static dtype = BufferValue.float;

    public readonly type = UNP_PropertyTypes.UNP_FloatProperty;

    declare ["constructor"]: typeof UNumericProperty & typeof UFloatProperty;

    protected makeDefaultValue(): number { return 0; }
}

class UIntProperty extends UNumericProperty<"int32"> {
    public static dtype = BufferValue.int32;

    public readonly type = UNP_PropertyTypes.UNP_IntProperty;

    declare ["constructor"]: typeof UNumericProperty & typeof UIntProperty;

    protected makeDefaultValue(): number { return 0; }
}

class UStrProperty extends UProperty<BufferValue<"char">, string> {
    public readonly type = UNP_PropertyTypes.UNP_StrProperty;

    public readValue(pkg: APackage) { return pkg.read(this.reader).value; }
    protected makeReader(): BufferValue<"char"> { return new BufferValue(BufferValue.char); }
    protected makeDefaultValue(): string { return ""; }

    public toString() { return super.toString(this.constructor.name, undefined); }
}

class UDelegateProperty extends UProperty<any, any> {
    protected makeDefaultValue(): any { return null; }

    protected makeReader() {
        throw new Error("Method not implemented.");
    }
    public readValue(pkg: APackage, tag: PropertyTag) {
        throw new Error("Method not implemented.");
    }

    public readonly type: UNP_PropertyTypes = null;
}



class UBoolProperty extends UProperty<boolean, boolean> {
    public readonly type = UNP_PropertyTypes.UNP_BoolProperty;

    protected makeDefaultValue(): boolean { return false; }
    protected makeReader(): boolean { return null; }
    public readValue(pkg: APackage, tag: PropertyTag): boolean { return tag.boolValue; }

    public toString() { return super.toString("BoolProperty", undefined); }
}

class UNameProperty extends UProperty<BufferValue<"compat32">, string> {
    public readonly type = UNP_PropertyTypes.UNP_NameProperty;

    protected makeDefaultValue(): string { return "None"; }

    public readValue(pkg: APackage): string { return pkg.nameTable[pkg.read(this.reader).value].name; }
    protected makeReader(): BufferValue<"compat32"> { return new BufferValue(BufferValue.compat32); }


    public toString() { return super.toString("NameProperty", undefined); }

}

class UByteProperty extends UBaseExportProperty<C.UEnum, BufferValue<"uint8">, number> {
    declare ["constructor"]: typeof UNumericProperty & { dtype: C.ValidTypes_T<"uint8"> };

    public readonly type = UNP_PropertyTypes.UNP_ByteProperty;

    public static dtype = BufferValue.uint8;

    public readValue(pkg: APackage): number { return pkg.read(this.reader).value; }
    protected makeReader(): BufferValue<"uint8"> { return new BufferValue(BufferValue.uint8); }
    protected makeDefaultValue(): number { return 0; }

    public toString() {
        if (!this.valueId)
            return super.toString("ByteProperty", undefined);

        if (!this._value) {
            if (this.arrayDimensions > 1)
                return super.toString("ByteProperty", "<eval>");

            return super.toString("ByteProperty", "<eval>");
        }

        const name = this._value.friendlyName;

        return super.toString("ByteProperty", name);
    }
}

type ArrayType = FArray<any> | FPrimitiveArray<any> | FObjectArray<any> | FNameArray;

class UArrayProperty extends UBaseExportProperty<UProperty<ArrayType, ArrayType>, ArrayType, ArrayType> {
    public readonly type = UNP_PropertyTypes.UNP_ArrayProperty;

    protected makeReader(): ArrayType { return null; }
    protected makeDefaultValue(): ArrayType { return null; }

    public readValue(pkg: APackage, tag: PropertyTag): ArrayType {
        if (this.arrayDimensions !== 1 || tag.arrayIndex !== 0)
            debugger;

        const type = this.value.loadSelf();

        if (type instanceof UStructProperty || type instanceof UClassProperty) {
            return new FArray(type.value.buildClass(pkg.loader.getNativePackage())).load(pkg, tag);
        } else if (type instanceof UObjectProperty) {
            return new FObjectArray().load(pkg, tag);
        } else if (type instanceof UIntProperty) {
            return new FPrimitiveArray(BufferValue.int32).load(pkg, tag);
        } else if (type instanceof UFloatProperty) {
            return new FPrimitiveArray(BufferValue.float).load(pkg, tag);
        } else if (type instanceof UByteProperty) {
            return new FPrimitiveArray(BufferValue.uint8).load(pkg, tag);
        } else if (type instanceof UNameProperty) {
            return new FNameArray().load(pkg, tag);
        } else if (type instanceof UClass) {
            return new FArray(type.buildClass(pkg.loader.getNativePackage())).load(pkg, tag);
        } else {
            debugger;
            throw new Error("Not yet implemented!");
        }
    }

    public toString() {
        const type = this.value.loadSelf();
        let value: string;

        if (type instanceof UStructProperty || type instanceof UObjectProperty) {
            value = type.valueId === 0 ? null : type._value?.friendlyName || "<eval>";
        } else if (type instanceof UIntProperty || type instanceof UFloatProperty) {
            value = type.constructor.name;
        } else if (type instanceof UByteProperty) {
            value = type.constructor.name;
        } else {
            debugger;
            throw new Error("Not yet implemented!");
        }

        return super.toString("ArrayProperty", undefined);
    }
}

enum PropertyFlags_T {
    // Regular flags.
    CPF_Edit = 0x00000001, // Property is user-settable in the editor.
    CPF_Const = 0x00000002, // Actor's property always matches class's default actor property.
    CPF_Input = 0x00000004, // Variable is writable by the input system.
    CPF_ExportObject = 0x00000008, // Object can be exported with actor.
    CPF_OptionalParm = 0x00000010, // Optional parameter (if CPF_Param is set).
    CPF_Net = 0x00000020, // Property is relevant to network replication.
    CPF_EditConstArray = 0x00000040,// Prevent adding/removing of items from dynamic a array in the editor.
    CPF_Parm = 0x00000080, // Function/When call parameter.
    CPF_OutParm = 0x00000100, // Value is copied out after function call.
    CPF_SkipParm = 0x00000200, // Property is a short-circuitable evaluation function parm.
    CPF_ReturnParm = 0x00000400, // Return value.
    CPF_CoerceParm = 0x00000800, // Coerce args into this function parameter.
    CPF_Native = 0x00001000, // Property is native: C++ code is responsible for serializing it.
    CPF_Transient = 0x00002000, // Property is transient: shouldn't be saved, zero-filled at load time.
    CPF_Config = 0x00004000, // Property should be loaded/saved as permanent profile.
    CPF_Localized = 0x00008000, // Property should be loaded as localizable text.
    CPF_Travel = 0x00010000, // Property travels across levels/servers.
    CPF_EditConst = 0x00020000, // Property is uneditable in the editor.
    CPF_GlobalConfig = 0x00040000, // Load config from base class, not subclass.
    CPF_OnDemand = 0x00100000, // Object or dynamic array loaded on demand only.
    CPF_New = 0x00200000, // Automatically create inner object.
    CPF_NeedCtorLink = 0x00400000, // Fields need construction/destruction.
    CPF_NoExport = 0x00800000, // Property should not be exported to the native class header file.
    CPF_Button = 0x01000000, // String that has "Go" button which allows it to call functions from UEd.
    CPF_CommentString = 0x02000000, // Property has a comment string visible via the property browser
    CPF_EditInline = 0x04000000, // Edit this object reference inline.
    CPF_EdFindable = 0x08000000, // References are set by clicking on actors in the editor viewports.
    CPF_EditInlineUse = 0x10000000, // EditInline with Use button.
    CPF_Deprecated = 0x20000000, // Property is deprecated.  Read it from an archive, but don't save it.
    CPF_EditInlineNotify = 0x40000000, // EditInline, notify outer object on editor change.


    // Combinations of flags.
    CPF_ParmFlags = CPF_OptionalParm | CPF_Parm | CPF_OutParm | CPF_SkipParm | CPF_ReturnParm | CPF_CoerceParm,
    CPF_PropagateFromStruct = CPF_Const | CPF_Native | CPF_Transient,
    CPF_PropagateToArrayInner = CPF_ExportObject | CPF_EditInline | CPF_EditInlineUse | CPF_EditInlineNotify | CPF_Localized, // gam
};



export {
    UProperty,
    UNumericProperty,
    UFloatProperty,
    UIntProperty,
    UStrProperty,
    UDelegateProperty,
    UBoolProperty,
    UNameProperty,
    UObjectProperty,
    UClassProperty,
    UStructProperty,
    UByteProperty,
    UArrayProperty,
    PropertyFlags_T
};

type ReturnType<T extends C.ValueTypeNames_T> = T extends C.NumberTypes_T
    ? T extends C.BigNumberTypes_T ? bigint : number
    : T extends C.StringTypes_T ? string : DataView;

type IBufferValueProperty<T extends C.ValueTypeNames_T = C.ValueTypeNames_T> = C.IBufferValueProperty<T>;