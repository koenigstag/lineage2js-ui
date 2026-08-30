import * as _path from "path";
import { SUPPORTED_EXTENSIONS } from "./supported-extensions";

abstract class AAssetLoader<
    TPackage extends C.APackage = C.APackage,
    TCorePackage extends C.ACorePackage = C.ACorePackage,
    TEnginePackage extends C.AEnginePackage = C.AEnginePackage,
    TNativePackage extends C.ANativePackage = C.ANativePackage
> {
    private packages = new Map<string, Map<C.SupportedExtensions_T, TPackage | TCorePackage | TEnginePackage | TNativePackage>>();
    protected pkgDependencies = new Map<string, string[]>();

    protected abstract createPackage(UPackage: C.APackageConstructor | C.ACorePackageConstructor | C.AEnginePackageConstructor, downloadPath: string): TPackage;
    protected abstract createNativePackage(UNativePackage: C.ANativePackageConstructor): TNativePackage;

    protected constructor() { }

    private pkgCore: TCorePackage;
    private pkgEngine: TEnginePackage;
    private pkgNative: TNativePackage;

    public getCorePackage() { return this.pkgCore; }
    public getEnginePackage() { return this.pkgEngine; }
    public getNativePackage() { return this.pkgNative; }

    protected init(assetList: L2JS.Core.IAssetListInfo, { UPackage, UCorePackage, UEnginePackage, UNativePackage }: InitParams_T) {
        this.packages.set("native", new Map([["U", this.createNativePackage(UNativePackage)]]))

        for (let [path, downloadPath] of Object.entries(assetList)) {
            const [pkgName, pkgExt] = pathToPkgName(path);

            if (!this.packages.has(pkgName))
                this.packages.set(pkgName, new Map());

            const packages = this.packages.get(pkgName);

            if (packages.has(pkgExt))
                throw new Error(`Package already registered: ${pkgName}`);

            const fullPkgName = `${pkgName}.${pkgExt}`.toLowerCase();

            let PackageConstructor: any;

            switch (fullPkgName) {
                case "core.u": PackageConstructor = UCorePackage; break;
                case "engine.u": PackageConstructor = UEnginePackage; break;
                default: PackageConstructor = UPackage; break;
            }

            packages.set(pkgExt, this.createPackage(PackageConstructor, downloadPath));
        }

        this.pkgCore = this.getPackage("core");
        this.pkgEngine = this.getPackage("engine");
        this.pkgNative = this.getPackage("native");

        return this;
    }

    public getPackage<T extends string | "core" | "engine" | "native">(packagePath: T): ReturnType<T, TPackage, TCorePackage, TEnginePackage, TNativePackage>;
    public getPackage<T extends string | "core" | "engine" | "native">(pkgName: T, impType?: string): ReturnType<T, TPackage, TCorePackage, TEnginePackage, TNativePackage>;
    public getPackage<T extends string | "core" | "engine" | "native">(pkgName: T, impType?: string): ReturnType<T, TPackage, TCorePackage, TEnginePackage, TNativePackage> {

        if (arguments.length === 1) {
            if (pkgName === "native" || pkgName === "core" || pkgName === "engine")
                return getPackage<T, TPackage, TCorePackage, TEnginePackage, TNativePackage>(this.packages, pkgName, "Script");

            const [_pkgName, _pkgExt] = pathToPkgName(pkgName);
            const potentialPkgs = this.packages.get(_pkgName);
            const pkg = potentialPkgs.get(_pkgExt);

            return pkg as ReturnType<T, TPackage, TCorePackage, TEnginePackage, TNativePackage>;
        }

        const pkg = getPackage<T, TPackage, TCorePackage, TEnginePackage, TNativePackage>(this.packages, pkgName, impType);

        if (pkg === null)
            throw new Error(`Package '${pkgName}[${impType}]' not found!`);

        return pkg;
    }

    public hasPackage(pkgName: string, impType: string) {
        if (!this.packages.has(pkgName.toLowerCase())) return false;

        return getPackage(this.packages, pkgName, impType) !== null;
    }

    public getDependencies<T extends TPackage = TPackage>(pkg: T): string[] {
        if (!this.pkgDependencies.has(pkg.path)) {
            throw new Error(`${pkg.path} dependencies never built`);
        }

        const deps = this.pkgDependencies.get(pkg.path).slice();
        const depsToCheck = deps.slice();
        
        deps.unshift(pkg.path);
        
        while (depsToCheck.length > 0) {
            const dep = depsToCheck.shift();

            for (const other of this.pkgDependencies.get(dep)) {
                if (deps.includes(other)) continue;

                deps.push(other);
                depsToCheck.push(other);
            }
        }

        return deps;
    }

    public async load<T extends TPackage = TPackage>(pkg: T): Promise<T> {
        const pkgsToLoad: Array<C.APackage> = [pkg];

        while (pkgsToLoad.length > 0) {
            const pkg = pkgsToLoad.shift();

            if (pkg.isDecoded()) continue;

            await pkg.decode();

            if (!this.pkgDependencies.has(pkg.path))
                this.pkgDependencies.set(pkg.path, []);

            const pkgDeps = this.pkgDependencies.get(pkg.path);

            for (const entry of pkg.imports.filter(imp => imp.className !== "Package")) {
                let entrypackage = pkg.getImportEntry(entry.idPackage);

                while (entrypackage.idPackage !== 0)
                    entrypackage = pkg.getImportEntry(entrypackage.idPackage);

                const packageName = entrypackage.objectName;
                const className = entry.className;

                if (!this.hasPackage(packageName, className)) {
                    // only fatal if something actually fetches the import later
                    console.warn(`Package '${packageName}' for type '${className}' does not exist, skipping dependency.`);
                    continue;
                }

                const dependency = this.getPackage(packageName, className);

                if (!pkgDeps.includes(dependency.path))
                    pkgDeps.push(dependency.path)

                if (!dependency)
                    debugger;

                if (pkgsToLoad.includes(dependency)) continue;

                pkgsToLoad.push(dependency);
            }
        }

        return pkg;
    }
}

