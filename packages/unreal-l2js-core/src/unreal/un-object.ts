import UStack from "./un-stack";
import UExport from "./un-export";
import APackage from "./un-package";
import BufferValue from "../buffer-value";
import { FPrimitiveArray } from "./un-array";
import ObjectFlags_T from "./un-object-flags";
import PropertyTag, { UNP_PropertyTypes } from "./un-property/un-property-tag";

// deferred value, LazyPropertyMap resolves on first read and caches the result back into the map
abstract class LazyPropertyValue<T = any> {
    public abstract resolve(): T;
}

class LazyPropertyMap extends Map<string, any> {
    // per-class defaults template, iteration yields layout keys first in layout order (loadNative relies on it)
    protected layout: Map<string, any> = null;

    public setLayout(layout: Map<string, any>): this {
        this.layout = layout;

        return this;
    }

    public get(key: string): any {
        let raw: any;

        if (super.has(key)) raw = super.get(key);
        else if (this.layout !== null) raw = this.layout.get(key);
        else return undefined;

        if (raw instanceof LazyPropertyValue) {
            const resolved = raw.resolve();

            super.set(key, resolved);

            return resolved;
        }

        return raw;
    }

    public has(key: string): boolean {
        return super.has(key) || (this.layout !== null && this.layout.has(key));
    }

    public get size(): number {
        if (this.layout === null) return super.size;

        let count = this.layout.size;

        for (const key of Map.prototype.keys.call(this))
            if (!this.layout.has(key)) count++;

        return count;
    }

    public keys(): MapIterator<string> {
        const self = this;

        return (function* () {
            const layout = self.layout;

            if (layout === null) {
                yield* Map.prototype.keys.call(self);
                return;
            }

            yield* layout.keys();

            for (const key of Map.prototype.keys.call(self))
                if (!layout.has(key)) yield key;
        })() as MapIterator<string>;
    }

    public entries(): MapIterator<[string, any]> {
        const self = this;

        return (function* () {
            for (const key of self.keys())
                yield [key, self.get(key)] as [string, any];
        })() as MapIterator<[string, any]>;
    }

    public values(): MapIterator<any> {
        const self = this;

        return (function* () {
            for (const key of self.keys())
                yield self.get(key);
        })() as MapIterator<any>;
    }

    public forEach(callback: (value: any, key: string, map: Map<string, any>) => void, thisArg?: any): void {
        for (const key of this.keys())
            callback.call(thisArg, this.get(key), key, this);
    }

    public [Symbol.iterator](): MapIterator<[string, any]> {
        return this.entries();
    }
}

class MapReflectable extends LazyPropertyMap {
    protected object: UObject;

    public constructor(object: UObject) {
        super();

        this.object = object;
    }

    public set(key: string, value: any): this {
        super.set(key, value);

        let propMap = (this.object.constructor as any)._propertyMapCache;
        if (!propMap) {
            propMap = (this.object as any).getPropertyMap();
            (this.object.constructor as any)._propertyMapCache = propMap;
        }

        if (key in propMap) {
            const varName = propMap[key];

            if (value instanceof LazyPropertyValue) {
                // native classes read this.foo directly instead of going through the map, field must stay lazy too
                Object.defineProperty(this.object, varName, {
                    configurable: true,
                    get: () => {
                        const resolved = this.get(key);

                        Object.defineProperty(this.object, varName, { value: resolved, writable: true, enumerable: true, configurable: true });

                        return resolved;
                    },
                    set: (v: any) => {
                        super.set(key, v);
                        Object.defineProperty(this.object, varName, { value: v, writable: true, enumerable: true, configurable: true });
                    }
                });
            } else if (UObject.USE_REFLECTABLE) {
                Object.defineProperty(this.object, varName, {
                    value: value,
                    writable: true
                });
            } else {
                (this.object as any)[varName] = value;
            }
        }

        return this;
    }
}

abstract class UObject implements C.ISerializable {
    declare public ["constructor"]: typeof UObject & { friendlyName?: string };

