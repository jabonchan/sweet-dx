import { parseSignature } from "../parsing/parse.ts";
import { Recuerdo } from "../../deps.ts";
import { Mangler } from "../itanium/mangler.ts";
import { getClangMacros } from "../itanium/get-clang-macros.ts";
import type { BuiltinName } from "../parsing/types.ts";

const MANGLED_MAP = new Map<string, string>();

// The fixed-width types of source/include/types.h (the same names sead uses). Typedefs are mangled as the type they
// stand for, and titanio can't see the headers.
const PROJECT_TYPEDEFS: Record<string, BuiltinName> = {
    u8: "unsigned char",
    u16: "unsigned short",
    u32: "unsigned int",
    u64: "unsigned long long",
    s8: "signed char",
    s16: "short",
    s32: "int",
    s64: "long long",
    f32: "float",
    f64: "double",
};

/**
 * Mangles a C++ function signature (e.g. `"void Foo::bar(int)"`) into its
 * Itanium name, configured for the game's toolchain. Results are cached by
 * the parsed source signature.
 */
export function mangle(signature: string): string {
    const parsed = parseSignature(signature);

    if (MANGLED_MAP.has(parsed.sourceSignature)) {
        Recuerdo.log(`Using cached mangled signature for "${signature}"`);
        return MANGLED_MAP.get(parsed.sourceSignature)!;
    }

    const result = new Mangler({
        predefinedMacros: getClangMacros(),
        // The game is built with the Nintendo SDK, whose standard library is libc++ (std::__1), whatever headers
        // the local clang++ finds
        stdLibrary: "libc++",
        stdInlineNamespace: "__1",
        typedefs: PROJECT_TYPEDEFS,
        inferTemplateParameters: true,
        constructorVariant: "C1",
        destructorVariant: "D1",
    }).mangle(parsed);

    MANGLED_MAP.set(parsed.sourceSignature, result);

    return result;
}
