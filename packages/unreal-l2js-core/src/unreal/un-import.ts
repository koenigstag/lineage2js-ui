class UImport {
    public index: number;
    public idPackage: number;

    public idClassName = 0;
    public className = "None";

    public idObjectName = 0;
    public objectName = "None";

    public idClassPackage = 0;
    public classPackage = "None";

    public isFake = false;

    public toString() { return `${this.isFake ? '!' : ''}Import(id=${-(this.index + 1)}, name=${this.objectName})`; }
}

export default UImport;
export { UImport };