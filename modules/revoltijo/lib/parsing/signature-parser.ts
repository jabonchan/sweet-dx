import type { CppParser } from "./cpp-parser.ts";

import { EnclosingScope, FunctionSignature, Parameter } from "../ast/signature.ts";
import { SignaturePreprocessor } from "./preprocessor.ts";
import { FunctionNameParser } from "./function-name-parser.ts";
import { ParameterParser } from "./parameter-parser.ts";

interface TrailingQualifiers {
    cvQualifiers: string[];
    refQualifier: "&" | "&&" | null;
    isNoexcept: boolean;
}

export class SignatureParser {
    private readonly functionNameParser: FunctionNameParser;
    private readonly parameterParser: ParameterParser;

    constructor(parser: CppParser) {
        this.functionNameParser = new FunctionNameParser(parser);
        this.parameterParser = new ParameterParser(parser);
    }

    parse(rawSignature: string, isConstructor: boolean = false): FunctionSignature {
        const { head, parameterListText, trailing } = SignaturePreprocessor.split(rawSignature);
        const parsedName = this.functionNameParser.parse(head);

        let parameterTexts = SignaturePreprocessor.splitParameters(parameterListText);
        if (parameterTexts.length === 1 && parameterTexts[0].trim() === "void") {
            parameterTexts = [];
        }

        const parameters = parameterTexts.map((text) => new Parameter(this.parameterParser.parse(text)));
        const { cvQualifiers, refQualifier, isNoexcept } = SignatureParser.parseTrailingQualifiers(trailing);

        const namespaces = [...parsedName.namespaces];
        const enclosingClasses = [...parsedName.enclosingClasses];

        if (isConstructor) {
            if (cvQualifiers.length || refQualifier) {
                throw new Error(`Constructor signature "${rawSignature}" cannot have cv/ref qualifiers.`);
            }

            if (enclosingClasses.length) {
                throw new Error(
                    `Constructor signature "${rawSignature}" cannot have a template-qualified enclosing scope.`,
                );
            }

            if (!namespaces.length || namespaces[namespaces.length - 1] !== parsedName.functionName) {
                throw new Error(
                    `Constructor signature "${rawSignature}" must repeat the class name, e.g. "ClassName::ClassName(...)".`,
                );
            }

            enclosingClasses.push(new EnclosingScope(namespaces.pop()!, null));
        } else if ((cvQualifiers.length || refQualifier) && !enclosingClasses.length && namespaces.length) {
            enclosingClasses.push(new EnclosingScope(namespaces.pop()!, null));
        }

        return new FunctionSignature(
            namespaces,
            enclosingClasses,
            parsedName.functionName,
            parsedName.isOperator,
            parsedName.explicitTemplateArgs,
            parameters,
            cvQualifiers,
            refQualifier,
            isNoexcept,
            isConstructor,
        );
    }

    private static parseTrailingQualifiers(trailing: string): TrailingQualifiers {
        const cvQualifiers: string[] = [];
        let refQualifier: "&" | "&&" | null = null;
        let isNoexcept = false;

        for (const token of trailing.split(/\s+/).filter(Boolean)) {
            if (token === "const" || token === "volatile") cvQualifiers.push(token);
            else if (token === "&" || token === "&&") refQualifier = token;
            else if (token === "noexcept" || token.startsWith("noexcept(")) isNoexcept = true;
            else throw new Error(`Unexpected trailing qualifier "${token}" in signature.`);
        }

        return { cvQualifiers, refQualifier, isNoexcept };
    }
}
