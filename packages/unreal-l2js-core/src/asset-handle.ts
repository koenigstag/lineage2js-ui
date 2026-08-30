interface ILazyAssetHandle {
    readonly isReadable: false;
    getReadable(): Promise<IReadyAssetHandle>;
}

interface IReadyAssetHandle {
    readonly isReadable: true;
    readonly buffer: ArrayBuffer;
    getReadable(): Promise<this>;
}

export default ILazyAssetHandle;
export type { ILazyAssetHandle, IReadyAssetHandle };