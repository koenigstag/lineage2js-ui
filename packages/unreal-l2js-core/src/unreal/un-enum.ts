import UField from "./un-field";
import { FNameArray } from "./un-array";
import UExport from "./un-export";

class UEnum extends UField {
    public readonly names = new FNameArray();
    public friendlyName: string;

    protected static getConstructorName() { return "Enum"; }

    protected preLoad(pkg: C.APackage, exp: UExport<C.UObject>): void {
        super.preLoad(pkg, exp);

        this.friendlyName = exp.objectName;
    }

    protected doLoad(pkg: C.APackage, exp: UExport<C.UObject>): void {
        super.doLoad(pkg, exp);

        this.names.load(pkg);
    }

    public toString() { return `Enum[${this.friendlyName}]`; }
}

export default UEnum;
export { UEnum };