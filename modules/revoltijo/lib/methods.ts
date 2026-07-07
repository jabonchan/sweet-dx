import { child_process } from "../deps.ts"
import { Mangler } from "./mangle/mangler.ts";

const mangler = await Mangler.create();

export function isMangled(definition: string) {
    try {
        demangle(definition);
        return true;
    } catch {
        return false;
    }
}

export function isDemangled(definition: string) {
    return !isMangled(definition);
}

export function ensureMangled(definition: string) {
    if (isMangled(definition)) return definition;
    return mangle(definition);
}

export function ensureDemangled(definition: string) {
    if (isDemangled(definition)) return definition;
    return demangle(definition);
}

export function demangle(definition: string): string {
    const proc = child_process.spawnSync("c++filt", [ definition ], { stdio: "pipe" });
    const demangled = new TextDecoder().decode(proc.stdout).trim();

    if (demangled === definition) throw new Error("Provided definition is not mangled: " + definition);

    return demangled;
}

export function mangle(definition: string): string {
    return mangler.mangle(definition);
}