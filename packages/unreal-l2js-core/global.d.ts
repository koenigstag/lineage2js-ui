import C = L2JS.Core;
import IConstructable = C.IConstructable;

declare namespace EnumKeys {
    type PackageFlags_T = keyof typeof import("./src/unreal/un-package").PackageFlags_T;
    type EClassFlags_T = keyof typeof import("./src/unreal/un-class").EClassFlags_T;
    type ObjectFlags_T = keyof typeof import("./src/unreal/un-object-flags").ObjectFlags_T;
    type FunctionFlags_T = keyof typeof import("./src/unreal/un-function").FunctionFlags_T;
    type EStateFlags_T = keyof typeof import("./src/unreal/un-state").EStateFlags_T;
    type PropertyFlags_T = keyof typeof import("./src/unreal/un-property/un-properties").PropertyFlags_T;
}

type PropertyExtraPars_T = {
    arrayDimensions?: number,
    flags?: number,
    categoryNameId?: number,
    categoryName?: string,
    valueId?: number
};