import type { BuiltinName } from "../parsing/types.ts";

/** Itanium codes of the fundamental types. */
export const BUILTIN_CODES: Record<BuiltinName, string> = {
    "void": "v",
    "bool": "b",
    "char": "c",
    "signed char": "a",
    "unsigned char": "h",
    "wchar_t": "w",
    "char8_t": "Du",
    "char16_t": "Ds",
    "char32_t": "Di",
    "short": "s",
    "unsigned short": "t",
    "int": "i",
    "unsigned int": "j",
    "long": "l",
    "unsigned long": "m",
    "long long": "x",
    "unsigned long long": "y",
    "__int128": "n",
    "unsigned __int128": "o",
    "float": "f",
    "double": "d",
    "long double": "e",
    "__float128": "g",
};

/** Itanium codes of the operators that have a single meaning. */
export const OPERATOR_CODES: Record<string, string> = {
    "new": "nw",
    "new[]": "na",
    "delete": "dl",
    "delete[]": "da",
    "~": "co",
    "/": "dv",
    "%": "rm",
    "|": "or",
    "^": "eo",
    "=": "aS",
    "+=": "pL",
    "-=": "mI",
    "*=": "mL",
    "/=": "dV",
    "%=": "rM",
    "&=": "aN",
    "|=": "oR",
    "^=": "eO",
    "<<": "ls",
    ">>": "rs",
    "<<=": "lS",
    ">>=": "rS",
    "==": "eq",
    "!=": "ne",
    "<": "lt",
    ">": "gt",
    "<=": "le",
    ">=": "ge",
    "<=>": "ss",
    "!": "nt",
    "&&": "aa",
    "||": "oo",
    "++": "pp",
    "--": "mm",
    ",": "cm",
    "->*": "pm",
    "->": "pt",
    "()": "cl",
    "[]": "ix",
    "?": "qu",
    "co_await": "aw",
};

// [unary, binary]
export const AMBIGUOUS_OPERATOR_CODES: Record<string, [string, string]> = {
    "+": ["ps", "pl"],
    "-": ["ng", "mi"],
    "*": ["de", "ml"],
    "&": ["ad", "an"],
};

// Type of the non-type template arguments of some well known std templates (the parser can't know it).
// "first" means "same type as the first (type) argument", like std::integral_constant<T, v>.
// "size_t" is resolved with the data model: `m` on LP64, `j` on ILP32 (ARMv7).
export const STD_NON_TYPE_ARGUMENTS: Record<string, string[] | "first"> = {
    "std::array": ["", "size_t"],
    "std::bitset": ["size_t"],
    "std::tuple_element": ["size_t"],
    "std::get": ["size_t"],
    "std::make_index_sequence": ["size_t"],
    "std::enable_if": ["b"],
    "std::conditional": ["b"],
    "std::bool_constant": ["b"],
    "std::integral_constant": "first",
    "std::integer_sequence": "first",
};

/** Fixed-width typedefs that are the same on every data model. */
const COMMON_TYPEDEFS: Record<string, BuiltinName> = {
    int8_t: "signed char",
    uint8_t: "unsigned char",
    int16_t: "short",
    uint16_t: "unsigned short",
    int32_t: "int",
    uint32_t: "unsigned int",
};

/** What the standard typedefs really are on each data model, used by `resolveTypedefs`. */
export const TYPEDEFS_BY_MODEL: Record<
    "lp64" | "ilp32",
    Record<string, BuiltinName>
> = {
    lp64: {
        ...COMMON_TYPEDEFS,
        size_t: "unsigned long",
        ssize_t: "long",
        ptrdiff_t: "long",
        intptr_t: "long",
        uintptr_t: "unsigned long",
        intmax_t: "long",
        uintmax_t: "unsigned long",
        off_t: "long",
        time_t: "long",
        int64_t: "long",
        uint64_t: "unsigned long",
        wint_t: "unsigned int",
    },
    ilp32: {
        ...COMMON_TYPEDEFS,
        size_t: "unsigned int",
        ssize_t: "int",
        ptrdiff_t: "int",
        intptr_t: "int",
        uintptr_t: "unsigned int",
        intmax_t: "long long",
        uintmax_t: "unsigned long long",
        int64_t: "long long",
        uint64_t: "unsigned long long",
        wint_t: "int",
    },
};

export const VA_LIST_NAMES = ["va_list", "__builtin_va_list", "__gnuc_va_list"];

// Names that libc++ declares directly in `std`, outside of its inline namespace
export const STD_UNVERSIONED = new Set([
    "nullptr_t",
    "size_t",
    "ptrdiff_t",
    "max_align_t",
    "initializer_list",
    "type_info",
    "exception",
    "bad_exception",
    "bad_alloc",
    "bad_array_new_length",
    "nothrow_t",
    "align_val_t",
    "new_handler",
    "terminate_handler",
    "__va_list",
]);

/** `std::string` and friends, by the character type of the `basic_string` they stand for. */
export const STD_STRING_TYPEDEFS: Record<string, BuiltinName> = {
    string: "char",
    wstring: "wchar_t",
    u8string: "char8_t",
    u16string: "char16_t",
    u32string: "char32_t",
};

/** `std::ostream` and friends, by the `basic_*` template they stand for. */
export const STD_STREAM_TYPEDEFS: Record<string, string> = {
    istream: "basic_istream",
    ostream: "basic_ostream",
    iostream: "basic_iostream",
};

/** Fake tree-sitter node type used to mark template parameter references (see `templateParameterType`). */
export const TEMPLATE_PARAMETER_NODE = "titanio:template-parameter";

export const ANONYMOUS_NAMESPACE = /^(\(anonymous namespace\)|\{anonymous\})$/;
export const NULLPTR_DECLTYPE = /^decltype\s*\(\s*nullptr\s*\)$/;
