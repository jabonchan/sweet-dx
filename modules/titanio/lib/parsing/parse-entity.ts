import { applyDeclarator, isCodeNode, normalizeSignature, obtainPlaceholderQualifiers, parseCleanSource } from "./helpers.ts";
import type { CppType, ParsedEntity, QualifiedName, TypeSpecialPrefix } from "./types.ts";
import { parseName, parseTypeDescriptor } from "./parse.ts";
import { Recuerdo } from "../../deps.ts";

const PARSED_CACHE = new Map<string, ParsedEntity>();

// c++filt spellings, "typeinfo name for" goes before "typeinfo for"
const TYPE_SPECIAL_NAMES: { pattern: RegExp; prefix: TypeSpecialPrefix }[] = [
    { pattern: /^vtable for (.+)$/, prefix: "TV" },
    { pattern: /^VTT for (.+)$/, prefix: "TT" },
    { pattern: /^typeinfo name for (.+)$/, prefix: "TS" },
    { pattern: /^typeinfo for (.+)$/, prefix: "TI" },
];

const GUARD_VARIABLE = /^guard variable for (.+)$/;

/** Parses a variable (`Foo::bar`, the type is optional) or a special name like `vtable for Foo`, cached */
export function parseEntity(text: string): ParsedEntity {
    const normalized = normalizeSignature(text);

    if (PARSED_CACHE.has(normalized)) {
        Recuerdo.info(`Using cache for entity "${text}"`);
        return PARSED_CACHE.get(normalized)!;
    }

    const source = normalized.slice(0, -1);
    const guard = GUARD_VARIABLE.exec(source);
    let entity: ParsedEntity | null = null;

    for (const { pattern, prefix } of TYPE_SPECIAL_NAMES) {
        const match = pattern.exec(source);

        if (match) {
            entity = { kind: "typeSpecial", prefix, type: parseTypeName(match[1]), sourceSignature: normalized };
            break;
        }
    }

    entity ??= guard
        ? { kind: "guard", name: parseVariableName(guard[1]), sourceSignature: normalized }
        : { kind: "variable", name: parseVariableName(source), sourceSignature: normalized };

    PARSED_CACHE.set(normalized, entity);

    return entity;
}

/** A type on its own, read as `using T = <text>;` */
export function parseTypeName(text: string): CppType {
    const root = parseCleanSource(`using __titanio_type = ${text};`);
    const alias = root?.children.find((child) => isCodeNode(child));
    const type = alias?.type === "alias_declaration" ? alias.childForFieldName("type") : null;

    if (!type)
        throw new Error(`"${text}" is not a type`);

    return parseTypeDescriptor(type);
}

/** The name of a variable declaration, its type isn't part of the symbol */
export function parseVariableName(text: string): QualifiedName {
    // A bare name parses as an expression, so it gets a dummy type
    for (const source of [ `${text};`, `int ${text};` ]) {
        const declaration = parseCleanSource(source)?.children.find((child) => isCodeNode(child));

        if (declaration?.type !== "declaration") continue;

        let declarator = declaration.childForFieldName("declarator");

        if (declarator?.type === "init_declarator") declarator = declarator.childForFieldName("declarator");

        // The dummy base tells `void (*cb)(int)` (a variable) apart from `void f(int)` (a function)
        const { type, nameNode } = applyDeclarator({ kind: "builtin", name: "int", qualifiers: obtainPlaceholderQualifiers() }, declarator);

        if (!nameNode || type?.kind === "function") continue;

        const name = parseName(nameNode);

        if (name.segments.at(-1)?.kind === "identifier") return name;
    }

    throw new Error(`"${text}" is not a variable name`);
}
