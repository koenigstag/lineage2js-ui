import UField from "./un-field";
import FString from "./un-string";

class UConst extends UField {
    protected value: string;
    public constName: string;

    protected static getConstructorName() { return "Const"; }
    public toString() { return `Const[${this.value}]`; }

    protected preLoad(pkg: C.APackage, exp: C.UExport<C.UObject>): void {
        this.constName = exp.objectName;
        super.preLoad(pkg, exp);
    }

    protected doLoad(pkg: C.APackage, exp: C.UExport<C.UObject>): void {
        super.doLoad(pkg, exp);

        this.value = new FString().load(pkg).value;

        this.readHead = pkg.tell();
    }
}

export default UConst;
export { UConst };