export default AAssetLoader;
export { AAssetLoader };

const impProperties = ["ObjectProperty", "StructProperty", "ByteProperty", "BoolProperty", "NameProperty", "FloatProperty", "ArrayProperty", "IntProperty", "ClassProperty", "StrProperty"];
const packageTypes = new Set<C.SupportedExtensions_T>(SUPPORTED_EXTENSIONS.slice().concat(["NATIVE"]));
const extToTypes = new Map<C.SupportedExtensions_T, Set<string>>([...packageTypes].map(v => {
    return [v, new Set<string>()] as [C.SupportedExtensions_T, Set<string>];
}));

const impToTypes = new Map<string, Set<C.SupportedExtensions_T>>();

function addImpExtension(ext: C.SupportedExtensions_T, ...classList: string[]) {
    for (const cls of classList) {
        const impName = cls as string;

        extToTypes.get(ext).add(impName);

        if (!impToTypes.has(impName))
            impToTypes.set(impName, new Set());

        impToTypes.get(impName).add(ext);
    }
}

addImpExtension("UNR", "Level");
addImpExtension("UTX", "Texture", "TexOscillator", "Shader", "ColorModifier", "FinalBlend", "TexEnvMap", "Combiner", "TexCoordSource", "TexPanner", "WetTexture", "TexRotator", "FadeColor", "ConstantColor", "VertexColor", "Cubemap");
addImpExtension("UAX", "Sound");
addImpExtension("USX", "StaticMesh");
addImpExtension("UKX", "Animation", "SkeletalMesh", "VertMesh");
addImpExtension("USK", "Effect");
addImpExtension("U", "Script", "State", "Class", "Struct", "Function", "Enum", ...impProperties, "Texture");
addImpExtension("OGG", "Music");

function pathToPkgName(path: string): [string, C.SupportedExtensions_T] {
    const ext = _path.extname(path);
    const extUpper = ext.slice(1).toUpperCase() as C.SupportedExtensions_T;

    if (!packageTypes.has(extUpper))
        throw new Error(`Unsupported package type '${ext}' for package '${_path.basename(path)}'`);

    return [_path.basename(path, ext).toLowerCase(), extUpper];
}

export { pathToPkgName };

function getPackage<T extends string | "native", TPackage, TCorePackage, TEnginePackage, TNativePackage>(allPackages: Map<string, Map<C.SupportedExtensions_T, TPackage | TNativePackage | TCorePackage | TEnginePackage>>, pkgName: T, impType: string): ReturnType<T, TPackage, TCorePackage, TEnginePackage, TNativePackage> {
    const packages = allPackages.get(pkgName.toLowerCase());
    const validExts = impToTypes.get(impType);

    if (!validExts) {
        console.warn(`Unknown import class type '${impType}' (package '${pkgName}')`);
        return null;
    }

    let pkg: TPackage | TNativePackage | TCorePackage | TEnginePackage = null;

    for (const ext of validExts) {
        if (!packages.has(ext)) continue;

        pkg = packages.get(ext);
        break;
    }

    return pkg as ReturnType<T, TPackage, TCorePackage, TEnginePackage, TNativePackage>;
}


type ReturnType<T extends string | "native" | "core" | "engine", TPackage, TCorePackage, TEnginePackage, TNativePackage> =
    T extends "native" ? TNativePackage
    : T extends "core" ? TCorePackage
    : T extends "engine" ? TEnginePackage
    : TPackage;

type InitParams_T = Record<string, any> | { // can contain anything but must contain at least these two packages
    UPackage: C.APackageConstructor,
    UCorePackage: C.ACorePackageConstructor,
    UEnginePackage: C.ANativePackageConstructor,
    UNativePackage: C.ANativePackageConstructor,
};