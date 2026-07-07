import { FunctionSignature } from "../ast/signature.ts";
import { ArrayType, NamedType, TypeNode, ValueArgument } from "../ast/type-node.ts";
import { DeclarationTree } from "./declaration-tree.ts";

const BARE_IDENTIFIER = /^[A-Za-z_]\w*$/;

export class TypeRegistry {
    readonly root = new DeclarationTree();

    registerSignature(signature: FunctionSignature): void {
        const nodes = [
            ...signature.enclosingClasses.flatMap((scope) => scope.templateArgs ?? []),
            ...signature.parameters.map((parameter) => parameter.type),
            ...(signature.explicitTemplateArgs ?? []),
        ];

        for (const node of nodes) this.collectValues(node);
        for (const node of nodes) this.collectTypes(node);
    }

    private collectValues(node: TypeNode): void {
        if (node instanceof ArrayType && node.size && BARE_IDENTIFIER.test(node.size)) {
            this.root.addValue(node.size);
        } else if (node instanceof ValueArgument && BARE_IDENTIFIER.test(node.expression)) {
            this.root.addValue(node.expression);
        }

        for (const child of node.children()) this.collectValues(child);
    }

    private collectTypes(node: TypeNode): void {
        if (node instanceof NamedType) {
            const isBareValue = node.namespaces.length === 0 && node.templateArgs === null && this.root.hasValue(node.name);

            if (!isBareValue) {
                let scope = this.root;
                for (const namespaceSegment of node.namespaces) scope = scope.getOrCreateNamespace(namespaceSegment);
                scope.addStub(node.name, node.templateArgs ? node.templateArgs.length : null);
            }
        }

        for (const child of node.children()) this.collectTypes(child);
    }
}
