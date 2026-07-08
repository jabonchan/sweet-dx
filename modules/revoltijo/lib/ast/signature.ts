import { TemplateArgumentNode, TypeNode } from "./type-node.ts";

export class Parameter {
    constructor(public readonly type: TypeNode) {}
}

export class EnclosingScope {
    constructor(
        public readonly name: string,
        public readonly templateArgs: readonly TemplateArgumentNode[] | null,
    ) {}
}

export class FunctionSignature {
    constructor(
        public readonly namespaces: readonly string[],
        public readonly enclosingClasses: readonly EnclosingScope[],
        public readonly functionName: string,
        public readonly isOperator: boolean,
        public readonly explicitTemplateArgs: readonly TemplateArgumentNode[] | null,
        public readonly parameters: readonly Parameter[],
        public readonly cvQualifiers: readonly string[],
        public readonly refQualifier: "&" | "&&" | null,
        public readonly isNoexcept: boolean,
        public readonly isConstructor: boolean = false,
    ) {}
}
