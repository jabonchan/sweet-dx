import { arrayBounds, decayParameter, hasQualifiers, isStd, isUnscoped, qualifiersOf, templateParameterIndex, unsupportedType, withoutQualifiers } from "./cpp-types.ts";
import { chooseArity, cvString, encodeOperator, refQualifierString, sourceName, templateParameterCode } from "./encoding.ts";
import type { CppType, FunctionType, NameSegment, ParsedSignature, QualifiedName, TemplateArgument, TypeSpecialPrefix } from "../parsing/types.ts";
import { AMBIGUOUS_OPERATOR_CODES, BUILTIN_CODES, NULLPTR_DECLTYPE } from "./constants.ts";
import { type MangleOptions, type ResolvedOptions, resolveOptions } from "./options.ts";
import { encodeArraySize, encodeLiteral, parseLiteral } from "./literals.ts";
import { bindTemplateParameters } from "./templates.ts";
import { Substitutions } from "./substitutions.ts";
import { TypeResolver } from "./resolver.ts";
import { Recuerdo } from "../../deps.ts";

export { typedefsFromPredefinedMacros } from "./macros.ts";
export type { MangleOptions } from "./options.ts";

/** What the function's own name needs to know while being encoded */
interface FunctionContext {
    special: ParsedSignature["specialMember"];
    arity: number;
}

/** Itanium C++ ABI mangler. The substitution table is per name, so use one instance per signature */
export class Mangler {
    private readonly options: ResolvedOptions;
    private readonly resolver: TypeResolver;
    private readonly substitutions: Substitutions;

    constructor(options: MangleOptions) {
        this.options = resolveOptions(options);
        this.resolver = new TypeResolver(this.options);
        this.substitutions = new Substitutions(this.options, this.resolver);
    }

    /** Mangles a parsed signature into `_Z<encoding>` */
    mangle(signature: ParsedSignature): string {
        const segments = this.resolver.withStdNamespace(signature.qualifiedName.segments);
        const last = segments.at(-1);

        if (!last) throw new Error("Cannot mangle a signature without a name");

        this.warnDependentArrayBounds(last, signature);

        const { returnType, parameters } = bindTemplateParameters(
            signature,
            last,
            this.options.inferTemplateParameters,
            (type) => this.substitutions.keyType(type),
        );

        const special = signature.specialMember;
        const mayBeMember = segments.length - (isStd(segments) ? 1 : 0) >= 2;
        const context: FunctionContext = { special, arity: chooseArity(signature.parameters.length, mayBeMember) };

        const qualifiers = cvString(signature.qualifiers) + refQualifierString(signature.refQualifier);

        this.warnAmbiguousOperator(last, signature, mayBeMember, qualifiers);

        // Scoped names (and cv/ref-qualified members) go inside N...E
        const nested = mayBeMember || qualifiers.length > 0;
        const name = this.encodePrefix(segments, segments.length - 1, context);

        let out = "_Z" + (nested ? `N${qualifiers}${name}E` : name);

        // Function templates mangle the return type, except constructors, destructors and conversions
        if (last.templateArguments && special === null) {
            if (!returnType)
                throw new Error(`Cannot mangle function template "${last.text}" without its return type`);

            out += this.encodeType(returnType);
        }

        return out + this.encodeParameters(parameters, signature.hasCEllipsis);
    }

    /** Mangles a variable name into `_Z<data name>`, names in the global namespace aren't mangled */
    mangleVariable(name: QualifiedName): string {
        const segments = this.resolver.withStdNamespace(name.segments);

        if (segments.length === 1 && !segments[0].templateArguments) return segments[0].text;

        return "_Z" + this.encodeDataName(segments);
    }

    /** Mangles the guard variable of a static variable into `_ZGV<data name>` */
    mangleGuardVariable(name: QualifiedName): string {
        return "_ZGV" + this.encodeDataName(this.resolver.withStdNamespace(name.segments));
    }

    /** Mangles the vtable, VTT, typeinfo or typeinfo name of a type into `_Z<prefix><type>` */
    mangleTypeSpecialName(prefix: TypeSpecialPrefix, type: CppType): string {
        return "_Z" + prefix + this.encodeType(type);
    }

