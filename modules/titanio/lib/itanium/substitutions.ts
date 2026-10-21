import type { CppType, NameSegment } from "../parsing/types.ts";
import type { ResolvedOptions } from "./options.ts";
import type { TypeResolver } from "./resolver.ts";
import {
    builtinType,
    decayParameter,
    hasQualifiers,
    namedType,
    qualifiersOf,
    templateParameterIndex,
    unsupportedType,
} from "./cpp-types.ts";
import { cvString, substitutionId } from "./encoding.ts";
import { encodeArraySize, encodeLiteral } from "./literals.ts";

/**
 * The <substitution> table of a single mangled name (S_, S0_...), plus the std:: abbreviations (Sa, Ss, So...).
 * Components are identified by structural keys: two components get the same key if and only if they are the same
 * entity for substitution purposes.
 */
export class Substitutions {
    private readonly table: string[] = [];
    private readonly abbreviations = new Map<string, string>();

    /** Sets up the `std::` abbreviations, which only libstdc++ uses. */
    constructor(
        private readonly options: ResolvedOptions,
        private readonly resolver: TypeResolver,
    ) {
        if (options.stdLibrary !== "libstdc++") return;

        const char = builtinType("char");
        const traits = namedType(["std", "char_traits"], [char]);

        // Template names
        this.abbreviations.set("std::allocator", "Sa");
        this.abbreviations.set("std::basic_string", "Sb");

        // Complete types
        this.abbreviations.set(
            this.keyType(
                namedType(["std", "basic_string"], [
                    char,
                    traits,
                    namedType(["std", "allocator"], [char]),
                ]),
            ),
            "Ss",
        );
        this.abbreviations.set(
            this.keyType(namedType(["std", "basic_istream"], [char, traits])),
            "Si",
        );
        this.abbreviations.set(
            this.keyType(namedType(["std", "basic_ostream"], [char, traits])),
            "So",
        );
        this.abbreviations.set(
            this.keyType(namedType(["std", "basic_iostream"], [char, traits])),
            "Sd",
        );
    }

    /** Returns the abbreviation or `S<seq-id>_` for a component already seen, if any. */
    lookup(key: string): string | undefined {
        const abbreviation = this.abbreviations.get(key);

        if (abbreviation) return abbreviation;

        const index = this.table.indexOf(key);

        return index === -1 ? undefined : substitutionId(index);
    }

    /** Adds a component to the table (once), giving it the next `S<seq-id>_`. */
    register(key: string): void {
        if (!this.table.includes(key)) this.table.push(key);
    }

    /**
     * Key of the name prefix `segments[0..k]`. The template arguments of the
     * last segment are only included with `includeLastArguments`, since a
     * template name and its specialization are separate substitutions.
     */
    keyPrefix(
        segments: NameSegment[],
        k: number,
        includeLastArguments: boolean,
    ): string {
        const parts: string[] = [];

        for (let i = 0; i <= k; i++) {
            const segment = segments[i];
            const args = segment.templateArguments;
            const owner = this.resolver.ownerName(segments, i);
            let part: string;

            switch (segment.kind) {
                case "identifier":
                    part = segment.text;
                    break;

                case "destructor":
                    part = "~" + segment.text;
                    break;

                case "operator":
                    part = "operator" + segment.text.replace(/\s+/g, "");
                    break;

                case "conversion":
                    part = "operator " +
                        (segment.conversionTargetType
                            ? this.keyType(segment.conversionTargetType)
                            : "?");
                    break;
            }

            if (args && (i < k || includeLastArguments)) {
                part += "<" + args.map((arg, index) =>
                    arg.kind === "type" ? this.keyType(arg.type) : "#" +
                        encodeLiteral(
                            arg.sourceText,
                            arg.integerValue,
                            this.options.dataModel,
                            this.resolver.literalTypeHint(
                                owner,
                                index,
                                args,
                            ),
                        )
                ).join(",") + ">";
            }

            parts.push(part);
        }

        return parts.join("::");
    }

    /** Structural key of a type, after resolving typedefs and inline namespaces. */
    keyType(input: CppType): string {
        const type = this.resolver.resolve(input);
        const qualifiers = qualifiersOf(type);
        const prefix = hasQualifiers(qualifiers)
            ? `[${cvString(qualifiers)}]`
            : "";

        switch (type.kind) {
            case "builtin":
                return `${prefix}b:${type.name}`;

            case "named":
                return prefix +
                    this.keyPrefix(
                        type.name.segments,
                        type.name.segments.length - 1,
                        true,
                    );

            case "pointer":
                return `${prefix}P(${this.keyType(type.subtype)})`;

            case "reference":
                return `${type.isRvalue ? "O" : "R"}(${
                    this.keyType(type.referent)
                })`;

            case "array":
                return `A${encodeArraySize(type.sizeText)}(${
                    this.keyType(type.elementType)
                })`;

            case "function": {
                const parameters = type.parameters.map((parameter) =>
                    this.keyType(
                        decayParameter(this.resolver.resolve(parameter.type)),
                    )
                ).join(",");

                return `F[${cvString(type.qualifiers)}${
                    type.isNoexcept && this.options.noexceptInFunctionType
                        ? "x"
                        : ""
                }${type.refQualifier ?? ""}](${
                    type.returnType ? this.keyType(type.returnType) : ""
                };${parameters}${type.hasCEllipsis ? ",..." : ""})`;
            }

            case "auto":
                return `${prefix}auto`;

            case "decltype":
                return `${prefix}decltype:${
                    type.expressionText.replace(/\s+/g, "")
                }`;

            case "unknown": {
                const index = templateParameterIndex(type);

                return index === undefined
                    ? unsupportedType(type)
                    : `${prefix}T#${index}`;
            }
        }
    }
}
