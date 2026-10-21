import {
    applyDeclarator,
    extractExplicit,
    findFirstNodeOfType,
    normalizeBuiltin,
    normalizeSignature,
    obtainMainSyntaxNode,
    obtainPlaceholderQualifiers,
    obtainQualifiers,
    unwrapTemplateDeclarations,
} from "./helpers.ts";
import type {
    Applied,
    CppType,
    FunctionType,
    NameSegment,
    Parameter,
    ParsedSignature,
    QualifiedName,
    Qualifiers,
    SyntaxNode,
    TemplateArgument,
    TemplateParameter,
} from "./types.ts";
import { FUNCTION_SPECIFIERS } from "./constants.ts";
import { Recuerdo } from "../../deps.ts";

const PARSED_CACHE = new Map<string, ParsedSignature>();

/** Parses a `template<...>` parameter list into type, non-type and template template parameters. */
export function parseTemplateParams(list: SyntaxNode): TemplateParameter[] {
    const out: TemplateParameter[] = [];

    for (const child of list.children) {
        switch (child.type) {
            case "type_parameter_declaration":
            case "optional_type_parameter_declaration":
            case "variadic_type_parameter_declaration":
                out.push({
                    kind: "type",
                    name: child.children.find((subChild) =>
                        subChild.type === "type_identifier"
                    )?.text,
                    isPack:
                        child.type === "variadic_type_parameter_declaration",
                });

                break;

            case "template_template_parameter_declaration":
                out.push({
                    kind: "template",
                    name: child.children.find((subChild) =>
                        subChild.type === "type_identifier"
                    )?.text,
                    isPack: false,
                });

                break;
            case "parameter_declaration":
            case "optional_parameter_declaration":
            case "variadic_parameter_declaration": {
                const parameter = parseParameter(child);

                out.push({
                    kind: "nonType",
                    name: parameter.name,
                    isPack: parameter.isPack,
                    valueType: parameter.type,
                });
            }
        }
    }

    return out;
}

/** Parses a type with no name attached, like a template argument or a trailing return type. */
export function parseTypeDescriptor(node: SyntaxNode): CppType {
    const type = node.childForFieldName("type");
    const base: CppType = type
        ? parseSpecifierType(type, obtainQualifiers(node.children))
        : {
            kind: "unknown",
            sourceText: node.text,
            treeSitterNodeType: node.type,
            qualifiers: obtainPlaceholderQualifiers(),
        };

    return applyDeclarator(base, node.childForFieldName("declarator")).type ??
        base;
}

/** Parses a single function parameter: its type, optional name, pack-ness and default value. */
export function parseParameter(node: SyntaxNode): Parameter {
    const type = node.childForFieldName("type");
    const base: CppType = type
        ? parseSpecifierType(type, obtainQualifiers(node.children))
        : {
            kind: "unknown",
            sourceText: node.text,
            treeSitterNodeType: node.type,
            qualifiers: obtainPlaceholderQualifiers(),
        };
    const applied = applyDeclarator(base, node.childForFieldName("declarator"));

    return {
        type: applied.type ?? base,
        name: applied.nameNode?.text,
        isPack: node.type === "variadic_parameter_declaration" ||
            !!applied.pack,
        defaultValueText: node.childForFieldName("default_value")?.text,
    };
}

/** Parses a parameter list, noting a trailing C-style `...`. */
export function parseParameters(
    list: SyntaxNode,
): { parameters: Parameter[]; hasCEllipsis: boolean } {
    const parameters: Parameter[] = [];
    let hasCEllipsis = false;

    for (const child of list.children) {
        switch (child.type) {
            case "...":
                hasCEllipsis = true;
                break;

            case "parameter_declaration":
            case "optional_parameter_declaration":
            case "variadic_parameter_declaration":
                parameters.push(parseParameter(child));
        }
    }

    // `f(void)` means no parameters.
    if (
        parameters.length === 1 && !parameters[0].name &&
        parameters[0].type.kind === "builtin" &&
        parameters[0].type.name === "void"
    ) parameters.pop();

    return { parameters, hasCEllipsis };
}

/**
 * Builds a function type from a function declarator. `ret` is the leading
 * return type, which a trailing `-> T` overrides.
 */
export function parseFunctionType(
    ret: CppType | undefined,
    decl: SyntaxNode,
): FunctionType {
    let returnType = ret;

    const list = decl.childForFieldName("parameters");
    const { parameters, hasCEllipsis } = list
        ? parseParameters(list)
        : { parameters: [], hasCEllipsis: false };
    const trailing = decl.children.find((child) =>
        child.type === "trailing_return_type"
    );
    const typeDescriptor = trailing?.children.find((child) =>
        child.type === "type_descriptor"
    );
    const refQualifier = decl.children.find((child) =>
        child.type === "ref_qualifier"
    );

    if (typeDescriptor) returnType = parseTypeDescriptor(typeDescriptor);

    return {
        kind: "function",
        returnType,
        parameters,
        hasCEllipsis,
        qualifiers: obtainQualifiers(decl.children),
        refQualifier: refQualifier
            ? (refQualifier.text.trim() as "&" | "&&")
            : undefined,
        isNoexcept: decl.children.some((child) =>
            child.type === "noexcept" || child.type === "throw_specifier"
        ),
    };
}

