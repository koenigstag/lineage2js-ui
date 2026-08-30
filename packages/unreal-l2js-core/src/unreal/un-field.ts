import UExport from "src/unreal/un-export";
import APackage from "src/unreal/un-package";
import UObject from "./un-object";

abstract class UField extends UObject {
    public superFieldId: number = 0;
    public nextFieldId: number = 0;
    public _superField: typeof this;
    public _nextField: UField;

    public readonly isField = true;
    protected static getConstructorName() { return "Field"; }

    protected doLoad(pkg: C.APackage, exp: C.UExport): void {
        if (this.constructor.name !== "UClass")
            super.doLoad(pkg, exp);

        this.superFieldId = pkg.read("compat32");
        this.nextFieldId = pkg.read("compat32");
    }

    protected makeLayout() {
        this.isConstructed = true;
    }

    protected preLoad(pkg: APackage, exp: UExport<UObject>): void {
        super.preLoad(pkg, exp);

        this.superFieldId = exp.idSuper;
    }

    protected collectDependencies<T extends UField = typeof this>() {

        const dependencyTree = [];
        let base = this as unknown as T;

        do {
            dependencyTree.push(base);

            base = base.superField as T;

        } while (base);

        return dependencyTree;
    }

    public get superField() {
        if (this._superField !== undefined)
            return this._superField;

        let lastBase: UField = this.loadSelf();

        do {
            if (this.superFieldId !== 0)
                this._superField = this.pkg.fetchObject<typeof this>(this.superFieldId);
            else
                this._superField = null;

            lastBase = lastBase._superField?.loadSelf() as C.UClass;
        } while (lastBase);

        return this._superField;
    }

    public get nextField() {
        if (this._nextField !== undefined)
            return this._nextField;

        let lastBase: UField = this.loadSelf();

        do {
            if (this.nextFieldId !== 0)
                this._nextField = this.pkg.fetchObject<UField>(this.nextFieldId);
            else
                this._nextField = null;

            lastBase = lastBase._nextField?.loadSelf() as C.UClass;
        } while (lastBase);

        return this._nextField;
    }
}

export default UField;
export { UField };