    public static readonly LAZY_CLONE_ON_USE = true;
    public static ALLOW_EDITING = true;
    public static USE_REFLECTABLE = false;
    public static readonly CLEANUP_NAMESPACE = true;
    public static readonly isSerializable = true;
    public static UNREAD_AS_NATIVE = false;

    // Patched for this fork (see README). `un-object-mixin.ts` in
    // @lineage2js/unreal-l2js-render installs these two statics on every
    // subclass through onClassCreated, and several hundred call sites there
    // rely on them. Upstream only declared them in a `declare module`
    // augmentation, which cannot merge onto an existing class -- so to the
    // compiler they never existed. Declaring them here says what is already
    // true at runtime, and emits nothing.
    declare public static make: <K extends abstract new (...args: any[]) => any>(
        this: K,
        ...args: ConstructorParameters<{ new(): never } & K>
    ) => InstanceType<K>;
    declare public static class: <K extends abstract new (...args: any[]) => any>(
        this: K
    ) => new (...args: ConstructorParameters<{ new(): never } & K>) => InstanceType<K>;

    declare public readonly isObject: boolean;
    declare public isConstructed: boolean;

    public name: string;
    public objectName: string;

    public exportIndex?: number = null;
    public exp?: UExport = null;
    public stack?: UStack = null;

    declare protected skipRemaining: boolean;
    declare protected careUnread: boolean;

    protected readHead: number = NaN;
    protected readStart: number = NaN;
    protected readTail: number = NaN;

    declare protected isLoading: boolean;
    declare protected isReady: boolean;

    protected pkg: APackage;
    // public readonly propertyDict = new Map<string, any>();
    // materialized on first use, objects created in hot paths (math structs via .make()) never touch it
    public get propertyDict(): LazyPropertyMap {
        const dict = UObject.ALLOW_EDITING ? new LazyPropertyMap() : new MapReflectable(this);
        const layout = (this.constructor as any)._classLayout as Map<string, any>;

        if (layout) dict.setLayout(layout);

        Object.defineProperty(this, "propertyDict", { value: dict, configurable: true });

        return dict;
    }
    public nativeBytes?: BufferValue<"buffer"> = null;

    public constructor(..._: any) {
        this.makeLayout();

        if (!this.isConstructed)
            throw new Error(`'${this.constructor.name}' must be created via package.`)

        this.onSuperConstructed();
    }

    public static getUnserializedProperties(): C.UnserializedProperty_T[] { return []; }

    private static unserializedPropsCache = new Map<Function, C.UnserializedProperty_T[]>();

    public static collectUnserializedProperties(): C.UnserializedProperty_T[] {
        const cached = UObject.unserializedPropsCache.get(this);
        if (cached) return cached;

        if (this === UObject)
            return this.getUnserializedProperties();

        let base = this as any;
        const dependencyProps: Record<string, C.UnserializedProperty_T> = {};

        do {
            for (const prop of base.getUnserializedProperties()) {
                dependencyProps[prop[0]] = prop;
            }
            base = base.__proto__;

        } while (base !== UObject);

        const result = Object.values(dependencyProps);
        // Cache the result
        UObject.unserializedPropsCache.set(this, result);
        return result;
    }

    protected onSuperConstructed(): void { }
    protected makeLayout(): void { throw new Error(`Layout for '${this.constructor.name}' must be overloaded by the package, was this created via package?.`); }
    protected findPropReader<T1 = any, T2 = any>(propName: string): C.UProperty<T1, T2> { { throw new Error(`Layout for '${this.constructor.name}' must be overloaded by the package, was this created via package?.`); } }

    protected setReadPointers(exp: UExport) {
        this.readStart = this.readHead = exp.offset;
        this.readTail = this.readHead + exp.size;
    }

    public get byteCount() { return this.readTail - this.readStart; }
    public get bytesUnread() { return this.readTail - this.readHead; }
    public get byteOffset() { return this.readHead - this.readStart; }

    public get objectFlags() { return this.exp ? this.exp.objectFlags : {} };


    protected static getConstructorName(): string {
        debugger;
        throw new Error("Must be implemented by inheriting class because JS does not support inheritence chain.");
    }

