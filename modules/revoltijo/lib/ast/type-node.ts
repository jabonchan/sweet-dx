import { Declarator } from "./declarator.ts";

function renderCv(cv: readonly string[]): string {
    return cv.length ? cv.join(" ") + " " : "";
}

export abstract class TypeNode {
    abstract render(declarator?: Declarator): string;
    abstract children(): readonly TypeNode[];
}

function renderLeaf(base: string, declarator?: Declarator): string {
    return declarator ? `${base} ${declarator.text}` : base;
}

export class PrimitiveType extends TypeNode {
    constructor(
        public readonly name: string,
        public readonly cv: readonly string[] = [],
    ) {
        super();
    }

    render(declarator?: Declarator): string {
        return renderLeaf(`${renderCv(this.cv)}${this.name}`, declarator);
    }

    children(): readonly TypeNode[] {
        return [];
    }
}

export class NullptrType extends TypeNode {
    render(declarator?: Declarator): string {
        return renderLeaf("decltype(nullptr)", declarator);
    }

    children(): readonly TypeNode[] {
        return [];
    }
}

export class ValueArgument extends TypeNode {
    constructor(public readonly expression: string) {
        super();
    }

    render(): string {
        return this.expression;
    }

    children(): readonly TypeNode[] {
        return [];
    }
}

export type TemplateArgumentNode = TypeNode;

export class NamedType extends TypeNode {
    constructor(
        public readonly namespaces: readonly string[],
        public readonly name: string,
        public readonly templateArgs: readonly TemplateArgumentNode[] | null,
        public readonly cv: readonly string[] = [],
    ) {
        super();
    }

    get qualifiedName(): string {
        return [...this.namespaces, this.name].join("::");
    }

    render(declarator?: Declarator): string {
        let base = this.qualifiedName;

        if (this.templateArgs) {
            base += `<${this.templateArgs.map((arg) => arg.render()).join(", ")}>`;
        }

        return renderLeaf(`${renderCv(this.cv)}${base}`, declarator);
    }

    children(): readonly TypeNode[] {
        return this.templateArgs ?? [];
    }
}

export class PointerType extends TypeNode {
    constructor(
        public readonly pointee: TypeNode,
        public readonly cv: readonly string[] = [],
    ) {
        super();
    }

    render(declarator?: Declarator): string {
        const base = declarator ?? Declarator.bare("");
        const cv = this.cv.length ? " " + this.cv.join(" ") : "";
        return this.pointee.render(base.withPrefix(`*${cv}`));
    }

    children(): readonly TypeNode[] {
        return [this.pointee];
    }
}

export class ReferenceType extends TypeNode {
    constructor(
        public readonly pointee: TypeNode,
        public readonly rvalue: boolean,
    ) {
        super();
    }

    render(declarator?: Declarator): string {
        const base = declarator ?? Declarator.bare("");
        return this.pointee.render(base.withPrefix(this.rvalue ? "&&" : "&"));
    }

    children(): readonly TypeNode[] {
        return [this.pointee];
    }
}

export class ArrayType extends TypeNode {
    constructor(
        public readonly element: TypeNode,
        public readonly size: string | null,
    ) {
        super();
    }

    render(declarator?: Declarator): string {
        const base = declarator ?? Declarator.bare("");
        return this.element.render(base.withSuffix(`[${this.size ?? ""}]`));
    }

    children(): readonly TypeNode[] {
        return [this.element];
    }
}

export class FunctionType extends TypeNode {
    constructor(
        public readonly returnType: TypeNode,
        public readonly parameters: readonly TypeNode[],
        public readonly cv: readonly string[] = [],
        public readonly isNoexcept: boolean = false,
    ) {
        super();
    }

    render(declarator?: Declarator): string {
        const base = declarator ?? Declarator.bare("");
        const params = this.parameters.map((param) => param.render()).join(", ");
        const cv = this.cv.length ? " " + this.cv.join(" ") : "";
        const noexcept = this.isNoexcept ? " noexcept" : "";

        return this.returnType.render(base.withSuffix(`(${params})${cv}${noexcept}`));
    }

    children(): readonly TypeNode[] {
        return [this.returnType, ...this.parameters];
    }
}

export class MemberPointerType extends TypeNode {
    constructor(
        public readonly classType: NamedType,
        public readonly pointee: TypeNode,
    ) {
        super();
    }

    render(declarator?: Declarator): string {
        const base = declarator ?? Declarator.bare("");
        return this.pointee.render(base.withPrefix(`${this.classType.render()}::*`));
    }

    children(): readonly TypeNode[] {
        return [this.classType, this.pointee];
    }
}

export function renderType(node: TypeNode, name?: string): string {
    return node.render(name !== undefined ? Declarator.bare(name) : undefined);
}
