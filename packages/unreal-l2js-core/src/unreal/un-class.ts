import UState from "./un-state";
import { flagBitsToDict } from "../utils/flags";
import { FArray, FIndexArray } from "./un-array";
import UObject from "./un-object";

class FDependencies implements IConstructable {
    protected classId: number;

    public scriptTextCRC: number;
    public depth: number;
    public class: UClass;

    public load(pkg: C.APackage): this {
        this.classId = pkg.read("compat32");
        this.depth = pkg.read("uint32");
        this.scriptTextCRC = pkg.read("int32");

        return this;
    }
}

class UClass<Class extends UObject = UObject> extends UState<Class> {
    declare ["constructor"]: typeof UClass;

    protected _classFlags: number;
    public classFlags: C.FlagDict<EnumKeys.EClassFlags_T>;
    protected classGuid: DataView;
    protected dependencies = new FArray(FDependencies);
    protected pkgImportIds = new FIndexArray();
    protected pkgImportIds2 = new FIndexArray();
    protected pkgImports: UObject[];
    protected pkgImports2: UObject[];
    protected classWithinId: number;
    protected classConfigName: string;

    public baseStruct: UClass;
    public second: UObject

    public readonly isClass = true;
    protected static getConstructorName() { return "Class"; }

    protected defaultsLoading = new Array<Function>();

    protected loadDefaults() {

        const dependencyTree = this.collectDependencies();

        for (const base of dependencyTree.reverse()) {
            while (base.defaultsLoading.length > 0) {
                const fn = base.defaultsLoading.shift();

                fn();
            }
        }

        return this;
    }

    public getDynamicTag(friendlyName: string) { return `[C*]${friendlyName}`; }

    protected doLoad(pkg: C.APackage, exp: C.UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const verArchive = pkg.header.getArchiveFileVersion();

        this._classFlags = pkg.read("uint32");
        this.classFlags = flagBitsToDict(this._classFlags, EClassFlags_T);
        this.classGuid = pkg.read("guid");


        if (this._classFlags === 1150)
            debugger;

        this.dependencies.load(pkg);
        this.pkgImportIds.load(pkg);

        if (verArchive >= 0x3e) {
            this.classWithinId = pkg.read("compat32");
            ``
            const nameId = pkg.read("compat32");

            this.classConfigName = pkg.nameTable[nameId].name;
        } else {
            debugger;
        }

        if (0x62 < verArchive) this.pkgImportIds2.load(pkg);

        this.readHead = pkg.tell();

        this.readNamedProps(pkg, exp);
    }

    public toString() { return `Class[${this.friendlyName}]`; }
}

enum EClassFlags_T {
    // Base flags.
    CLASS_Abstract = 0x00000001,  // Class is abstract and can't be instantiated directly.
    CLASS_Compiled = 0x00000002,  // Script has been compiled successfully.
    CLASS_Config = 0x00000004,  // Load object configuration at construction time.
    CLASS_Transient = 0x00000008,	// This object type can't be saved; null it out at save time.
    CLASS_Parsed = 0x00000010,	// Successfully parsed.
    CLASS_Localized = 0x00000020,  // Class contains localized text.
    CLASS_SafeReplace = 0x00000040,  // Objects of this class can be safely replaced with default or NULL.
    CLASS_RuntimeStatic = 0x00000080,	// Objects of this class are static during gameplay.
    CLASS_NoExport = 0x00000100,  // Don't export to C++ header.
    CLASS_Placeable = 0x00000200,  // Allow users to create in the editor.
    CLASS_PerObjectConfig = 0x00000400,  // Handle object configuration on a per-object basis, rather than per-class.
    CLASS_NativeReplication = 0x00000800,  // Replication handled in C++.
    CLASS_EditInlineNew = 0x00001000,	// Class can be constructed from editinline New button.
    CLASS_CollapseCategories = 0x00002000,	// Display properties in the editor without using categories.
    CLASS_ExportStructs = 0x00004000,  // amb: export structs to <package>Classes.h header file

    // sjs ---
    CLASS_IsAUProperty = 0x00008000,  // IsA UProperty
    CLASS_IsAUObjectProperty = 0x00010000,  // IsA UObjectProperty
    CLASS_IsAUBoolProperty = 0x00020000,  // IsA UBoolProperty
    CLASS_IsAUState = 0x00040000,  // IsA UState
    CLASS_IsAUFunction = 0x00080000,  // IsA UFunction
    // --- sjs

    CLASS_NeedsDefProps = 0x00100000,  // Class needs its defaultproperties imported
    CLASS_AutoInstancedProps = 0x00200000,  // Object properties of this class are auto-CPF_NeedCtorLink'd (ie instanced on duplicate).
    CLASS_HideDropDown = 0x00400000,  // Class not shown in editor drop down for class selection
    CLASS_NoCacheExport = 0x00800000,  // Class should not be exported to .ucl file by the Cache Manager
    CLASS_ParseConfig = 0x01000000,  // Parse configuration filename from commandline
    CLASS_Cacheable = 0x02000000,  // Class contains cacheable properties

    // Flags to inherit from base class.
    CLASS_Inherit = CLASS_Transient | CLASS_Config | CLASS_Localized | CLASS_SafeReplace | CLASS_RuntimeStatic | CLASS_PerObjectConfig | CLASS_Placeable | CLASS_IsAUProperty | CLASS_IsAUObjectProperty | CLASS_IsAUBoolProperty | CLASS_IsAUState | CLASS_IsAUFunction | CLASS_Cacheable,
    CLASS_RecompilerClear = CLASS_Inherit | CLASS_Abstract | CLASS_NoExport | CLASS_NativeReplication,
    CLASS_ScriptInherit = CLASS_Inherit | CLASS_EditInlineNew | CLASS_CollapseCategories | CLASS_AutoInstancedProps,
};

export default UClass;
export { UClass, EClassFlags_T };