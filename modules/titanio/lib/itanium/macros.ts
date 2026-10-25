import type { BuiltinName } from "../parsing/types.ts";

/** What `readPredefinedMacros` could learn about the target. Unknown fields stay `undefined` */
export interface PredefinedMacros {
    typedefs: Record<string, BuiltinName>;
    dataModel?: "lp64" | "ilp32";
    vaList: "arm" | "x86_64" | null;
    noexceptInFunctionType?: boolean;
    stdLibrary?: "libstdc++" | "libc++";
    stdInlineNamespace?: string;
    stringAbi?: "cxx11" | "gcc4";
}

/** Typedefs whose `__<NAME>_TYPE__` macro doesn't follow the `__[U]INT<N>_TYPE__` pattern */
const MACRO_TYPEDEF_NAMES: Record<string, string> = {
    SIZE: "size_t",
    PTRDIFF: "ptrdiff_t",
    INTPTR: "intptr_t",
    UINTPTR: "uintptr_t",
    INTMAX: "intmax_t",
    UINTMAX: "uintmax_t",
    WINT: "wint_t",
};

// "long long unsigned int" -> "unsigned long long"
function builtinFromText(text: string): BuiltinName | null {
    const words = text.trim().split(/\s+/);
    const longs = words.filter((word) => word === "long").length;
    const unsigned = words.includes("unsigned");
    const signed = words.includes("signed");

    if (words.includes("double") || words.includes("float")) return null;
    if (words.includes("char"))
        return unsigned ? "unsigned char" : signed ? "signed char" : "char";
    if (words.includes("short")) return unsigned ? "unsigned short" : "short";
    if (longs >= 2) return unsigned ? "unsigned long long" : "long long";
    if (longs === 1) return unsigned ? "unsigned long" : "long";
    if (words.includes("int") || unsigned || signed)
        return unsigned ? "unsigned int" : "int";

    return null;
}

/** Reads the typedefs, data model, va_list, noexcept and std library from a clang++ -dM -E dump */
export function readPredefinedMacros(dump: string): PredefinedMacros {
    const macros = new Map<string, string>();

    for (const line of dump.split(/\r?\n/)) {
        // Not anchored: tolerates log prefixes such as "[LOG, 2026-10-20T02:42:34.439Z]: #define ..."
        const match = /#\s*define\s+(\w+)(?:\s+(.*?))?\s*$/.exec(line);

        if (match) macros.set(match[1], match[2] ?? "");
    }

    const typedefs: Record<string, BuiltinName> = {};

    for (const [macro, value] of macros) {
        const match = /^__(.+)_TYPE__$/.exec(macro);

        if (!match) continue;

        // `UINT_LEAST16` -> `uint_least16_t`, `INT64` -> `int64_t`...
        const parts = /^(U?)INT(?:_(LEAST|FAST))?(\d+)$/.exec(match[1]);
        const name = MACRO_TYPEDEF_NAMES[match[1]]
            ?? (parts ? `${parts[1].toLowerCase()}int${parts[2] ? "_" + parts[2].toLowerCase() : ""}${parts[3]}_t` : undefined);
        const builtin = builtinFromText(value);

        if (name && builtin) typedefs[name] = builtin;
    }

    const cplusplus = Number(/^(\d+)/.exec(macros.get("__cplusplus") ?? "")?.[1]);
    const libcxx = macros.has("_LIBCPP_VERSION");
    const abiNamespace = (macros.get("_LIBCPP_ABI_NAMESPACE") ?? "").trim();
    const cxx11Abi = macros.get("_GLIBCXX_USE_CXX11_ABI")?.trim();

    return {
        typedefs,
        dataModel: macros.has("__ILP32__") || macros.has("_ILP32")
            ? "ilp32"
            : macros.has("__LP64__") || macros.has("_LP64")
            ? "lp64"
            : undefined,
        vaList: macros.has("__arm__") || macros.has("__aarch64__") ? "arm" : macros.has("__x86_64__") ? "x86_64" : null,
        noexceptInFunctionType: macros.has("__cpp_noexcept_function_type") ? true : cplusplus ? cplusplus >= 201703 : undefined,
        stdLibrary: libcxx ? "libc++" : macros.has("__GLIBCXX__") ? "libstdc++" : undefined,
        // _LIBCPP_ABI_NAMESPACE is either a plain name or _LIBCPP_CONCAT(__, _LIBCPP_ABI_VERSION)
        stdInlineNamespace: libcxx
            ? (/^\w+$/.test(abiNamespace) ? abiNamespace : `__${macros.get("_LIBCPP_ABI_VERSION")?.trim() || "1"}`)
            : undefined,
        stringAbi: cxx11Abi === "0" ? "gcc4" : cxx11Abi !== undefined ? "cxx11" : undefined,
    };
}

/** Typedef table (`size_t`, `int64_t`...) read from the output of `clang++ -dM -E -x c++ /dev/null` */
export function typedefsFromPredefinedMacros(dump: string): Record<string, BuiltinName> {
    return readPredefinedMacros(dump).typedefs;
}