    /** Scoped variable names go inside N...E, like types */
    private encodeDataName(segments: NameSegment[]): string {
        const name = this.encodePrefix(segments, segments.length - 1, null);

        return isUnscoped(segments) ? name : `N${name}E`;
    }

    /** Array bounds from a template parameter (T (&)[N] -> RAT0__T_) aren't supported, warns when it's obvious */
    private warnDependentArrayBounds(last: NameSegment, signature: ParsedSignature): void {
        if (!last.templateArguments) return;

        const nonTypeNames = new Set(
            signature.templateParameters.filter((parameter) => parameter.kind === "nonType" && parameter.name).map((parameter) =>
                parameter.name!
            ),
        );
        const valueOf = (text: string) => {
            const literal = parseLiteral(text);
            return literal && !literal.isNullptr ? `${literal.negative ? "-" : ""}${literal.magnitude}` : null;
        };
        const argumentValues = new Set(
            last.templateArguments.flatMap((argument) => argument.kind === "expression" ? [ valueOf(argument.sourceText) ] : []).filter((
                value,
            ) => value !== null),
        );

        const bounds = [
            ...(signature.returnType ? arrayBounds(signature.returnType, false) : []),
            ...signature.parameters.flatMap((parameter) => arrayBounds(parameter.type)),
        ];

        for (const bound of bounds) {
            const value = valueOf(bound);
            const reason = nonTypeNames.has(bound.trim())
                ? `uses the template parameter "${bound.trim()}" as an array bound`
                : value !== null && argumentValues.has(value)
                ? `has the array bound ${bound.trim()}, equal to one of its template arguments`
                : null;

            if (!reason) continue;

            Recuerdo.warn(
                `"${signature.sourceSignature}" ${reason}. Array bounds that depend on a template parameter are mangled as `
                    + `that parameter ("[N]" -> "AT0__"), which titanio doesn't support: the symbol likely won't match.`,
            );

            return;
        }
    }

    /** X::operator-(T) is mangled as a binary member unless its qualifiers say otherwise */
    private warnAmbiguousOperator(last: NameSegment, signature: ParsedSignature, mayBeMember: boolean, qualifiers: string): void {
        const operator = last.text.replace(/\s+/g, "");

        if (
            last.kind !== "operator"
            || !(operator in AMBIGUOUS_OPERATOR_CODES)
            || !mayBeMember || signature.parameters.length !== 1
            || qualifiers.length > 0
        ) { return; }

        const [unary, binary] = AMBIGUOUS_OPERATOR_CODES[operator];

        Recuerdo.warn(
            `"${signature.sourceSignature}" is ambiguous: it is mangled as a binary member operator${operator} ("${binary}"). `
                + `If its scope is a namespace it is a unary operator${operator} ("${unary}") and the symbol will not match.`,
        );
    }

    /** Encodes the parameter types (decayed), `v` for none and a trailing `z` for a C `...` */
    private encodeParameters(parameters: { type: CppType; isPack: boolean }[], hasCEllipsis: boolean): string {
        if (parameters.length === 0 && !hasCEllipsis) return "v";

        let out = "";

        for (const parameter of parameters) {
            if (parameter.isPack)
                throw new Error("Parameter packs can only be mangled once expanded into an instantiated signature");

            out += this.encodeType(decayParameter(this.resolver.resolve(parameter.type)));
        }

        return hasCEllipsis ? out + "z" : out;
    }

    // Names

    /** Encodes segments[0..k] as a <prefix>. fn is only passed for the function's full name */
    private encodePrefix(segments: NameSegment[], k: number, fn: FunctionContext | null): string {
        if (k === 0 && isStd(segments)) return "St";

        const segment = segments[k];
        const full = this.substitutions.keyPrefix(segments, k, true);

        if (!fn) {
            const known = this.substitutions.lookup(full);

            if (known) return known;
        }

        const head = () => (k > 0 ? this.encodePrefix(segments, k - 1, null) : "");
        const args = segment.templateArguments;

        if (!args) {
            const out = head() + this.encodeUnqualified(segment, fn);

            if (!fn) this.substitutions.register(full);

            return out;
        }

        const bare = this.substitutions.keyPrefix(segments, k, false);
        let templateName = this.substitutions.lookup(bare);

        if (!templateName) {
            templateName = head() + this.encodeUnqualified(segment, fn);
            this.substitutions.register(bare);
        }

        const out = templateName + this.encodeTemplateArguments(args, this.resolver.ownerName(segments, k));

        if (!fn) this.substitutions.register(full);

        return out;
    }

