import type { SyntaxNode } from "./cpp-parser.ts";

export function namedChildren(node: SyntaxNode): SyntaxNode[] {
    const result: SyntaxNode[] = [];

    for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.isNamed) result.push(child);
    }

    return result;
}

export function directChildrenOfType(node: SyntaxNode, type: string): SyntaxNode[] {
    return namedChildren(node).filter((child) => child.type === type);
}

export function hasDirectChildOfType(node: SyntaxNode, type: string): boolean {
    return namedChildren(node).some((child) => child.type === type);
}

export function innerDeclarator(node: SyntaxNode): SyntaxNode | null {
    const viaField = node.childForFieldName("declarator");
    if (viaField) return viaField;

    const candidates = namedChildren(node).filter((child) => child.type !== "type_qualifier");
    return candidates.length ? candidates[candidates.length - 1] : null;
}