/** Parses the arguments between `<` and `>` into types or expressions. */
export function parseTemplateArguments(list: SyntaxNode): TemplateArgument[] {
    const args: TemplateArgument[] = [];

    for (const child of list.children) {
        switch (child.type) {
            case "<":
            case ">":
            case ",":
            case "whitespace":
            case "comment":
                break;

            case "type_descriptor":
                args.push({ kind: "type", type: parseTypeDescriptor(child) });
                break;

            case "primitive_type":
            case "sized_type_specifier":
            case "template_type":
            case "type_identifier":
                args.push({
                    kind: "type",
                    type: parseSpecifierType(
                        child,
                        obtainPlaceholderQualifiers(),
                    ),
                });
                break;

            // A bare name could be a type or a constant: decided later, during mangling.
            case "identifier":
            case "qualified_identifier":
                args.push({
                    kind: "type",
                    type: parseSpecifierType(
                        child,
                        obtainPlaceholderQualifiers(),
                    ),
                    mightBeValue: true,
                });
                break;

            default:
                args.push({
                    kind: "expression",
                    sourceText: child.text,
                    integerValue: /^-?\d+$/.test(child.text)
                        ? Number(child.text)
                        : null,
                });
        }
    }

    return args;
}

/** Turns a type specifier node (builtin, named, elaborated, `auto`, `decltype`...) into a `CppType`. */
export function parseSpecifierType(
    node: SyntaxNode,
    qualifiers: Qualifiers,
): CppType {
    switch (node.type) {
        case "primitive_type":
        case "sized_type_specifier": {
            const name = normalizeBuiltin(node.text);

            if (name) return { kind: "builtin", name, qualifiers };

            return {
                kind: "named",
                qualifiers,
                name: {
                    hasLeadingScopeOperator: false,
                    segments: [{ kind: "identifier", text: node.text }],
                },
            };
        }

        case "type_identifier": {
            // tree-sitter doesn't know some builtin types: wchar_t, __int128, __uint128_t...
            const name = normalizeBuiltin(node.text);

            if (name) return { kind: "builtin", name, qualifiers };

            return { kind: "named", name: parseName(node), qualifiers };
        }

        case "namespace_identifier":
        case "qualified_identifier":
        case "template_type":
            return { kind: "named", name: parseName(node), qualifiers };

        case "struct_specifier":
        case "class_specifier":
        case "union_specifier":
        case "enum_specifier": {
            const name = node.childForFieldName("name");

            if (!name) break;

            return {
                kind: "named",
                name: parseName(name),
                qualifiers,
                elaboratedKeyword: node.type.replace("_specifier", "").trim() as
                    | "struct"
                    | "class"
                    | "union"
                    | "enum",
            };
        }

        case "placeholder_type_specifier":
            return { kind: "auto", qualifiers };

        case "decltype":
            return {
                kind: "decltype",
                expressionText: node.text,
                qualifiers,
            };
    }

    return {
        kind: "unknown",
        sourceText: node.text,
        treeSitterNodeType: node.type,
        qualifiers,
    };
}

/** Splits a (possibly qualified, possibly templated) name node into its segments. */
export function parseName(node: SyntaxNode): QualifiedName {
    const segments: NameSegment[] = [];

    const walk = (subNode: SyntaxNode | null) => {
        if (!subNode) return;

        switch (subNode.type) {
            case "qualified_identifier":
                walk(subNode.childForFieldName("scope"));
                walk(subNode.childForFieldName("name"));
                return;

            case "template_type":
            case "template_function":
            case "template_method": {
                // The template arguments belong to the segment the name just added, if it added one.
                const originalSize = segments.length;
                const args = subNode.childForFieldName("arguments");

                walk(subNode.childForFieldName("name"));

                const updatedSize = segments.length;
                const increased = updatedSize > originalSize;

                if (args && increased) {
                    segments.at(-1)!.templateArguments = parseTemplateArguments(
                        args,
                    );
                }

                return;
            }
            case "destructor_name":
                segments.push({
                    kind: "destructor",
                    text: subNode.text.replace(/^~\s*/, ""),
                });
                return;

            case "operator_name":
                segments.push({
                    kind: "operator",
                    text: subNode.text.replace(/^operator\s*/, ""),
                });
                return;

            case "operator_cast":
                segments.push({
                    kind: "conversion",
                    text: "",
                    conversionTargetType: parseConversion(subNode).targetType,
                });
                return;

            default:
                segments.push({ kind: "identifier", text: subNode.text });
        }
    };

    walk(node);

    return {
        hasLeadingScopeOperator: node.text.startsWith("::"),
        segments,
    };
}

