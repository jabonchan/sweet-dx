import type { BuiltinName } from "../parsing/types.ts";
import { TYPEDEFS_BY_MODEL } from "./constants.ts";
import { readPredefinedMacros } from "./macros.ts";

/** Options accepted by `Mangler`. Every one of them is optional */
export interface MangleOptions {
    /** C1 = complete object (default), C2 = base object, C3 = allocating */
    constructorVariant?: "C1" | "C2" | "C3";

    /** Which destructor variant to emit. D1 = complete object (default), D2 = base object, D0 = deleting */
    destructorVariant?: "D0" | "D1" | "D2";

    /** Resolve typedefs like libstdc++/glibc (LP64) mangle them (size_t -> m) */
    resolveTypedefs?: boolean;

    /** Only with resolveTypedefs and libstdc++, cxx11 (default) or gcc4 (Ss) */
    stringAbi?: "cxx11" | "gcc4";

    /** lp64 (size_t = unsigned long) or ilp32 (32-bit ARM, size_t = unsigned int) */
    dataModel?: "lp64" | "ilp32";

    /** Output of clang++ -dM -E, typedefs, data model, va_list, noexcept and std library are read from it */
    predefinedMacros?: string;

    /** Extra typedefs ({ int32_t: "long" }), applied even without resolveTypedefs */
    typedefs?: Record<string, BuiltinName>;

    /** libstdc++ uses the Sa/Ss/So... abbreviations, libc++ doesn't and adds __1 after std:: */
    stdLibrary?: "libstdc++" | "libc++";

    /** Inline namespace after std::, __1 for libc++ and none for libstdc++ by default */
    stdInlineNamespace?: string | false;

    /** Every type equal to a template argument depends on it (foo<int>(int) -> T_), it's a heuristic */
    inferTemplateParameters?: boolean;

    /** Encode noexcept in function types (PDoFvvE), true by default (C++17) */
    noexceptInFunctionType?: boolean;
}

/** `MangleOptions` with every default filled in, as used internally by `Mangler` */
export interface ResolvedOptions {
    constructorVariant: "C1" | "C2" | "C3";
    destructorVariant: "D0" | "D1" | "D2";
    resolveTypedefs: boolean;
    stringAbi: "cxx11" | "gcc4";
    dataModel: "lp64" | "ilp32";
    typedefs: Map<string, BuiltinName>;
    stdLibrary: "libstdc++" | "libc++";
    inlineNamespace: string | null;
    inferTemplateParameters: boolean;
    noexceptInFunctionType: boolean;
    vaList: "arm" | "x86_64" | null;
}

/** Explicit options win over the macros, which win over the built-in tables */
export function resolveOptions(options: MangleOptions): ResolvedOptions {
    const macros = options.predefinedMacros ? readPredefinedMacros(options.predefinedMacros) : null;
    const stdLibrary = options.stdLibrary ?? macros?.stdLibrary ?? "libstdc++";
    const dataModel = options.dataModel ?? macros?.dataModel ?? "lp64";
    const resolveTypedefs = options.resolveTypedefs ?? macros !== null;
    const inline = options.stdInlineNamespace ?? (stdLibrary === "libc++" ? macros?.stdInlineNamespace ?? "__1" : false);
    const typedefs = new Map<string, BuiltinName>(Object.entries(resolveTypedefs ? TYPEDEFS_BY_MODEL[dataModel] : {}));

    // An explicit `resolveTypedefs: false` wins over the macros, only the user's typedefs are applied then
    for (const [name, builtin] of Object.entries(resolveTypedefs ? macros?.typedefs ?? {} : {})) {
        typedefs.set(name, builtin);
    }
    for (const [name, builtin] of Object.entries(options.typedefs ?? {})) {
        typedefs.set(name, builtin);
    }

    return {
        constructorVariant: options.constructorVariant ?? "C1",
        destructorVariant: options.destructorVariant ?? "D1",
        resolveTypedefs,
        stringAbi: options.stringAbi ?? macros?.stringAbi ?? "cxx11",
        dataModel,
        typedefs,
        stdLibrary,
        inlineNamespace: inline || null,
        inferTemplateParameters: options.inferTemplateParameters ?? false,
        noexceptInFunctionType: options.noexceptInFunctionType ?? macros?.noexceptInFunctionType ?? true,
        vaList: macros ? macros.vaList : dataModel === "ilp32" ? "arm" : "x86_64",
    };
}
