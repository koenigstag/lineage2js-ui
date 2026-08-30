import UStruct from "./un-struct";
import { flagBitsToDict } from "../utils/flags";

abstract class UState<Class extends C.UObject = C.UObject> extends UStruct<Class> {
    protected probeMask: bigint;
    protected ignoreMask: bigint;
    protected _stateFlags: number;
    protected labelTableOffset: number;
    protected probes: string[];
    protected stateFlags: C.FlagDict<EnumKeys.EStateFlags_T>;

    public readonly isState = true;

    protected static getConstructorName() { return "State"; }
    public toString() { return `State[${this.friendlyName}]`; }

    protected doLoad(pkg: C.APackage, exp: C.UExport<C.UObject>): void {
        super.doLoad(pkg, exp);

        this.readHead = pkg.tell();

        this.probeMask = pkg.read("uint64");
        this.ignoreMask = pkg.read("uint64");
        this._stateFlags = pkg.read("uint32");
        this.stateFlags = flagBitsToDict(this._stateFlags, EStateFlags_T);

        this.labelTableOffset = pkg.read("uint16");
    }
}

enum EStateFlags_T {
    // State flags.
    STATE_Editable = 0x00000001,	// State should be user-selectable in UnrealEd.
    STATE_Auto = 0x00000002,	// State is automatic (the default state).
    STATE_Simulated = 0x00000004,   // State executes on client side.

    STATE_Unk0x00000008 = 0x00000008,
    STATE_Unk0x00000010 = 0x00000010,
    STATE_Unk0x00000020 = 0x00000020,
    STATE_Unk0x00000040 = 0x00000040,
    STATE_Unk0x00000080 = 0x00000080,
    STATE_Unk0x00000100 = 0x00000100,
    STATE_Unk0x00000200 = 0x00000200,
    STATE_Unk0x00000400 = 0x00000400,
    STATE_Unk0x00000800 = 0x00000800,
    STATE_Unk0x00001000 = 0x00001000,
    STATE_Unk0x00002000 = 0x00002000,
    STATE_Unk0x00004000 = 0x00004000,
    STATE_Unk0x00008000 = 0x00008000,
    STATE_Unk0x00010000 = 0x00010000,
    STATE_Unk0x00020000 = 0x00020000,
    STATE_Unk0x00040000 = 0x00040000,
    STATE_Unk0x00080000 = 0x00080000,
    STATE_Unk0x00100000 = 0x00100000,
    STATE_Unk0x00200000 = 0x00200000,
    STATE_Unk0x00400000 = 0x00400000

};

export default UState;
export { UState, EStateFlags_T };
