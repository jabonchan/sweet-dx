import { parseEntity } from "./parsing/parse-entity.ts";
import { parseSignature } from "./parsing/parse.ts";
import { demangle } from "./mangling/demangle.ts";

const CFunctionNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MANGLED_REGEX = /^_Z(?:N.*?E|[^.]+).*$/;

export enum SignatureType {
    UNKNOWN_SIGNATURE,

    CPP_MANGLED_ENTITY_SIGNATURE,
    CPP_MANGLED_CALL_SIGNATURE,
    CPP_ENTITY_SIGNATURE,
    CPP_CALL_SIGNATURE,
    C_IDENTIFIER,
}

/** Self explanatory, detects the type of a signature */
export function getSignatureType(signature: string): SignatureType {
    if (isMangledCppSignature_FAST(signature) && isMangledCppSignature(signature)) {
        const demangled = demangle(signature);

        if (isCppEntitySignature(demangled)) return SignatureType.CPP_MANGLED_ENTITY_SIGNATURE;
        return SignatureType.CPP_MANGLED_CALL_SIGNATURE;
    }

    if (isCppFunctionSignature(signature)) {
        return SignatureType.CPP_CALL_SIGNATURE;
    }

    if (isCFunctionName(signature)) {
        return SignatureType.C_IDENTIFIER;
    }

    return SignatureType.UNKNOWN_SIGNATURE;
}

/** Whether `signature` parses as a C++ function declaration */
export function isCppFunctionSignature(signature: string): boolean {
    try {
        // It uses cache so no performance impact
        parseSignature(signature);
        return true;
    } catch {
        return false;
    }
}

/** Whether `signature` parses as a C++ variable or special name (`vtable for Foo`...), functions are false */
export function isCppEntitySignature(signature: string): boolean {
    try {
        // It uses cache so no performance impact
        parseEntity(signature);
        return true;
    } catch {
        return false;
    }
}

/** Whether `signature` is a mangled C++ name that `c++filt` can demangle */
export function isMangledCppSignature(signature: string): boolean {
    try {
        // It uses cache so no performance impact
        demangle(signature);
        return true;
    } catch {
        return false;
    }
}

/** Whether `signature` is a mangled C++ name but using just regex */
export function isMangledCppSignature_FAST(signature: string): boolean {
    signature = signature.trim();
    return MANGLED_REGEX.test(signature);
}

/** Whether `name` is a plain C identifier */
export function isCFunctionName(name: string): boolean {
    return CFunctionNameRegex.test(name);
}
export function isCVariableName(name: string): boolean {
    return isCFunctionName(name);
}
