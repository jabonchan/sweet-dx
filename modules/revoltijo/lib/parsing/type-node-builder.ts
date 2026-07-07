import type { SyntaxNode } from "./cpp-parser.ts";
import { directChildrenOfType, hasDirectChildOfType, innerDeclarator, namedChildren } from "./tree-helpers.ts";

import {
    ArrayType,
    FunctionType,
    MemberPointerType,
    NamedType,
    NullptrType,
    PointerType,
    PrimitiveType,
    ReferenceType,
    TemplateArgumentNode,
    TypeNode,
    ValueArgument,
} from "../ast/type-node.ts";

function applyCv(node: TypeNode, cv: readonly string[]): TypeNode {
    if (!cv.length) return node;
    if (node instanceof PrimitiveType) return new PrimitiveType(node.name, [...node.cv, ...cv]);
    if (node instanceof NamedType) return new NamedType(node.namespaces, node.name, node.templateArgs, [...node.cv, ...cv]);
    return node;
}

export function buildBaseType(node: SyntaxNode): TypeNode {
    switch (node.type) {
        case "primitive_type":
        case "sized_type_specifier":
            return new PrimitiveType(node.text);

        case "qualified_identifier":
            return buildQualifiedType(node);

        case "template_type":
            return buildTemplateType([], node);

        case "type_identifier":
        case "identifier":
            return new NamedType([], node.text, null);

        default:
            throw new Error(`Unsupported base type node "${node.type}": ${node.text}`);
    }
}

function buildTemplateType(namespaces: readonly string[], node: SyntaxNode): NamedType {
    const name = node.childForFieldName("name").text;
    const argumentsNode = node.childForFieldName("arguments");
    const templateArgs = argumentsNode ? buildTemplateArgs(argumentsNode) : [];

    return new NamedType(namespaces, name, templateArgs);
}

function buildQualifiedType(node: SyntaxNode): TypeNode {
    const scopeSegments: SyntaxNode[] = [];
    let current = node;

    while (current.type === "qualified_identifier") {
        scopeSegments.push(current.childForFieldName("scope"));
        current = current.childForFieldName("name");
    }

    const namespaces: string[] = [];

    for (const segment of scopeSegments) {
        if (segment.type === "template_type") {
            throw new Error(
                `A class-template-qualified type reference ("${segment.text}::...") is not supported as a plain ` +
                    `parameter type — only a function's own directly-enclosing class template is supported.`,
            );
        }

        namespaces.push(segment.text);
    }

    if ([...namespaces, current.text].join("::") === "std::nullptr_t") {
        return new NullptrType();
    }

    if (current.type === "template_type") {
        return buildTemplateType(namespaces, current);
    }

    return new NamedType(namespaces, current.text, null);
}

export function buildTemplateArgs(argumentListNode: SyntaxNode): TemplateArgumentNode[] {
    return namedChildren(argumentListNode).map((child) =>
        child.type === "type_descriptor" ? buildTypeDescriptor(child) : new ValueArgument(child.text)
    );
}

export function buildTypeDescriptor(node: SyntaxNode): TypeNode {
    const cv = directChildrenOfType(node, "type_qualifier").map((n) => n.text);
    const base = applyCv(buildBaseType(node.childForFieldName("type")), cv);
    const declaratorNode = node.childForFieldName("declarator");

    return declaratorNode ? walkDeclarator(declaratorNode, base).type : base;
}

export function buildParameterType(node: SyntaxNode): TypeNode {
    const cv = directChildrenOfType(node, "type_qualifier").map((n) => n.text);
    const base = applyCv(buildBaseType(node.childForFieldName("type")), cv);
    const declaratorNode = node.childForFieldName("declarator");

    return declaratorNode ? walkDeclarator(declaratorNode, base).type : base;
}

export interface DeclaratorResult {
    type: TypeNode;
    name: string | null;
}

export function walkDeclarator(node: SyntaxNode, currentType: TypeNode): DeclaratorResult {
    switch (node.type) {
        case "identifier":
        case "type_identifier":
            return { type: currentType, name: node.text };

        case "pointer_declarator":
        case "abstract_pointer_declarator": {
            const cv = directChildrenOfType(node, "type_qualifier").map((n) => n.text);
            const wrapped = new PointerType(currentType, cv);
            const inner = innerDeclarator(node);
            return inner ? walkDeclarator(inner, wrapped) : { type: wrapped, name: null };
        }

        case "reference_declarator":
        case "abstract_reference_declarator": {
            const rvalue = node.child(0)?.text === "&&";
            const wrapped = new ReferenceType(currentType, rvalue);
            const inner = innerDeclarator(node);
            return inner ? walkDeclarator(inner, wrapped) : { type: wrapped, name: null };
        }

        case "array_declarator":
        case "abstract_array_declarator": {
            const sizeNode = node.childForFieldName("size");
            const wrapped = new ArrayType(currentType, sizeNode ? sizeNode.text : null);
            const inner = innerDeclarator(node);
            return inner ? walkDeclarator(inner, wrapped) : { type: wrapped, name: null };
        }

        case "function_declarator":
        case "abstract_function_declarator": {
            const parameterListNode = node.childForFieldName("parameters");
            const parameters = namedChildren(parameterListNode)
                .filter((n) => n.type === "parameter_declaration" || n.type === "optional_parameter_declaration")
                .map((n) => buildParameterType(n));
            const cv = directChildrenOfType(node, "type_qualifier").map((n) => n.text);
            const isNoexcept = hasDirectChildOfType(node, "noexcept");
            const wrapped = new FunctionType(currentType, parameters, cv, isNoexcept);
            const inner = innerDeclarator(node);
            return inner ? walkDeclarator(inner, wrapped) : { type: wrapped, name: null };
        }

        case "parenthesized_declarator":
        case "abstract_parenthesized_declarator": {
            const inner = innerDeclarator(node);
            return inner ? walkDeclarator(inner, currentType) : { type: currentType, name: null };
        }

        case "qualified_identifier":
            return buildMemberPointerDeclarator(node, currentType);

        default:
            throw new Error(`Unsupported declarator node "${node.type}": ${node.text}`);
    }
}

function buildMemberPointerDeclarator(node: SyntaxNode, currentType: TypeNode): DeclaratorResult {
    const scopeSegments: SyntaxNode[] = [];
    let current = node;

    while (current.type === "qualified_identifier") {
        scopeSegments.push(current.childForFieldName("scope"));
        current = current.childForFieldName("name");
    }

    if (current.type !== "pointer_type_declarator") {
        throw new Error(`Unsupported member-pointer declarator shape ("${current.type}"): ${node.text}`);
    }

    const namespaces = scopeSegments.slice(0, -1).map((s) => s.text);
    const lastSegment = scopeSegments[scopeSegments.length - 1];
    const classType = new NamedType(namespaces, lastSegment.text, null);

    const memberDeclarator = current.childForFieldName("declarator");
    const wrapped = new MemberPointerType(classType, currentType);

    return memberDeclarator ? walkDeclarator(memberDeclarator, wrapped) : { type: wrapped, name: null };
}
