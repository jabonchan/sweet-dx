// Types describing a parsed C++ signature, independent from tree-sitter.

/** cv-qualifiers (plus `restrict`) applied to a type. */
export interface Qualifiers {
    isConst: boolean;
    isVolatile: boolean;
    isRestrict: boolean;
}

/** Every fundamental type, spelled the canonical way. */
export type BuiltinName =
    | "void"
    | "bool"
    | "char"
    | "signed char"
    | "unsigned char"
    | "wchar_t"
    | "char8_t"
    | "char16_t"
    | "char32_t"
    | "short"
    | "unsigned short"
    | "int"
    | "unsigned int"
    | "long"
    | "unsigned long"
    | "long long"
    | "unsigned long long"
    | "__int128"
    | "unsigned __int128"
    | "float"
    | "double"
    | "long double"
    | "__float128";

/** The subset of a tree-sitter node that the parser uses. */
export interface SyntaxNode {
    type: string;
    text: string;
    children: SyntaxNode[];
    childForFieldName(name: string): SyntaxNode | null;
    hasError?: boolean | (() => boolean);
}

/** The top-level declaration node, plus what was done to the source to parse it. */
export interface MainSyntaxNode extends SyntaxNode {
    /** Source that was actually parsed */
    signature: string;
    /** A dummy `void` return type was added to make tree-sitter read it as a declaration */
    hasReturnHack: boolean;
}

/** One `::`-separated part of a name, like `vector<int>` in `std::vector<int>`. */
export interface NameSegment {
    kind: "identifier" | "operator" | "destructor" | "conversion";
    text: string;
    templateArguments?: TemplateArgument[];
    conversionTargetType?: CppType;
}

/** A full name like `::std::vector<int>::push_back`. */
export interface QualifiedName {
    hasLeadingScopeOperator: boolean;
    segments: NameSegment[];
}

/** Result of applying a declarator (pointer, reference, array...) to a base type. */
export interface Applied {
    type?: CppType;
    nameNode?: SyntaxNode;
    pack?: boolean;
}

/**
 * A template argument. `mightBeValue` marks arguments that parsed as a type
 * but could also be a value (e.g. a bare identifier).
 */
export type TemplateArgument =
    | { kind: "type"; type: CppType; mightBeValue?: boolean }
    | { kind: "expression"; sourceText: string; integerValue: number | null };

/** A parameter of a `template<...>` header. */
export interface TemplateParameter {
    kind: "type" | "nonType" | "template";
    name?: string;
    isPack: boolean;
    valueType?: CppType;
}

/** A function parameter. */
export interface Parameter {
    type: CppType;
    name?: string;
    isPack: boolean;
    defaultValueText?: string;
}

/** A function type: its return type, parameters and qualifiers. */
export interface FunctionType {
    kind: "function";
    returnType?: CppType;
    parameters: Parameter[];
    hasCEllipsis: boolean;
    qualifiers: Qualifiers;
    refQualifier?: "&" | "&&";
    isNoexcept: boolean;
}

/** Any C++ type the parser understands, or `unknown` for anything it doesn't. */
export type CppType =
    | { kind: "builtin"; name: BuiltinName; qualifiers: Qualifiers }
    | {
        kind: "named";
        name: QualifiedName;
        qualifiers: Qualifiers;
        elaboratedKeyword?: "struct" | "class" | "union" | "enum";
    }
    | { kind: "pointer"; subtype: CppType; qualifiers: Qualifiers }
    | { kind: "reference"; referent: CppType; isRvalue: boolean }
    | { kind: "array"; elementType: CppType; sizeText?: string }
    | FunctionType
    | { kind: "auto"; qualifiers: Qualifiers }
    | { kind: "decltype"; expressionText: string; qualifiers: Qualifiers }
    | {
        kind: "unknown";
        sourceText: string;
        treeSitterNodeType: string;
        qualifiers: Qualifiers;
    };

/** A fully parsed function signature, ready to be mangled. */
export interface ParsedSignature extends Omit<FunctionType, "kind"> {
    templateParameters: TemplateParameter[];
    qualifiedName: QualifiedName;
    specialMember: "constructor" | "destructor" | "conversion" | null;
    declSpecifiers: string[];
    sourceSignature: string;
}
