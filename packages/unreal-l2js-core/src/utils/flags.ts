function allFlags(flags: number, matchFlags: number): boolean { return (flags & matchFlags) === flags; }
function anyFlags(flags: number, matchFlags: number): boolean { return (flags & matchFlags) !== 0; }

const regexp = /^(-)?\d+$/;

function flagBitsToDict<T extends string>(flags: number, enum_: Record<T, number>) {
    const flagNames = Object.keys(enum_).filter(x => !x.match(regexp));
    let knownFlags = 0;
    const dict = flagNames.reduce((acc, name) => {
        const val = enum_[name as T];
        if (anyFlags(flags, val)) {
            acc[name as T] = true;
            knownFlags |= val;
        }

        return acc;
    }, {} as C.FlagDict<T>);

    if (flags !== 0) {
        const unknownFlags = flags & ~knownFlags;
        if (unknownFlags !== 0) {
            for (let i = 0; i < 32; i++) {
                if ((unknownFlags & (1 << i)) !== 0) {
                    (dict as any)[`_Unk_${i + 1}`] = true;
                }
            }
            console.warn("Unknown flags present:", dict);
        }
    }

    return dict;
}

export { anyFlags, allFlags, flagBitsToDict }