    /** Encodes the last component of a name: identifier, ctor/dtor variant, operator or conversion */
    private encodeUnqualified(segment: NameSegment, fn: FunctionContext | null): string {
        if (fn?.special === "constructor")
            return this.options.constructorVariant;

        switch (segment.kind) {
            case "identifier":
                return sourceName(segment.text);

            case "destructor":
                return this.options.destructorVariant;

            case "conversion":
                if (!segment.conversionTargetType)
                    throw new Error("Conversion operator without target type");

                return "cv" + this.encodeType(segment.conversionTargetType);

            case "operator":
                return encodeOperator(segment.text, fn?.arity ?? 2);
        }
    }

    // Template arguments

    /** `I <template-arg>+ E`. `owner` is used to guess the type of literal arguments */
    private encodeTemplateArguments(args: TemplateArgument[], owner: string): string {
        let out = "I";

        args.forEach((arg, index) => {
            out += arg.kind === "type"
                ? this.encodeType(arg.type)
                : encodeLiteral(
                    arg.sourceText,
                    arg.integerValue,
                    this.options.dataModel,
                    this.resolver.literalTypeHint(owner, index, args),
                );
        });

        return out + "E";
    }

    // Types

    /** Encodes a type, reusing its substitution if it was already seen */
    private encodeType(input: CppType): string {
        const type = this.resolver.resolve(input);
        const qualifiers = qualifiersOf(type);
        const qualified = hasQualifiers(qualifiers);

        // Builtin types are never substitution candidates
        if (!qualified) {
            if (type.kind === "builtin") return BUILTIN_CODES[type.name];
            if (type.kind === "auto") return "Da";
            if (type.kind === "decltype" && NULLPTR_DECLTYPE.test(type.expressionText.trim())) return "Dn";
        }

        const key = this.substitutions.keyType(type);
        const known = this.substitutions.lookup(key);

        if (known) return known;

        if (qualified) {
            const out = cvString(qualifiers) + this.encodeType(withoutQualifiers(type));

            this.substitutions.register(key);

            return out;
        }

        let out: string;

        switch (type.kind) {
            case "named": {
                const segments = type.name.segments;

                // Components (and the type itself) are registered by encodePrefix
                return isUnscoped(segments)
                    ? this.encodePrefix(segments, segments.length - 1, null)
                    : `N${this.encodePrefix(segments, segments.length - 1, null)}E`;
            }

            case "pointer":
                out = "P" + this.encodeType(type.subtype);
                break;

            case "reference":
                out = (type.isRvalue ? "O" : "R") + this.encodeType(type.referent);
                break;

            case "array":
                out = `A${encodeArraySize(type.sizeText)}_` + this.encodeType(type.elementType);
                break;

            case "function":
                out = this.encodeFunctionType(type);
                break;

            case "unknown": {
                const index = templateParameterIndex(type);

                if (index === undefined) return unsupportedType(type);

                out = templateParameterCode(index);
                break;
            }

            default:
                return unsupportedType(type);
        }

        this.substitutions.register(key);

        return out;
    }

    // <function-type> ::= [<CV-qualifiers>] [Do] F <return type> <parameter types> [<ref-qualifier>] E
    private encodeFunctionType(type: FunctionType): string {
        if (!type.returnType)
            throw new Error("Cannot mangle a function type without return type");

        return cvString(type.qualifiers)
            + (type.isNoexcept && this.options.noexceptInFunctionType ? "Do" : "")
            + "F"
            + this.encodeType(type.returnType)
            + this.encodeParameters(type.parameters, type.hasCEllipsis)
            + refQualifierString(type.refQualifier)
            + "E";
    }
}
