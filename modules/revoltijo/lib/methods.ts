import { child_process } from "../deps.ts"
import { Mangler } from "./mangle/mangler.ts";

const mangler = await Mangler.create();

const mangleCache = new Map<string, string>();

export function isMangled(definition: string) {
    // Every Itanium-ABI mangled name starts with "_Z". Checking that directly means we neither
    // spawn a process per hook nor silently misclassify already-mangled names when c++filt is
    // not installed (it usually is not on Windows).
    return /^_Z[A-Za-z0-9_]/.test(definition.trim());
}

export function isDemangled(definition: string) {
    return !isMangled(definition);
}

export function ensureMangled(definition: string, isConstructor: boolean = false) {
    if (isMangled(definition)) return definition;
    return mangle(definition, isConstructor);
}

export function ensureDemangled(definition: string) {
    if (isDemangled(definition)) return definition;
    return demangle(definition);
}

export function demangle(definition: string): string {
    const proc = child_process.spawnSync("c++filt", [ definition ], { stdio: "pipe" });

    if (proc.error) {
        throw new Error(`c++filt is needed to demangle names but could not be run (${proc.error.message}). Install binutils or LLVM and put c++filt on your PATH.`);
    }

    const demangled = new TextDecoder().decode(proc.stdout ?? new Uint8Array()).trim();

    if (demangled === definition) throw new Error("Provided definition is not mangled: " + definition);

    return demangled;
}

export function mangle(definition: string, isConstructor: boolean = false): string {
    // Each uncached call compiles a generated translation unit with clang++ (slow on Windows).
    const key = `${isConstructor ? "ctor" : "fn"}|${definition}`;
    const cached = mangleCache.get(key);

    if (cached !== undefined) return cached;

    let result: string;

    try {
        result = mangler.mangle(definition, isConstructor);
    } catch (error) {
        throw new Error(`Could not mangle "${definition}": ${error instanceof Error ? error.message : String(error)}`);
    }

    mangleCache.set(key, result);

    return result;
}