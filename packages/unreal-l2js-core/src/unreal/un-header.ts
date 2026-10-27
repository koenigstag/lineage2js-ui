import BufferValue from "../buffer-value";

type UGeneration = import("./un-generation").UGeneration;

class UHeader {
    public version: number;
    public _packageFlags: number;
    public packageFlags: C.FlagDict<EnumKeys.PackageFlags_T>;

    public nameCount: number;
    public nameOffset: number;

    public exportCount: number;
    public exportOffset: number;
    public importCount: number;
    public importOffset: number;

    public heritageCount: number;
    public heritageOffset: number;

    public generations: UGeneration[] = [];
    public guid = new BufferValue(BufferValue.guid);

    public getArchiveFileVersion() { return this.version & 0xffff; }
    public getLicenseeVersion() { return this.version >> 16; }
}

export default UHeader;
export { UHeader };