    public static get inheritenceChain() {
        if (this === UObject)
            return ["Object"];

        let base = this as any;
        const dependencyChain = new Array<string>();

        do {
            dependencyChain.push(base.getConstructorName());
            base = base.__proto__;

        } while (base !== UObject);

        dependencyChain.push("Object");

        return dependencyChain.reverse();
    }

    protected readNamedProps(pkg: APackage, _exp: UExport) {
        pkg.seek(this.readHead, "set");

        if (this.readHead < this.readTail) {
            do {
                const tag = PropertyTag.from(pkg, this.readHead);

                if (!tag.isValid()) {
                    tag.release();
                    break;
                }

                this.loadProperty(pkg, tag);

                this.readHead = pkg.tell();
                tag.release();

            } while (this.readHead < this.readTail);
        }

        this.readHead = pkg.tell();
    }

    protected getPropertyMap(): Record<string, string> { return {}; }
    protected getPropertyVarName(tag: PropertyTag) { return tag.name; }
    protected findValidProperty(varName: string) { return this.findPropReader(varName); }

    public nativeClone<T extends UObject = UObject>(): T {
        const Constructor = this.constructor as any as new () => T;

        return new Constructor().copy(this);
    }

    public loadSelf() {
        if (!this.pkg || !this.pkg)
            return this;

        return this.load(this.pkg, this.exp);
    }


    protected loadNative(pkg: APackage) {
        const ctor = this.constructor as any;
        const layout = ctor._classLayout as Map<string, any>;

        if (ctor.plainStructFields && layout) {
            // math structs (FVector & co) keep values in plain fields, skips materializing propertyDict on the hottest path
            const propMap = ctor._propertyMapCache as Record<string, string>;

            for (const propName of layout.keys()) {
                const value = this.findPropReader(propName).readValue(pkg, null);
                const varName = propMap[propName];

                if (varName !== undefined) (this as any)[varName] = value;
                else this.propertyDict.set(propName, value);
            }
        } else {
            for (const propName of (layout ?? this.propertyDict).keys()) {
                const property = this.findPropReader(propName);

                const propValue = property.readValue(pkg, null);

                this.propertyDict.set(propName, propValue);
            }
        }

        this.isLoading = false;
        this.isReady = true;

        return this;
    }

    protected copy(other: UObject): this {
        if (this.constructor !== other.constructor)
            throw new Error(`'${this.constructor.name}' !== '${other.constructor.name}'`);

        const ctor = this.constructor as any;

        if (ctor.plainStructFields && ctor._propertyMapCache) {
            // plain-field structs keep values in fields, not the dict (see loadNative)
            for (const varName of Object.values(ctor._propertyMapCache as Record<string, string>))
                (this as any)[varName] = deepClone((other as any)[varName]);

            return this;
        }

        for (const [name, val] of other.propertyDict.entries()) {
            this.propertyDict.set(name, deepClone(val));

        }

        return this;
    }

