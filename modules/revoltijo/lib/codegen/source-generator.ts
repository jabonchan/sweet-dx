import { EnclosingScope, FunctionSignature } from "../ast/signature.ts";
import { NamedType, renderType, TemplateArgumentNode } from "../ast/type-node.ts";
import { TypeRegistry } from "./type-registry.ts";

function templateHeaderFor(args: readonly TemplateArgumentNode[], registry: TypeRegistry, prefix: string): string {
    const params = args.map((arg, i) => {
        const isBareValue = arg instanceof NamedType && arg.namespaces.length === 0 && arg.templateArgs === null &&
            registry.root.hasValue(arg.name);
        return isBareValue ? `long ${prefix}${i}` : `typename ${prefix}${i}`;
    });

    return `template<${params.join(", ")}>`;
}

function renderArgs(args: EnclosingScope["templateArgs"]): string {
    return (args ?? []).map((arg) => renderType(arg)).join(", ");
}

export class SourceGenerator {
    generate(signature: FunctionSignature): string {
        const registry = new TypeRegistry();
        registry.registerSignature(signature);

        const enclosingClass = signature.enclosingClasses[0] ?? null;

        if (signature.isConstructor && !enclosingClass) {
            throw new Error(`Constructor "${signature.functionName}" is missing its enclosing class.`);
        }

        const paramsRendered = signature.parameters.map((parameter) => renderType(parameter.type)).join(", ");
        const qualifierSuffix = SourceGenerator.renderQualifierSuffix(signature);
        const returnTypePrefix = signature.isConstructor ? "" : "void ";

        const memberTemplateArity = signature.explicitTemplateArgs?.length ?? null;
        const memberDeclarationLines = [
            ...(signature.explicitTemplateArgs
                ? [templateHeaderFor(signature.explicitTemplateArgs, registry, "RevoltijoArg")]
                : []),
            `${returnTypePrefix}${signature.functionName}(${paramsRendered})${qualifierSuffix};`,
        ];

        const declarationBody = SourceGenerator.renderEnclosingClassDeclaration(enclosingClass, memberDeclarationLines, registry);
        const declarationSection = SourceGenerator.wrapInNamespaces(signature.namespaces, declarationBody.join("\n"));

        const enclosingClassRef = enclosingClass
            ? `${enclosingClass.name}${enclosingClass.templateArgs ? `<${renderArgs(enclosingClass.templateArgs)}>` : ""}`
            : null;
        const explicitArgsSuffix = signature.explicitTemplateArgs ? `<${renderArgs(signature.explicitTemplateArgs)}>` : "";
        const qualifiedFunctionName = [
            ...signature.namespaces,
            ...(enclosingClassRef ? [enclosingClassRef] : []),
            `${signature.functionName}${explicitArgsSuffix}`,
        ].join("::");

        const definitionSection = [
            ...(memberTemplateArity !== null ? ["template<>"] : []),
            `${returnTypePrefix}${qualifiedFunctionName}(${paramsRendered})${qualifierSuffix} {}`,
        ].join("\n");

        return [registry.root.render(""), declarationSection, definitionSection]
            .filter((section) => section.trim().length > 0)
            .join("\n\n");
    }

    private static renderEnclosingClassDeclaration(
        enclosingClass: EnclosingScope | null,
        memberLines: string[],
        registry: TypeRegistry,
    ): string[] {
        if (!enclosingClass) return memberLines;

        const indented = memberLines.map((line) => `    ${line}`);

        if (enclosingClass.templateArgs === null) {
            return [`struct ${enclosingClass.name} {`, ...indented, `};`];
        }

        return [
            templateHeaderFor(enclosingClass.templateArgs, registry, "RevoltijoParam"),
            `struct ${enclosingClass.name} {};`,
            `template<>`,
            `struct ${enclosingClass.name}<${renderArgs(enclosingClass.templateArgs)}> {`,
            ...indented,
            `};`,
        ];
    }

    private static wrapInNamespaces(namespaces: readonly string[], inner: string): string {
        let result = inner;

        for (const name of [...namespaces].reverse()) {
            result = `namespace ${name} {\n${SourceGenerator.indent(result)}\n}`;
        }

        return result;
    }

    private static indent(text: string): string {
        return text.split("\n").map((line) => (line ? `    ${line}` : line)).join("\n");
    }

    private static renderQualifierSuffix(signature: FunctionSignature): string {
        const parts = [...signature.cvQualifiers];
        if (signature.refQualifier) parts.push(signature.refQualifier);
        if (signature.isNoexcept) parts.push("noexcept");
        return parts.length ? " " + parts.join(" ") : "";
    }
}
