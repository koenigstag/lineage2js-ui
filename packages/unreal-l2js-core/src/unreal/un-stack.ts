import APackage from "./un-package";

class UStack {

    public nodeId: number;
    public stateNodeId: number;
    public probeMask: bigint;
    public latentAction: number;
    public offset: number;

    private constructor() { }

    public static loadStack(pkg: APackage) {
        const stack = new UStack();

        stack.nodeId = pkg.read("compat32");
        stack.stateNodeId = pkg.read("compat32");

        stack.probeMask = pkg.read("int64");
        stack.latentAction = pkg.read("int32");

        if (stack.nodeId !== 0) {
            stack.offset = pkg.read("compat32");
        }

        return stack;
    }
}

export default UStack;
export { UStack };