    protected loadProperty(pkg: APackage, tag: PropertyTag) {
        const offStart = pkg.tell();
        const offEnd = offStart + tag.dataSize;

        const varName = this.getPropertyVarName(tag);
        const { name: propName } = tag;

        if (!varName) {
            // properties can vanish between engine revisions, skip via the tag size like ue does
            console.warn(`Unrecognized property '${propName}' for '${this.constructor.name}' of type '${tag.getTypeName()}', skipping`);
            pkg.seek(offEnd, "set");
            return;
        }

        // const propReader = this.findPropReader(varName);

        // if (tag.type === UNP_PropertyTypes.UNP_StructProperty) {
        //     const propertyOrig = this.findValidProperty(varName);

        //     if (propertyOrig === null) {

        //         const defStruct = (propReader as C.UStructProperty).initializeDefault(pkg.loader.getNativePackage());

        //         this.propertyDict.set(varName, defStruct);
        //     }
        // }

        const property = this.findValidProperty(varName);

        if (!property) {
            console.warn(`Cannot map '${tag.getTypeName()}' property '${propName}' -> '${varName}' for '${this.constructor.friendlyName ?? this.constructor.name}', skipping`);
            pkg.seek(offEnd, "set");
            return;
        }

        if (property.type !== tag.type) {
            // older data can serialize a bool as an int (UBOOL is 4 bytes natively) - read it instead of dropping it
            if (property.type === UNP_PropertyTypes.UNP_BoolProperty && tag.type === UNP_PropertyTypes.UNP_IntProperty) {
                console.assert(tag.dataSize === 4, `IntProperty '${tag.name}' has dataSize ${tag.dataSize}, expected 4`);

                this.propertyDict.set(tag.name, pkg.read("int32") !== 0);
                pkg.seek(offEnd, "set");
                return;
            }

            if (property.type === UNP_PropertyTypes.UNP_ArrayProperty && tag.type === UNP_PropertyTypes.UNP_NameProperty) {
                this.propertyDict.set(tag.name, [pkg.nameTable[pkg.read("compat32") as number].name]);
                pkg.seek(offEnd, "set");
                return;
            }

            if (property.type === UNP_PropertyTypes.UNP_ClassProperty && tag.type === UNP_PropertyTypes.UNP_ObjectProperty) {
                property.readProperty(pkg, tag, this.propertyDict);
                pkg.seek(offEnd, "set");
                return;
            }

            console.warn(`Property '${tag.name}' type mismatch got '${tag.getTypeName()}' expected '${property.getTypeName()}', skipping`);
            pkg.seek(offEnd, "set");
            return;
        }

        property.readProperty(pkg, tag, this.propertyDict);

        // if (pkg.tell() < offEnd)
        //     console.warn(`Unread '${tag.name}' ${offEnd - pkg.tell()} bytes (${((offEnd - pkg.tell()) / 1024).toFixed(2)} kB) for package '${pkg.path}'`);

        if (pkg.tell() > offEnd)
            throw new Error(`Reader exceeded by '${tag.name}' ${offEnd - pkg.tell()} bytes (${((offEnd - pkg.tell()) / 1024).toFixed(2)} kB) for package '${pkg.path}'`);

        pkg.seek(offEnd, "set");
    }

    public setExport(pkg: APackage, exp: UExport) {
        this.objectName = exp.objectName;
        this.exportIndex = exp.index;
        this.exp = exp;
        this.pkg = pkg.asReadable();
        this.name = this.pkg.getObjectPath(exp);
    }

    protected preLoad(pkg: APackage, exp: UExport): void {
        // console.log(`Loading '${exp}' from '${pkg}'`)
        const flags = exp.flags;

        if (!this.exp)
            this.setExport(pkg, exp);

        pkg.seek(exp.offset, "set");
        this.setReadPointers(exp);

        if (flags & ObjectFlags_T.RF_HasStack && exp.size > 0) {

            this.stack = UStack.loadStack(pkg);
        }

        this.readHead = pkg.tell();
    }

    public load(pkg: APackage): this;
    public load(pkg: APackage, info: UExport): this;
    public load(pkg: APackage, info: PropertyTag): this;
    public load(pkg: APackage, info?: any) {
        if (info instanceof UExport)
            return this.loadWithExport(pkg, info);

        if (info instanceof PropertyTag)
            return this.loadWithPropertyTag(pkg, info);

        return this.loadNative(pkg);
    }

    protected loadWithPropertyTag(pkg: APackage, tag: PropertyTag): this {
        const exp = new UExport();

        exp.index = -1;  // Fake exports don't have a real index
        exp.idClass = 0;
        exp.idSuper = 0;
        exp.idPackage = pkg.getActiveObjectRef();
        exp.idObjectName = 0;
        exp.objectName = `${tag.name}[Struct<${tag.structName}>]`;
        exp.flags = 0;
        exp.offset = pkg.tell();
        exp.size = tag.dataSize;
        exp.isFake = true;

        return this.loadWithExport(pkg, exp);
    }

    protected loadWithExport(pkg: APackage, exp: UExport): this {
        if (this.isLoading || this.isReady)
            return this;

        this.isLoading = true;

        if (this.isReady)
            debugger;

        pkg.pushLoadingObject(exp.index >= 0 ? exp.index + 1 : 0);


        this.preLoad(pkg, exp);

        if (!isFinite(this.readHead))
            debugger;

        if (!isFinite(this.readTail))
            debugger;

        if (this.isReady)
            debugger;

        if ((this.readTail - this.readHead) > 0) {
            this.doLoad(pkg, exp);
            this.postLoad(pkg, exp);
        }

        pkg.popLoadingObject();


        this.isLoading = false;
        this.isReady = true;

        return this;
    }

