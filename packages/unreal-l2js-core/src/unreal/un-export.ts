import * as FlagUtils from "../utils/flags";
import ObjectFlags_T from "./un-object-flags";

class UExport<T extends C.UObject = C.UObject> {
    public index: number;

    public idClass: number;
    public idSuper: number;
    public idPackage: number;

    public idObjectName: number;
    public objectName: string = "None";

    public _flags: number;
    public objectFlags: C.FlagDict<EnumKeys.ObjectFlags_T>;

    public size: number = 0;
    public offset: number;

    public object: T = null;
    public isFake = false;

    public allFlags(flags: ObjectFlags_T): boolean { return FlagUtils.allFlags(this.flags, flags); }
    public anyFlags(flags: ObjectFlags_T): boolean { return FlagUtils.anyFlags(this.flags, flags); }

    get flags() { return this._flags; }
    set flags(flags: number) {
        this._flags = flags;
        this.objectFlags = FlagUtils.flagBitsToDict(flags, ObjectFlags_T);
    }

    public toString() { return `${this.isFake ? '!' : ''}Export(id=${this.index + 1}, name=${this.objectName}, flags=[${Object.entries(this.objectFlags || {}).filter(([, v]) => v).map(([k,]) => k).join(",")}])`; }
}

export default UExport;
export { UExport };