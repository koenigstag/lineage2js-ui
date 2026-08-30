import { allFlags, flagBitsToDict } from "../utils/flags";
import UExport from "./un-export";
import UObject from "./un-object";
import APackage from "./un-package";
import UStruct from "./un-struct";

class UFunction extends UStruct {
    protected paramSize: number;
    protected nativeFuncIndex: number;
    protected numParams: number;
    protected operatorPrecendence: number;
    protected returnValueOffset: number;
    protected _funcFlags: number;
    protected replicationOffset: number;
    protected funcFlags: C.FlagDict<EnumKeys.FunctionFlags_T>;

    protected static getConstructorName() { return "Function"; }

    protected doLoad(pkg: APackage, exp: UExport<UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        const verArchive = pkg.header.getArchiveFileVersion();

        if (verArchive <= 0x40)
            this.paramSize = pkg.read("uint16");

        this.nativeFuncIndex = pkg.read("uint16");

        if (verArchive <= 0x40)
            this.numParams = pkg.read("uint8");

        this.operatorPrecendence = pkg.read("uint8");

        if (verArchive <= 0x40)
            this.returnValueOffset = pkg.read("uint16");

        this._funcFlags = pkg.read("uint32");
        this.funcFlags = flagBitsToDict(this._funcFlags, FunctionFlags_T);

        if (allFlags(this._funcFlags, FunctionFlags_T.FUNC_Net))
            this.replicationOffset = pkg.read("uint16");

        this.readHead = pkg.tell();
    }

    public toString() { return `Function[${this.friendlyName}]`; }
}

enum FunctionFlags_T {
    FUNC_Final = 0x00000001,         // Function is final(prebindable, non - overridable function)
    FUNC_Defined = 0x00000002,       // Function has been defined(not just declared)
    FUNC_Iterator = 0x00000004,      // Function is an iterator
    FUNC_Latent = 0x00000008,        // Function is a latent state function
    FUNC_PreOperator = 0x00000010,   // Unary operator is a prefix operator
    FUNC_Singular = 0x00000020,      // Function cannot be reentered
    FUNC_Net = 0x00000040,           // Function is network - replicated
    FUNC_NetReliable = 0x00000080,   // Function should be sent reliably on the network
    FUNC_Simulated = 0x00000100,     // Function executed on the client side
    FUNC_Exec = 0x00000200,          // Executable from command line
    FUNC_Native = 0x00000400,        // Native function
    FUNC_Event = 0x00000800,         // Event function
    FUNC_Operator = 0x00001000,      // Operator function
    FUNC_Static = 0x00002000,        // Static function
    FUNC_NoExport = 0x00004000,      // Don't export intrinsic function to C++
    FUNC_Const = 0x00008000,         // Function doesn't modify this object
    FUNC_Invariant = 0x00010000,      // Return value is purely dependent on parameters; no state dependencies or internal state changes,

    FUNC_Public = 0x00020000,
    FUNC_Private = 0x00040000,
    FUNC_Protected = 0x00080000,
    FUNC_Delegate = 0x00100000,

    FUNC_FuncInherit = FUNC_Exec | FUNC_Event,
    FUNC_FuncOverrideMatch = FUNC_Exec | FUNC_Final | FUNC_Latent | FUNC_PreOperator | FUNC_Iterator | FUNC_Static | FUNC_Public | FUNC_Protected,
    FUNC_NetFuncFlags = FUNC_Net | FUNC_NetReliable,
};

export default UFunction;
export { UFunction, FunctionFlags_T };

