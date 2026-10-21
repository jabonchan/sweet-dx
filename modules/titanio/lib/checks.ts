import { parseSignature } from "./parsing/parse.ts";
import { demangle } from "./mangling/demangle.ts";

const CFunctionNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Whether `signature` parses as a C++ function declaration. */
export function isCppFunctionSignature(signature: string): boolean {
    try {
        // It uses cache so no performance impact
        parseSignature(signature);
        return true;
    } catch {
        return false;
    }
}

/** Whether `signature` is a mangled C++ name that `c++filt` can demangle. */
export function isMangledCppSignature(signature: string): boolean {
    try {
        // It uses cache so no performance impact
        demangle(signature);
        return true;
    } catch {
        return false;
    }
}

/** Whether `name` is a plain C identifier. */
export function isCFunctionName(name: string): boolean {
    return CFunctionNameRegex.test(name);
}
