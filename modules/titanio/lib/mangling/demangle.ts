import { principe, Recuerdo, utils } from "../../deps.ts";

const MANGLED_REGEX = /^_Z(?:N.*?E|[^.]+).*$/;
const DEMANGLED_MAP = new Map<string, string>();

/** Demangles an Itanium C++ name using `c++filt`, with results cached */
export function demangle(input: string): string {
    input = input.trim();

    if (!MANGLED_REGEX.test(input))
        throw new Error(`Provided input is an invalid mangled string: "${input}"`);

    if (DEMANGLED_MAP.has(input)) {
        Recuerdo.log(`Using cache for demangling signature "${input}"`);
        return DEMANGLED_MAP.get(input)!;
    }

    const result = utils.decode(principe.exec`c++filt -n ${input}`.stdout).trim();

    // c++filt echoes back anything it can't demangle
    if (input === result)
        throw new Error(`Provided input is an invalid mangled string: "${input}"`);

    DEMANGLED_MAP.set(input, result);
    return result;
}
