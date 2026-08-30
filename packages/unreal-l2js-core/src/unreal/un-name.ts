class UName {
    public name: string;
    public flags: number;

    public isFake = false;

    public toString() { return `${this.isFake ? '!' : ''}Name(name=${this.name}, flags=${this.flags})`; }
}

export default UName;
export { UName };