    protected doLoad(pkg: APackage, exp: UExport): void { this.readNamedProps(pkg, exp); }

    protected postLoad(pkg: APackage, _exp: UExport): void {
        this.readHead = pkg.tell();

        if (UObject.UNREAD_AS_NATIVE && this.bytesUnread > 0)
            this.nativeBytes = pkg.read(BufferValue.allocBytes(this.readTail - this.readHead));


        if (this.skipRemaining) this.readHead = this.readTail;
        if (this.bytesUnread > 0 && this.careUnread) {
            // const constructorName = (this.constructor as any).isDynamicClass ? `${(this.constructor as any).friendlyName}[Dynamic]` : this.constructor.name;
            // console.warn(`Unread '${this.name}' (${constructorName}) ${this.bytesUnread} bytes (${((this.bytesUnread) / 1024).toFixed(2)} kB) in package '${pkg.path}', only ${this.readHead - this.readStart} bytes read.`);
        }

        if (UObject.CLEANUP_NAMESPACE) {
            // Object.values(this.getPropertyMap()).forEach(propName => {
            //     if ((this as any)[propName] === undefined)
            //         delete (this as any)[propName];
            // });
        }
    }

    public toJSON(): any {
        const properties: Record<string, any> = {};

        for (const [propName, propValue] of this.propertyDict.entries())
            properties[propName] = propValue.toJSON();

        return {
            type: this.constructor.name,
            name: this.exp?.objectName ?? this.objectName ?? "None",
            index: this.exportIndex ?? null,
            filename: this.pkg?.path ?? null,
            value: properties
        };
    }

    public toString(...args: any): string;
    public toString() {
        return `${this.constructor.name}=(name=${this.exp?.objectName ?? this.objectName}${this.exp ? `, exp=${this.exp.index}` : ''})`;
    }

    public toStringHierarchical(visited?: Set<UObject>, indent: string = ""): string {
        if (!visited) visited = new Set();
        if (visited.has(this)) {
            return `${this.toString()} (cycle detected)`;
        }
        visited.add(this);

        let result = `${this.toString()}\n`;
        const nextIndent = indent + "  ";

        for (const [propName, propValue] of this.propertyDict.entries()) {
            result += `${nextIndent}${propName}: `;
            result += this.formatValueHierarchical(propValue, visited, nextIndent);
            result += "\n";
        }

        return result.trimEnd();
    }

    protected formatValueHierarchical(value: any, visited: Set<UObject>, indent: string): string {
        if (value === null || value === undefined) return "None";

        if (value instanceof UObject) {
            return value.toStringHierarchical(visited, indent);
        }

        if (Array.isArray(value)) {
            if (value.length === 0) return "[]";
            let res = "\n";
            const itemIndent = indent + "  ";
            for (const item of value) {
                res += `${indent}- `;
                res += this.formatValueHierarchical(item, visited, itemIndent);
                res += "\n";
            }
            return res.trimEnd();
        }

        if (value instanceof FPrimitiveArray) {
            return this.formatValueHierarchical([...value.iter()], visited, indent);
        }

        return String(value);
    }
}

export default UObject;
export { UObject, LazyPropertyValue };

function deepClone<T = any>(value: T | T[]): T | T[] {
    // Fast path for primitives
    if (value == null) return null;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") return value;

    // Handle arrays
    if (value instanceof Array && value.constructor === Array) {
        return value.map(v => deepClone(v)) as T[];
    }

    // Handle Unreal objects
    if (value instanceof UObject) return value.nativeClone() as T;
    if (value instanceof FPrimitiveArray) return value.nativeClone() as T;

    debugger;
    throw new Error("not yet implemented");
}

Object.assign(UObject.prototype, {
    isObject: true,
    isConstructed: false,
    name: "None",
    objectName: "None",
    skipRemaining: false,
    careUnread: true,
    isLoading: false,
    isReady: false,
});
