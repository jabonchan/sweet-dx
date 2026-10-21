import type {
    BuiltinName,
    CppType,
    NameSegment,
    Qualifiers,
} from "../parsing/types.ts";
import { TEMPLATE_PARAMETER_NODE } from "./constants.ts";

/** Returns a fresh, unqualified `Qualifiers` object. */
export function noQualifiers(): Qualifiers {
    return { isConst: false, isVolatile: false, isRestrict: false };
}

/** Whether any qualifier is set. */
export function hasQualifiers(qualifiers: Qualifiers): boolean {
    return qualifiers.isConst || qualifiers.isVolatile || qualifiers.isRestrict;
}

/** Returns a type's top-level qualifiers. References, arrays and functions can't have any. */
export function qualifiersOf(type: CppType): Qualifiers {
    switch (type.kind) {
        case "reference":
        case "array":
        case "function":
            return noQualifiers();

        default:
            return type.qualifiers;
    }
}

/** Returns `type` with its top-level qualifiers removed. */
export function withoutQualifiers(type: CppType): CppType {
    return "qualifiers" in type && type.kind !== "function"
        ? { ...type, qualifiers: noQualifiers() } as CppType
        : type;
}

// Parameter types are adjusted: top-level cv-qualifiers are dropped, arrays and functions decay to pointers.
export function decayParameter(type: CppType): CppType {
    if (type.kind === "array") {
        return {
            kind: "pointer",
            subtype: type.elementType,
            qualifiers: noQualifiers(),
        };
    }
    if (type.kind === "function") {
        return { kind: "pointer", subtype: type, qualifiers: noQualifiers() };
    }

    return withoutQualifiers(type);
}

/** Builds an unqualified builtin type. */
export function builtinType(name: BuiltinName): CppType {
    return { kind: "builtin", name, qualifiers: noQualifiers() };
}

/** Builds a named type from its segments (`["std", "vector"]`), with `args` as template arguments of the last one. */
export function namedType(names: string[], args: CppType[] = []): CppType {
    const segments: NameSegment[] = names.map((text) => ({
        kind: "identifier",
        text,
    }));

    if (args.length) {
        segments[segments.length - 1].templateArguments = args.map((type) => ({
            kind: "type",
            type,
        }));
    }

    return {
        kind: "named",
        name: { hasLeadingScopeOperator: false, segments },
        qualifiers: noQualifiers(),
    };
}

/** Whether the name is directly inside `std::`. */
export function isStd(segments: NameSegment[]): boolean {
    return segments.length >= 2 && segments[0].kind === "identifier" &&
        segments[0].text === "std" && !segments[0].templateArguments;
}

/** Whether the name has no scope besides an optional `std::`. */
export function isUnscoped(segments: NameSegment[]): boolean {
    return segments.length - (isStd(segments) ? 1 : 0) === 1;
}

// Template parameters (T_, T0_...) are smuggled through the CppType union as "unknown" types with a special node type
export function templateParameterType(
    index: number,
    qualifiers: Qualifiers,
): CppType {
    return {
        kind: "unknown",
        sourceText: `T${index}`,
        treeSitterNodeType: TEMPLATE_PARAMETER_NODE,
        qualifiers,
    };
}

/** Returns the index of a template parameter type made by `templateParameterType`, or `undefined`. */
export function templateParameterIndex(type: CppType): number | undefined {
    return type.kind === "unknown" &&
            type.treeSitterNodeType === TEMPLATE_PARAMETER_NODE
        ? Number(type.sourceText.slice(1))
        : undefined;
}

/**
 * The bounds of every array that is part of the mangled type. Parameters that are arrays decay to pointers, so their
 * own bound is skipped (`void f(int[N])` is `void f(int*)`), but `void f(int (&)[N])` keeps it.
 */
export function arrayBounds(
    type: CppType,
    isParameter: boolean = true,
): string[] {
    switch (type.kind) {
        case "array":
            return [
                ...(isParameter || type.sizeText === undefined
                    ? []
                    : [type.sizeText]),
                ...arrayBounds(type.elementType, false),
            ];

        case "pointer":
            return arrayBounds(type.subtype, false);

        case "reference":
            return arrayBounds(type.referent, false);

        case "function":
            return [
                ...(type.returnType ? arrayBounds(type.returnType, false) : []),
                ...type.parameters.flatMap((parameter) =>
                    arrayBounds(parameter.type, true)
                ),
            ];

        case "named":
            return type.name.segments.flatMap((segment) =>
                (segment.templateArguments ?? []).flatMap((argument) =>
                    argument.kind === "type"
                        ? arrayBounds(argument.type, false)
                        : []
                )
            );

        default:
            return [];
    }
}

/** Fails with a message explaining why `type` can't be mangled. */
export function unsupportedType(type: CppType): never {
    switch (type.kind) {
        case "unknown":
            throw new Error(
                `Cannot mangle unsupported type "${type.sourceText}" (${type.treeSitterNodeType})`,
            );

        case "decltype":
            throw new Error(
                `Cannot mangle "${type.expressionText}": decltype expressions are not supported`,
            );

        default:
            throw new Error(`Cannot mangle type of kind "${type.kind}"`);
    }
}