/**
 * tree-sitter puts the whole declarator of a conversion operator inside the `operator_cast` node:
 * in "operator ns::Tag const*() const" the declarator is `*() const`, a function returning the target type.
 */
export function parseConversion(
    node: SyntaxNode,
): { targetType?: CppType; functionType?: FunctionType } {
    const type = node.childForFieldName("type");

    if (!type) return {};

    const base = parseSpecifierType(type, obtainQualifiers(node.children));
    const applied = applyDeclarator(base, node.childForFieldName("declarator"));

    if (applied.type?.kind === "function") {
        return {
            targetType: applied.type.returnType,
            functionType: applied.type,
        };
    }

    return { targetType: applied.type };
}

/** Returns the `operator_cast` node at the end of a (possibly qualified) name. */
function findConversion(node: SyntaxNode | null): SyntaxNode | null {
    if (!node) return null;
    if (node.type === "operator_cast") return node;
    if (node.type === "qualified_identifier") {
        return findConversion(node.childForFieldName("name"));
    }

    return null;
}

/**
 * Parses a C++ function signature into a `ParsedSignature`, detecting
 * constructors, destructors and conversion operators. Results are cached by
 * the normalized signature.
 */
export function parseSignature(signature: string): ParsedSignature {
    const normalized = normalizeSignature(signature);

    if (PARSED_CACHE.has(normalized)) {
        Recuerdo.info(`Using cache for signature "${signature}"`);
        return PARSED_CACHE.get(normalized)!;
    }

    const { signature: parsable, isExplicit } = extractExplicit(normalized);
    const mainSyntaxNode = obtainMainSyntaxNode(parsable);
    const { declaration: node, templateParameterList } =
        unwrapTemplateDeclarations(mainSyntaxNode);

    if (!node) {
        throw new Error(`Failed to find a declaration inside "${signature}"`);
    }

    const templateParameters: TemplateParameter[] = templateParameterList
        ? parseTemplateParams(templateParameterList)
        : [];
    const specifiers: string[] = isExplicit ? ["explicit"] : [];
    const declNode = node.childForFieldName("declarator");
    let applied: Applied;

    if (declNode) {
        // The dummy return type of the hack is not part of the signature
        const typeNode = mainSyntaxNode.hasReturnHack
            ? null
            : node.childForFieldName("type");
        const base = typeNode
            ? parseSpecifierType(typeNode, obtainQualifiers(node.children))
            : undefined;

        for (const child of node.children) {
            if (!FUNCTION_SPECIFIERS.includes(child.type)) continue;

            specifiers.push(child.text.trim());
        }

        applied = applyDeclarator(base, declNode);
    } else {
        applied = applyDeclarator(
            undefined,
            findFirstNodeOfType(node, "function_declarator"),
        );
    }

    const conversion = findConversion(applied.nameNode ?? null);

    if (conversion && applied.type?.kind !== "function") {
        const { functionType } = parseConversion(conversion);

        if (functionType) applied = { ...applied, type: functionType };
    }

    const functionType = applied.type;

    if (
        !functionType || !applied.nameNode || functionType?.kind !== "function"
    ) {
        throw new Error(`"${signature}" is not a function signature`);
    }

    const name = parseName(applied.nameNode);
    const segments = name.segments;
    const last = segments.at(-1);

    let special: ParsedSignature["specialMember"] = null;

    if (!last) {
        throw new Error(
            `Empty segments inside function declaration in "${signature}"`,
        );
    }

    switch (true) {
        case last.kind === "destructor":
            special = "destructor";
            break;

        case last.kind === "conversion":
            special = "conversion";
            break;

        // No return type and the name repeats the class name: `Foo::Foo(...)`.
        case !functionType.returnType && last.kind === "identifier" &&
            segments.length >= 2 && segments.at(-2)!.text === last.text:
            special = "constructor";
    }

    // Itanium only encodes "a destructor" (D0/D1/D2): its name always demangles as the enclosing class
    if (
        special === "destructor" && segments.length >= 2 &&
        segments.at(-2)!.text !== last.text
    ) {
        Recuerdo.warn(
            `Destructor "~${last.text}" doesn't match its class "${
                segments.at(-2)!.text
            }" in "${signature}", it will demangle as "~${
                segments.at(-2)!.text
            }"`,
        );
    }

    const parsedSignature = {
        ...functionType,
        templateParameters,
        specialMember: special,
        qualifiedName: name,
        declSpecifiers: specifiers,
        sourceSignature: normalized,
    };

    PARSED_CACHE.set(normalized, parsedSignature);

    return parsedSignature;
}
