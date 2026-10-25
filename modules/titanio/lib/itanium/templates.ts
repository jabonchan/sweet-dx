import type { CppType, NameSegment, Parameter, ParsedSignature } from "../parsing/types.ts";
import { qualifiersOf, templateParameterType, withoutQualifiers } from "./cpp-types.ts";

type Replacer = (type: CppType) => CppType | null;

/** Function templates: types that depend on a template parameter are encoded as T_, T0_... */
export function bindTemplateParameters(
    signature: ParsedSignature,
    last: NameSegment,
    inferTemplateParameters: boolean,
    keyType: (type: CppType) => string,
): { returnType?: CppType; parameters: Parameter[] } {
    const args = last.templateArguments;
    const result = { returnType: signature.returnType, parameters: signature.parameters };
    let replace: Replacer | null = null;

    if (signature.templateParameters.length > 0) {
        // template <typename T, typename U> void foo<int, char>(T, U)
        if (!args) {
            throw new Error(
                `Cannot mangle "${last.text}": it declares template parameters but no template arguments, only instantiated functions have a symbol`,
            );
        }

        const names = new Map<string, number>();

        signature.templateParameters.forEach((parameter, index) => {
            if (parameter.isPack)
                throw new Error("Template parameter packs are not supported");
            if (parameter.kind === "type" && parameter.name)
                names.set(parameter.name, index);
        });

        replace = (type) => {
            const segments = type.kind === "named" ? type.name.segments : [];
            const index = segments.length === 1 && segments[0].kind === "identifier" && !segments[0].templateArguments
                ? names.get(segments[0].text)
                : undefined;

            return index === undefined || type.kind !== "named" ? null : templateParameterType(index, type.qualifiers);
        };
    } else if (inferTemplateParameters && args) {
        const keys = new Map<string, number>();

        args.forEach((arg, index) => {
            if (arg.kind !== "type" || arg.type.kind === "unknown") return;

            const key = keyType(withoutQualifiers(arg.type));

            if (!keys.has(key)) keys.set(key, index);
        });

        replace = (type) => {
            if (type.kind === "unknown") return null;

            const index = keys.get(keyType(withoutQualifiers(type)));

            return index === undefined ? null : templateParameterType(index, qualifiersOf(type));
        };
    }

    if (!replace) return result;

    const rewrite = replace;

    return {
        returnType: result.returnType && rewriteType(result.returnType, rewrite),
        parameters: result.parameters.map((parameter) => ({ ...parameter, type: rewriteType(parameter.type, rewrite) })),
    };
}

/** Recursively replaces every part of `type` that `replace` returns a new type for */
function rewriteType(type: CppType, replace: Replacer): CppType {
    const replaced = replace(type);

    if (replaced) return replaced;

    const rewrite = (inner: CppType) => rewriteType(inner, replace);

    switch (type.kind) {
        case "pointer":
            return { ...type, subtype: rewrite(type.subtype) };

        case "reference":
            return { ...type, referent: rewrite(type.referent) };

        case "array":
            return { ...type, elementType: rewrite(type.elementType) };

        case "function":
            return {
                ...type,
                returnType: type.returnType && rewrite(type.returnType),
                parameters: type.parameters.map((parameter) => ({ ...parameter, type: rewrite(parameter.type) })),
            };

        case "named":
            return {
                ...type,
                name: {
                    ...type.name,
                    segments: type.name.segments.map((segment) =>
                        segment.templateArguments
                            ? {
                                ...segment,
                                templateArguments: segment.templateArguments.map((arg) =>
                                    arg.kind === "type" ? { ...arg, type: rewrite(arg.type) } : arg
                                ),
                            }
                            : segment
                    ),
                },
            };

        default:
            return type;
    }
}
