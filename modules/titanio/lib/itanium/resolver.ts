import { BUILTIN_CODES, STD_NON_TYPE_ARGUMENTS, STD_STREAM_TYPEDEFS, STD_STRING_TYPEDEFS, STD_UNVERSIONED, TYPEDEFS_BY_MODEL, VA_LIST_NAMES } from "./constants.ts";
import { builtinType, hasQualifiers, isStd, namedType, noQualifiers } from "./cpp-types.ts";
import type { CppType, NameSegment, TemplateArgument } from "../parsing/types.ts";
import type { ResolvedOptions } from "./options.ts";

/** Turns written names into what the compiler really mangles (typedefs, inline namespaces) */
export class TypeResolver {
    constructor(private readonly options: ResolvedOptions) {}

    /** Resolves a named type's typedef or adds the std inline namespace */
    resolve(type: CppType): CppType {
        if (type.kind !== "named") return type;

        const resolved = this.resolveTypedef(type);

        if (resolved !== type) return resolved;

        const segments = this.withStdNamespace(type.name.segments);

        return segments === type.name.segments ? type : { ...type, name: { ...type.name, segments } };
    }

    // libc++ and friends: std::vector -> std::__1::vector
    withStdNamespace(segments: NameSegment[]): NameSegment[] {
        const inline = this.options.inlineNamespace;

        if (!inline || !isStd(segments) || segments[1].text === inline || STD_UNVERSIONED.has(segments[1].text)) return segments;

        return [ segments[0], { kind: "identifier", text: inline }, ...segments.slice(1) ];
    }

    /** Name of segments[0..k] as written by the user, without the inline namespace ("std::array") */
    ownerName(segments: NameSegment[], k: number): string {
        const names = segments.slice(0, k + 1).map((segment) => segment.text);
        const inline = this.options.inlineNamespace;

        if (inline && names[0] === "std" && names[1] === inline)
            names.splice(1, 1);

        return names.join("::");
    }

    /** Type code of a non-type template argument of a well known std template (`std::array<T, 4>` -> `m`) */
    literalTypeHint(owner: string, index: number, args: TemplateArgument[]): string | undefined {
        // Not "in": owner comes from the signature, and "std::constructor" would match the prototype of every object
        const rule = Object.hasOwn(STD_NON_TYPE_ARGUMENTS, owner) ? STD_NON_TYPE_ARGUMENTS[owner] : undefined;

        if (!rule) return undefined;

        if (rule === "first") {
            const first = args[0];
            const type = first?.kind === "type" ? this.resolve(first.type) : null;

            return type?.kind === "builtin" && !hasQualifiers(type.qualifiers) ? BUILTIN_CODES[type.name] : undefined;
        }

        if (rule[index] !== "size_t") return rule[index] || undefined;

        const sizeType = this.options.typedefs.get("size_t") ?? TYPEDEFS_BY_MODEL[this.options.dataModel].size_t;

        return BUILTIN_CODES[sizeType];
    }

    /** Replaces a known typedef (size_t, va_list, std::string...) with its type, keeping the qualifiers */
    private resolveTypedef(type: CppType & { kind: "named" }): CppType {
        const { typedefs, resolveTypedefs } = this.options;

        if (!resolveTypedefs && typedefs.size === 0) return type;

        const segments = type.name.segments;

        if (segments.some((segment) => segment.kind !== "identifier" || segment.templateArguments)) return type;

        const names = segments.map((segment) => segment.text);
        const qualified = names[0] === "std";

        if (qualified) names.shift();

        if (names.length !== 1) return type;

        const [name] = names;
        const builtin = typedefs.get(name);
        let resolved: CppType | null = null;

        if (builtin)
            resolved = builtinType(builtin);
        else if (resolveTypedefs && VA_LIST_NAMES.includes(name)) {
            // ARM EABI: std::__va_list. x86_64: __va_list_tag[1] (decays to a pointer when it's a parameter)
            const { vaList } = this.options;

            if (vaList) {
                resolved = vaList === "arm"
                    ? namedType([ "std", "__va_list" ])
                    : { kind: "array", elementType: namedType([ "__va_list_tag" ]), sizeText: "1" };
            }
        } else if (resolveTypedefs && qualified && name === "nullptr_t")
            resolved = { kind: "decltype", expressionText: "decltype(nullptr)", qualifiers: noQualifiers() };
        // Not "in" for the std typedefs below: name comes from the signature, "std::toString" would match the prototype
        else if (resolveTypedefs && qualified && Object.hasOwn(STD_STRING_TYPEDEFS, name)) {
            const char = builtinType(STD_STRING_TYPEDEFS[name]);
            const libcxx = this.options.stdLibrary === "libc++";
            const stringNamespace = libcxx ? this.options.inlineNamespace : this.options.stringAbi === "cxx11" ? "__cxx11" : null;

            resolved = namedType(this.stdPath("basic_string", stringNamespace), [
                char,
                namedType(this.stdPath("char_traits"), [ char ]),
                namedType(this.stdPath("allocator"), [ char ]),
            ]);
        } else if (resolveTypedefs && qualified && Object.hasOwn(STD_STREAM_TYPEDEFS, name)) {
            const char = builtinType("char");

            resolved = namedType(this.stdPath(STD_STREAM_TYPEDEFS[name]), [ char, namedType(this.stdPath("char_traits"), [ char ]) ]);
        }

        if (!resolved) return type;

        return "qualifiers" in resolved ? { ...resolved, qualifiers: type.qualifiers } as CppType : resolved;
    }

    /** `["std", name]`, with the inline namespace in between when there is one */
    private stdPath(
        name: string,
        namespace: string | null = this.options.stdLibrary === "libc++" ? this.options.inlineNamespace : null,
    ): string[] {
        return namespace ? [ "std", namespace, name ] : [ "std", name ];
    }
}
