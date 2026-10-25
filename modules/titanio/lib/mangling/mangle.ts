import { type MangleOptions, Mangler } from "../itanium/mangler.ts";
import { getClangMacros } from "../itanium/get-clang-macros.ts";
import type { BuiltinName, ParsedEntity } from "../parsing/types.ts";
import { parseEntity } from "../parsing/parse-entity.ts";
import { parseSignature } from "../parsing/parse.ts";
import { isCppFunctionSignature } from "../checks.ts";
import { Recuerdo } from "../../deps.ts";

const MANGLED_MAP = new Map<string, string[]>();

// Fixed-width types of source/include/types.h, titanio can't see the headers
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

/** Mangles a C++ signature for the game's toolchain, constructors and destructors get every variant */
export function mangle(signature: string): string[] {
    if (!isCppFunctionSignature(signature)) return [ mangleEntity(signature) ];

    const parsed = parseSignature(signature);

    if (MANGLED_MAP.has(parsed.sourceSignature)) {
        Recuerdo.log(`Using cached mangled signature for "${signature}"`);
        return [ ...MANGLED_MAP.get(parsed.sourceSignature)! ];
    }

    Recuerdo.log(`Parsing ${signature}`);
    const options = toolchainOptions();

    let result: string[] = [];

    switch (parsed.specialMember) {
        case "constructor":
            result = [
                new Mangler({ ...options }).mangle(parsed),
                new Mangler({ ...options, constructorVariant: "C2" }).mangle(parsed),
                new Mangler({ ...options, constructorVariant: "C3" }).mangle(parsed),
            ];
            break;

        // D0 (deleting) is a different function, so it goes last since callers take the first one that exists
        case "destructor":
            result = [
                new Mangler({ ...options }).mangle(parsed),
                new Mangler({ ...options, destructorVariant: "D2" }).mangle(parsed),
                new Mangler({ ...options, destructorVariant: "D0" }).mangle(parsed),
            ];
            break;

        default:
            result = [ new Mangler(options).mangle(parsed) ];
            break;
    }

    Recuerdo.log(`Mangled signature "${signature} as`, result);
    MANGLED_MAP.set(parsed.sourceSignature, result);
    return [ ...result ];
}

export type SpecialVariant = "C1" | "C2" | "C3" | "D0" | "D1" | "D2";

/** Mangles a constructor or destructor as exactly that variant, "default" is C1/D1 and works on any signature */
export function mangleAs(signature: string, variant: SpecialVariant | "default"): string {
    if (!isCppFunctionSignature(signature)) {
        if (variant !== "default")
            throw new Error(`"${signature}" is not a constructor/destructor, it can't be mangled as the ${variant} variant`);

        return mangleEntity(signature);
    }

    const parsed = parseSignature(signature);
    const options = toolchainOptions();

    if (variant === "default")
        return new Mangler(options).mangle(parsed);

    const member = parsed.specialMember === "constructor" || parsed.specialMember === "destructor" ? parsed.specialMember : null;
    const variantMember = variant.startsWith("C") ? "constructor" : "destructor";

    if (variantMember !== member) {
        throw new Error(`"${signature}" is ${member ? `a ${member}` : "not a constructor/destructor"}, it can't be mangled as the ${variant} variant`);
    }

    if (member === "constructor") options.constructorVariant = variant as MangleOptions["constructorVariant"];
    if (member === "destructor") options.destructorVariant = variant as MangleOptions["destructorVariant"];

    return new Mangler(options).mangle(parsed);
}

/** Variables and special names (vtable for, typeinfo for...), anything that isn't a function */
function mangleEntity(signature: string): string {
    let entity: ParsedEntity;

    try {
        entity = parseEntity(signature);
    } catch (entityError) {
        // A mistyped function signature lands here too, so both reasons are shown
        let functionError = "";

        try {
            parseSignature(signature);
        } catch (error) {
            functionError = error instanceof Error ? error.message : String(error);
        }

        throw new Error(
            `"${signature}" is neither a function signature (${functionError}) nor a variable or special name (${
                entityError instanceof Error ? entityError.message : String(entityError)
            })`,
        );
    }

    const mangler = new Mangler(toolchainOptions());
    let result: string;

    switch (entity.kind) {
        case "variable":
            result = mangler.mangleVariable(entity.name);
            break;

        case "guard":
            result = mangler.mangleGuardVariable(entity.name);
            break;

        case "typeSpecial":
            result = mangler.mangleTypeSpecialName(entity.prefix, entity.type);
            break;
    }

    Recuerdo.log(`Mangled entity "${signature}" as`, result);
    return result;
}

function toolchainOptions(): MangleOptions {
    return {
        predefinedMacros: getClangMacros(),
        stdLibrary: "libc++",
        stdInlineNamespace: "__1",
        typedefs: PROJECT_TYPEDEFS,
        inferTemplateParameters: true,
        constructorVariant: "C1",
        destructorVariant: "D1",
    };
}
