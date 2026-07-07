import { CppParser } from "./cpp-parser.ts";
import { namedChildren } from "./tree-helpers.ts";
import { buildParameterType } from "./type-node-builder.ts";
import { ArrayDeclaratorMatcher } from "./array-declarator.ts";
import { ArrayType, PointerType, ReferenceType, TypeNode } from "../ast/type-node.ts";

export class ParameterParser {
    constructor(private readonly parser: CppParser) {}

    parse(parameterText: string): TypeNode {
        const text = parameterText.trim();
        if (!text) throw new Error("Empty parameter type");

        const arrayMatch = ArrayDeclaratorMatcher.match(text);

        if (arrayMatch) {
            const element = this.parse(arrayMatch.typeText);
            const array = new ArrayType(element, arrayMatch.size);
            return arrayMatch.kind === "reference" ? new ReferenceType(array, false) : new PointerType(array);
        }

        const root = this.parser.parse(`void __revoltijo_param(${text});`);

        if (CppParser.hasError(root)) {
            const error = CppParser.findFirstError(root);
            throw new Error(`Could not parse parameter type "${text}"${error ? ` near "${error.text}"` : ""}.`);
        }

        const declaration = root.child(0);
        const functionDeclarator = declaration.childForFieldName("declarator");
        const parameterListNode = functionDeclarator.childForFieldName("parameters");
        const parameterNodes = namedChildren(parameterListNode)
            .filter((n) => n.type === "parameter_declaration" || n.type === "optional_parameter_declaration");

        if (parameterNodes.length !== 1) {
            throw new Error(`Expected exactly one parameter in "${text}", found ${parameterNodes.length}.`);
        }

        return buildParameterType(parameterNodes[0]);
    }
}
