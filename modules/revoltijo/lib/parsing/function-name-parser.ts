import { CppParser, SyntaxNode } from "./cpp-parser.ts";
import { OPERATOR_CALL_PLACEHOLDER } from "./preprocessor.ts";
import { buildTemplateArgs } from "./type-node-builder.ts";
import { EnclosingScope } from "../ast/signature.ts";
import { TemplateArgumentNode } from "../ast/type-node.ts";

export interface ParsedFunctionName {
    namespaces: readonly string[];
    enclosingClasses: readonly EnclosingScope[];
    functionName: string;
    isOperator: boolean;
    explicitTemplateArgs: readonly TemplateArgumentNode[] | null;
}

export class FunctionNameParser {
    constructor(private readonly parser: CppParser) {}

    parse(headText: string): ParsedFunctionName {
        const placeholderHead = headText.replaceAll("operator()", OPERATOR_CALL_PLACEHOLDER);
        const wrapped = `using __revoltijo_head = ${placeholderHead};`;
        const root = this.parser.parse(wrapped);

        if (CppParser.hasError(root)) {
            const error = CppParser.findFirstError(root);
            throw new Error(`Could not parse function name "${headText}"${error ? ` near "${error.text}"` : ""}.`);
        }

        const aliasDeclaration = root.child(0);
        const typeDescriptor = aliasDeclaration.childForFieldName("type");
        const rootTypeNode = typeDescriptor.childForFieldName("type");

        const scopeSegments: SyntaxNode[] = [];
        let current = rootTypeNode;

        while (current.type === "qualified_identifier") {
            scopeSegments.push(current.childForFieldName("scope"));
            current = current.childForFieldName("name");
        }

        const namespaces: string[] = [];
        const enclosingClasses: EnclosingScope[] = [];

        scopeSegments.forEach((segment, index) => {
            if (segment.type !== "template_type") {
                namespaces.push(segment.text);
                return;
            }

            if (index !== scopeSegments.length - 1) {
                throw new Error(
                    `Nested class templates ("${segment.text}::...") are only supported as the innermost enclosing scope.`,
                );
            }

            const argumentsNode = segment.childForFieldName("arguments");
            enclosingClasses.push(new EnclosingScope(
                segment.childForFieldName("name").text,
                argumentsNode ? buildTemplateArgs(argumentsNode) : [],
            ));
        });

        let functionName: string;
        let explicitTemplateArgs: TemplateArgumentNode[] | null = null;

        if (current.type === "template_type") {
            functionName = current.childForFieldName("name").text;
            const argumentsNode = current.childForFieldName("arguments");
            explicitTemplateArgs = argumentsNode ? buildTemplateArgs(argumentsNode) : [];
        } else {
            functionName = current.text;
        }

        functionName = functionName.replaceAll(OPERATOR_CALL_PLACEHOLDER, "operator()");

        return {
            namespaces,
            enclosingClasses,
            functionName,
            isOperator: functionName.startsWith("operator"),
            explicitTemplateArgs,
        };
    }
}
