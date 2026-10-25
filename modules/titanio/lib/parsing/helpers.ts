import type { Applied, BuiltinName, CppType, MainSyntaxNode, Qualifiers, SyntaxNode } from "./types.ts";
import { IRRELEVANT_NODES, NAME_NODES } from "./constants.ts";
import { cpplang, treesitter } from "../../deps.ts";
import { parseFunctionType } from "./parse.ts";

const EXTENDED_CPP_PARSER = await treesitter.createParser(cpplang);

/** Arrays and functions decay to pointers and top-level cv-qualifiers are dropped */
export function decayParamType(type: CppType): CppType {
    if (type.kind === "array")
        return { kind: "pointer", subtype: type.elementType, qualifiers: obtainPlaceholderQualifiers() };
    if (type.kind === "function")
        return { kind: "pointer", subtype: type, qualifiers: obtainPlaceholderQualifiers() };

    return "qualifiers" in type ? { ...type, qualifiers: obtainPlaceholderQualifiers() } : type;
}

/** Walks a declarator from the outside in, wrapping base in the types it describes */
export function applyDeclarator(base: CppType | undefined, decl: SyntaxNode | null): Applied {
    if (!decl) return { type: base };

    let next: CppType | undefined;

    switch (decl.type) {
        case "pointer_declarator":
        case "abstract_pointer_declarator": {
            if (base)
                next = { kind: "pointer", subtype: base, qualifiers: obtainQualifiers(decl.children) };

            return applyDeclarator(next, getInnerNode(decl));
        }

        case "reference_declarator":
        case "abstract_reference_declarator":
        case "variadic_reference_declarator": {
            if (base)
                next = { kind: "reference", referent: base, isRvalue: decl.children.some((c) => c.type === "&&") };

            return applyDeclarator(next, getInnerNode(decl));
        }
        case "array_declarator":
        case "abstract_array_declarator": {
            if (base)
                next = { kind: "array", elementType: base, sizeText: decl.childForFieldName("size")?.text };

            return applyDeclarator(next, getInnerNode(decl));
        }
        case "parenthesized_declarator":
        case "abstract_parenthesized_declarator":
            return applyDeclarator(base, getInnerNode(decl));

        case "variadic_declarator":
            return { ...applyDeclarator(base, getInnerNode(decl)), pack: true };

        case "function_declarator":
        case "abstract_function_declarator":
            return applyDeclarator(parseFunctionType(base, decl), decl.childForFieldName("declarator"));

        default:
            return NAME_NODES.includes(decl.type) ? { type: base, nameNode: decl } : { type: base };
    }
}

/** Whether tree-sitter reported a syntax error anywhere in `node` */
export function nodeHasErrors(node: SyntaxNode): boolean {
    if (typeof node.hasError === "function")
        return node.hasError();

    if (node.hasError) return true;
    if (node.type === "ERROR") return true;

    return node.children.some((node) => nodeHasErrors(node));
}

/** Depth-first search for the first node of `type`, including `node` itself */
export function findFirstNodeOfType(node: SyntaxNode, type: string): SyntaxNode | null {
    if (node.type === type) return node;

    for (const child of node.children) {
        const result = findFirstNodeOfType(child, type);
        if (result) return result;
    }

    return null;
}

/** Collapses whitespace and makes the signature end with exactly one `;` (dropping a `{}` body) */
export function normalizeSignature(signature: string): string {
    signature = signature.replace(/\s+/g, " ").trim();
    signature = signature.replaceAll("{ }", "{}");

    if (signature.endsWith(";")) signature = signature.slice(0, -1).trim();
    if (signature.endsWith("{}")) signature = signature.slice(0, -2).trim();

    return signature.trim() + ";";
}

/** Index right after the template headers: "template <typename T> template <int N> |void foo()" */
function templateHeadersEnd(signature: string): number {
    let index = 0;

    while (true) {
        const header = /^\s*template\s*</.exec(signature.slice(index));

        if (!header) break;

        let depth = 0;
        let i = index + header[0].length - 1;

        for (; i < signature.length; i++) {
            if (signature[i] === "<") depth++;
            if (signature[i] === ">" && --depth === 0) break;
        }

        index = i + 1;
    }

    return index;
}

// The dummy return type goes after the template headers: "template <typename T> void foo<T>(T)"
export function addReturnHack(signature: string): string {
    const index = templateHeadersEnd(signature);

    return `${signature.slice(0, index).trimEnd()} void ${signature.slice(index).trimStart()}`.trim();
}

/** tree-sitter only accepts explicit inside a class, so it's removed */
export function extractExplicit(signature: string): { signature: string; isExplicit: boolean } {
    const index = templateHeadersEnd(signature);
    const rest = signature.slice(index).replace(/^\s*explicit\b\s*/, "");

    if (rest === signature.slice(index))
        return { signature, isExplicit: false };

    return { signature: `${signature.slice(0, index).trimEnd()} ${rest}`.trim(), isExplicit: true };
}

// tree-sitter reads "unsigned __int128" as the type "unsigned" and a parameter named "__int128"
function rewriteBuiltinAliases(signature: string): string {
    return signature.replace(/\bunsigned\s+__int128\b|\b__int128\s+unsigned\b/g, "__uint128_t").replace(
        /\bsigned\s+__int128\b|\b__int128\s+signed\b/g,
        "__int128_t",
    );
}

