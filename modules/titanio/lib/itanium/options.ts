import type { BuiltinName } from "../parsing/types.ts";
import { TYPEDEFS_BY_MODEL } from "./constants.ts";
import { readPredefinedMacros } from "./macros.ts";

/** Options accepted by `Mangler`. Every one of them is optional. */
export interface MangleOptions {
    /** Which constructor variant to emit. C1 = complete object (default), C2 = base object, C3 = allocating. */
    constructorVariant?: "C1" | "C2" | "C3";

    /** Which destructor variant to emit. D1 = complete object (default), D2 = base object, D0 = deleting. */
    destructorVariant?: "D0" | "D1" | "D2";

    /**
     * Resolve common typedefs the way libstdc++ / glibc (LP64) really mangle them, e.g. `size_t` -> `m`,
     * `uint8_t` -> `h`, `std::string` -> `std::__cxx11::basic_string<...>`, `std::ostream` -> `So`.
     * Off by default so that c++filt gives back exactly the names that were written in the signature.
     */
    resolveTypedefs?: boolean;

    /** Only used with `resolveTypedefs` and libstdc++. `cxx11` (default) -> `std::__cxx11::basic_string`, `gcc4` -> `Ss`. */
    stringAbi?: "cxx11" | "gcc4";

    /**
     * Data model used by the typedef table of `resolveTypedefs`.
     * `lp64` (default): x86_64 Linux, `size_t` = unsigned long. `ilp32`: 32-bit ARM EABI, `size_t` = unsigned int,
     * `int64_t` = long long, `va_list` = `std::__va_list`.
     */
    dataModel?: "lp64" | "ilp32";

    /**
     * Output of `clang++ <your flags> -dM -E -x c++ probe.cpp`, where probe.cpp includes <version>, <cstddef>,
     * <cstdint> and <cstdarg>. The typedefs (`size_t`, `int64_t`, `wint_t`, `int_fast16_t`...), the data model,
     * the `va_list` flavour, the `noexcept` function types (from `__cplusplus`) and the standard library
     * (libc++ and its inline namespace, or libstdc++ and its string ABI) are read from it, so they match that exact
     * compiler and target. Implies `resolveTypedefs: true`. Options set explicitly still win.
     */
    predefinedMacros?: string;

    /** Extra/overriding typedefs (`{ int32_t: "long" }`). They are applied even without `resolveTypedefs`. */
    typedefs?: Record<string, BuiltinName>;

    /**
     * Standard library the names come from. `libstdc++` (default) uses the Sa/Sb/Ss/Si/So/Sd abbreviations.
     * `libc++` doesn't (its names live in the inline namespace `std::__1`) and inserts `__1` after `std::` by default.
     */
    stdLibrary?: "libstdc++" | "libc++";

    /** Inline namespace inserted after `std::` (unless already written). Defaults to `__1` for libc++ and none for libstdc++. */
    stdInlineNamespace?: string | false;

    /**
     * Function templates: the compiler encodes parameters that depend on a template parameter as `T_`, `T0_`...
     * With this on, every type equal to a template argument is assumed to depend on it (`foo<int>(int)` -> `T_`).
     * It's a heuristic; for exact control declare the parameters instead: `template <typename T> void foo<int>(T)`.
     */
    inferTemplateParameters?: boolean;

    /** Encode `noexcept` in function types (`void (*)() noexcept` -> `PDoFvvE`). Default true (C++17 and later). */
    noexceptInFunctionType?: boolean;
}

/** `MangleOptions` with every default filled in, as used internally by `Mangler`. */
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

/** Fills the defaults: explicit options win over the predefined macros, which win over the built-in tables. */
export function resolveOptions(options: MangleOptions): ResolvedOptions {
    const macros = options.predefinedMacros
        ? readPredefinedMacros(options.predefinedMacros)
        : null;
    const stdLibrary = options.stdLibrary ?? macros?.stdLibrary ?? "libstdc++";
    const dataModel = options.dataModel ?? macros?.dataModel ?? "lp64";
    const resolveTypedefs = options.resolveTypedefs ?? macros !== null;
    const inline = options.stdInlineNamespace ??
        (stdLibrary === "libc++" ? macros?.stdInlineNamespace ?? "__1" : false);
    const typedefs = new Map<string, BuiltinName>(
        Object.entries(resolveTypedefs ? TYPEDEFS_BY_MODEL[dataModel] : {}),
    );

    // An explicit `resolveTypedefs: false` wins over the macros, only the user's typedefs are applied then
    for (
        const [name, builtin] of Object.entries(
            resolveTypedefs ? macros?.typedefs ?? {} : {},
        )
    ) {
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
        noexceptInFunctionType: options.noexceptInFunctionType ??
            macros?.noexceptInFunctionType ?? true,
        vaList: macros
            ? macros.vaList
            : dataModel === "ilp32"
            ? "arm"
            : "x86_64",
    };
}
