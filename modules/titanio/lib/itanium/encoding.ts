import { AMBIGUOUS_OPERATOR_CODES, ANONYMOUS_NAMESPACE, OPERATOR_CODES } from "./constants.ts";
import type { Qualifiers } from "../parsing/types.ts";

// <CV-qualifiers> ::= [r] [V] [K]
export function cvString(qualifiers: Qualifiers): string {
    return (qualifiers.isRestrict ? "r" : "") + (qualifiers.isVolatile ? "V" : "") + (qualifiers.isConst ? "K" : "");
}

// <ref-qualifier> ::= R | O
export function refQualifierString(refQualifier?: "&" | "&&"): string {
    return refQualifier === "&" ? "R" : refQualifier === "&&" ? "O" : "";
}

// <seq-id> in base 36: S_, S0_, S1_ ... S9_, SA_ ... SZ_, S10_ ...
export function substitutionId(index: number): string {
    return index === 0 ? "S_" : `S${(index - 1).toString(36).toUpperCase()}_`;
}

// <template-param> ::= T_ | T <number> _   (decimal, unlike <seq-id>)
export function templateParameterCode(index: number): string {
    return index === 0 ? "T_" : `T${index - 1}_`;
}

/** `<source-name> ::= <length> <identifier>`. Anonymous namespaces get the name clang uses */
export function sourceName(text: string): string {
    return ANONYMOUS_NAMESPACE.test(text) ? "12_GLOBAL__N_1" : `${text.length}${text}`;
}

// Unary or binary? Member operators have an implicit `this` parameter
export function chooseArity(parameterCount: number, mayBeMember: boolean): number {
    const options = mayBeMember ? [ parameterCount + 1, parameterCount ] : [ parameterCount ];

    return options.find((arity) => arity === 1 || arity === 2) ?? 2;
}

/** Two-letter code of an operator, - and * depend on the arity and operator""_x is li <source-name> */
export function encodeOperator(rawText: string, arity: number): string {
    const text = rawText.replace(/\s+/g, "");
    const literal = /^""(.+)$/.exec(rawText.trim());

    if (literal) return "li" + sourceName(literal[1].trim());
    if (text in AMBIGUOUS_OPERATOR_CODES)
        return AMBIGUOUS_OPERATOR_CODES[text][arity === 1 ? 0 : 1];

    return (text in OPERATOR_CODES ? OPERATOR_CODES[text] : undefined) ?? (() => {
        throw new Error(`Unknown operator "operator${rawText}"`);
    })();
}