/** Skips the template headers and returns the function declaration, if there's one */
export function unwrapTemplateDeclarations(root: SyntaxNode): { declaration: SyntaxNode | null; templateParameterList: SyntaxNode | null } {
    let node = root.children.find((child) => isCodeNode(child));
    let templateParameterList: SyntaxNode | null = null;

    // The innermost header holds the parameters of the function itself
    while (node?.type === "template_declaration") {
        templateParameterList = node.childForFieldName("parameters")
            ?? node.children.find((child) => child.type === "template_parameter_list") ?? null;
        node = node.children.filter((child) => isCodeNode(child)).at(-1);
    }

    // Without a return type, "W::~W();" or "W::W();" are valid call expressions
    const isFunction = !!node && node.type !== "expression_statement"
        && !!(findFirstNodeOfType(node, "function_declarator") ?? findFirstNodeOfType(node, "operator_cast"));

    return { declaration: isFunction ? node! : null, templateParameterList };
}

/** Parses the signature with tree-sitter, retries with a dummy void return type */
export function obtainMainSyntaxNode(signature: string): MainSyntaxNode {
    const normalized = rewriteBuiltinAliases(normalizeSignature(signature));

    // Constructors, destructors and conversion operators have no return type, which can confuse tree-sitter
    const candidates = [ { source: normalized, hasReturnHack: false }, { source: addReturnHack(normalized), hasReturnHack: true } ];

    for (const { source, hasReturnHack } of candidates) {
        const root = (EXTENDED_CPP_PARSER.parse(source)?.rootNode ?? null) as unknown as MainSyntaxNode | null;

        if (!root || nodeHasErrors(root) || !unwrapTemplateDeclarations(root).declaration) continue;

        root.signature = source;
        root.hasReturnHack = hasReturnHack;

        return root;
    }

    throw new Error(`Failed to obtain main SyntaxNode from "${signature}"`);
}

/** Parses `source` with tree-sitter as is, null if it has syntax errors */
export function parseCleanSource(source: string): SyntaxNode | null {
    const root = (EXTENDED_CPP_PARSER.parse(source)?.rootNode ?? null) as unknown as SyntaxNode | null;

    return root && !nodeHasErrors(root) ? root : null;
}

/** Whether `node` is actual code rather than whitespace or a comment */
export function isCodeNode(node: SyntaxNode): boolean {
    return node.type !== "whitespace" && node.type !== "comment";
}

/** Any spelling of a fundamental type (long unsigned int, _Bool...) to its BuiltinName */
export function normalizeBuiltin(text: string): BuiltinName | null {
    const sections = text.split(/\s+/).filter((sec) => sec.length);
    const longCount = sections.filter((sec) => sec === "long").length;
    const explicitSign = sections.includes("unsigned") ? "unsigned" : sections.includes("signed") ? "signed" : "";
    const isExplicitUnsigned = explicitSign === "unsigned";
    const isExplicitSigned = explicitSign === "signed";

    switch (true) {
        case sections.length === 1 && sections[0] === "__int128_t":
            return "__int128";
        case sections.length === 1 && sections[0] === "__uint128_t":
            return "unsigned __int128";
        case sections.includes("void"):
            return "void";
        case sections.includes("bool") || sections.includes("_Bool"):
            return "bool";
        case sections.includes("wchar_t"):
            return "wchar_t";
        case sections.includes("char8_t"):
            return "char8_t";
        case sections.includes("char16_t"):
            return "char16_t";
        case sections.includes("char32_t"):
            return "char32_t";
        case sections.includes("float"):
            return "float";
        case sections.includes("char"):
            return isExplicitUnsigned ? "unsigned char" : isExplicitSigned ? "signed char" : "char";
        case sections.includes("double"):
            return longCount ? "long double" : "double";
        case sections.includes("__int128"):
            return isExplicitUnsigned ? "unsigned __int128" : "__int128";
        case sections.includes("__float128"):
            return "__float128";
        case sections.includes("short"):
            return isExplicitUnsigned ? "unsigned short" : "short";
        case longCount >= 2:
            return isExplicitUnsigned ? "unsigned long long" : "long long";
        case longCount === 1:
            return isExplicitUnsigned ? "unsigned long" : "long";
        case sections.includes("int") || explicitSign !== "":
            return isExplicitUnsigned ? "unsigned int" : "int";
        default:
            return null;
    }
}

/** Returns a fresh, unqualified `Qualifiers` object */
export function obtainPlaceholderQualifiers(): Qualifiers {
    return { isConst: false, isVolatile: false, isRestrict: false };
}

/** Collects the cv/restrict qualifiers among `nodes` */
export function obtainQualifiers(nodes: SyntaxNode[]): Qualifiers {
    const qualifiers = { isConst: false, isVolatile: false, isRestrict: false };

    for (const node of nodes) {
        if (node.type !== "type_qualifier") continue;

        switch (node.text.trim()) {
            case "const":
                qualifiers.isConst = true;
                break;

            case "volatile":
                qualifiers.isVolatile = true;
                break;

            case "restrict":
            case "__restrict":
            case "__restrict__":
                qualifiers.isRestrict = true;
                break;
        }
    }

    return qualifiers;
}

/** Returns the next declarator nested in `node`, skipping punctuation and qualifiers */
export function getInnerNode(node: SyntaxNode): SyntaxNode | null {
    return node.childForFieldName("declarator") ?? node.children.find((child) => !IRRELEVANT_NODES.includes(child.type)) ?? null;
}
