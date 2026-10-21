/** A parsed literal (bool, char, integer or `nullptr`), as used in template arguments and array sizes. */
export interface Literal {
    /** Type of bool and char literals. Integers get theirs from `suffix`, `isDecimal` and the data model. */
    type?: string;
    negative: boolean;
    magnitude: bigint;
    isNullptr?: boolean;
    /** Normalized integer suffix: "", "u", "l", "ul", "ll" or "ull" */
    suffix?: string;
    isDecimal?: boolean;
}

const INTEGER_SUFFIXES: Record<string, string> = {
    "": "",
    u: "u",
    l: "l",
    ul: "ul",
    lu: "ul",
    ll: "ll",
    ull: "ull",
    llu: "ull",
};

// Candidate types of an integer literal, by suffix (signed ones are followed by their unsigned type when not decimal)
const INTEGER_CANDIDATES: Record<string, string[]> = {
    "": ["i", "l", "x"],
    u: ["j", "m", "y"],
    l: ["l", "x"],
    ul: ["m", "y"],
    ll: ["x"],
    ull: ["y"],
};

/** Unsigned counterpart of each signed integer code. */
const UNSIGNED_CODES: Record<string, string> = { i: "j", l: "m", x: "y" };

const CHAR_ESCAPES: Record<string, number> = {
    n: 10,
    t: 9,
    r: 13,
    "0": 0,
    "\\": 92,
    "'": 39,
    '"': 34,
    a: 7,
    b: 8,
    f: 12,
    v: 11,
};

/** Parses a bool, char, integer or `nullptr` literal, or returns `null` if `source` isn't one. */
export function parseLiteral(source: string): Literal | null {
    let text = source.replace(/\s+/g, "");

    while (text.startsWith("(") && text.endsWith(")")) text = text.slice(1, -1);

    if (text === "true" || text === "false") {
        return {
            type: "b",
            negative: false,
            magnitude: text === "true" ? 1n : 0n,
        };
    }
    if (text === "nullptr") {
        return { negative: false, magnitude: 0n, isNullptr: true };
    }

    const char = /^(u8|u|U|L)?'(\\.|[^\\'])'$/.exec(text);

    if (char) {
        const code = char[2].startsWith("\\")
            ? CHAR_ESCAPES[char[2][1]]
            : char[2].charCodeAt(0);
        const type = { u8: "Du", u: "Ds", U: "Di", L: "w" }[char[1] ?? ""] ??
            "c";

        return code === undefined
            ? null
            : { type, negative: false, magnitude: BigInt(code) };
    }

    const integer =
        /^([+-]?)(0[xX][0-9a-fA-F']+|0[bB][01']+|[0-9][0-9']*)([uUlL]*)$/.exec(
            text,
        );

    if (!integer) return null;

    const digits = integer[2].replaceAll("'", "");
    // A leading 0 means octal in C++, but BigInt needs the `0o` prefix for it.
    const isOctal = /^0[0-7]+$/.test(digits);
    const magnitude = BigInt(isOctal ? `0o${digits.slice(1)}` : digits);
    const suffix = Object.hasOwn(INTEGER_SUFFIXES, integer[3].toLowerCase())
        ? INTEGER_SUFFIXES[integer[3].toLowerCase()]
        : undefined;

    if (suffix === undefined) return null;

    return {
        negative: integer[1] === "-" && magnitude !== 0n,
        magnitude,
        suffix,
        isDecimal: !isOctal && !/^0[xXbB]/.test(digits),
    };
}

/**
 * [lex.icon]: the first candidate type that can represent the value. A minus sign is a unary operator applied to
 * the literal, so only the magnitude counts (`-2147483648` is a `long long` on ILP32).
 */
function integerType(literal: Literal, dataModel: "lp64" | "ilp32"): string {
    const longBits = dataModel === "ilp32" ? 32n : 64n;
    const bits: Record<string, bigint> = {
        i: 32n,
        j: 32n,
        l: longBits,
        m: longBits,
        x: 64n,
        y: 64n,
    };
    const candidates = INTEGER_CANDIDATES[literal.suffix ?? ""].flatMap((
        code,
    ) => literal.isDecimal || !UNSIGNED_CODES[code]
        ? [code]
        : [code, UNSIGNED_CODES[code]]
    );
    const isSigned = (code: string) => Object.hasOwn(UNSIGNED_CODES, code);

    return candidates.find((code) =>
        literal.magnitude < 2n ** (bits[code] - (isSigned(code) ? 1n : 0n))
    ) ?? candidates.at(-1)!;
}

// <expr-primary> ::= L <type> <value number> E
export function encodeLiteral(
    sourceText: string,
    integerValue: number | null,
    dataModel: "lp64" | "ilp32",
    hint?: string,
): string {
    const literal = parseLiteral(sourceText) ??
        (integerValue !== null
            ? {
                negative: integerValue < 0,
                magnitude: BigInt(Math.abs(integerValue)),
                suffix: "",
                isDecimal: true,
            } as Literal
            : (() => {
                throw new Error(
                    `Unsupported template argument expression "${sourceText}"`,
                );
            })());

    if (literal.isNullptr) return "LDnE";

    const { magnitude, negative } = literal;
    // A suffix states the type explicitly, so it wins over the hint (like bool and char literals)
    const type = literal.type ??
        (literal.suffix
            ? integerType(literal, dataModel)
            : hint ?? integerType(literal, dataModel));

    return `L${type}${negative ? "n" : ""}${magnitude}E`;
}

/** Encodes an array bound as a plain number, or nothing for an unknown bound (`T[]`). */
export function encodeArraySize(sizeText?: string): string {
    if (sizeText === undefined || sizeText.trim() === "") return "";

    const literal = parseLiteral(sizeText);

    if (!literal || literal.isNullptr || literal.negative) {
        throw new Error(`Unsupported array size "${sizeText}"`);
    }

    return literal.magnitude.toString();
}
