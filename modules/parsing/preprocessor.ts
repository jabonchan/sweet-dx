export const OPERATOR_CALL_PLACEHOLDER = "revoltijoOperatorCall"; // kept for compatibility

// Every overloadable operator name. Longest alternatives first so "<<=" wins over "<<" over "<".
const OPERATOR_PATTERN = new RegExp(
    "(?<![A-Za-z0-9_])operator\\s*(?:" +
        "new\\s*\\[\\s*\\]|delete\\s*\\[\\s*\\]|new(?![A-Za-z0-9_])|delete(?![A-Za-z0-9_])|" +
        "\\(\\s*\\)|\\[\\s*\\]|->\\*|->|<=>|<<=|>>=|<<|>>|<=|>=|==|!=|&&|\\|\\||\\+\\+|--|" +
        "\\+=|-=|\\*=|\\/=|%=|\\^=|&=|\\|=|[-+*\\/%^&|~!=<>,]" +
    ")",
    "g",
);

export interface ProtectedOperators {
    text: string;
    restore(text: string): string;
}

/**
 * Swaps operator names for plain identifiers so the bracket-matching code and tree-sitter
 * never see the "<", ">", "(" or ")" inside them. Previously only operator() was handled, so
 * "Foo::operator<(...)" (angle depth 1 when the "(" arrived) failed with "no parameter list found".
 */
export function protectOperators(source: string): ProtectedOperators {
    const operators: string[] = [];

    const text = source.replace(OPERATOR_PATTERN, (match) => {
        const rest = match.slice("operator".length).trim();
        // "new"/"delete" keep their space ("operator new[]"); symbol operators have none.
        const normalized = /^[A-Za-z]/.test(rest) ? `operator ${rest.replace(/\s+/g, "")}` : `operator${rest.replace(/\s+/g, "")}`;

        operators.push(normalized);
        return `revoltijoOperator${operators.length - 1}`;
    });

    return {
        text,
        restore: (value: string) => value.replace(/revoltijoOperator(\d+)/g, (whole, index) => operators[Number(index)] ?? whole),
    };
}

export interface SplitSignature {
    head: string;
    parameterListText: string;
    trailing: string;
}

const BRACKET_DEPTH_DELTA: Record<string, number> = {
    "(": 1,
    "[": 1,
    "<": 1,
    ")": -1,
    "]": -1,
    ">": -1,
};

export class SignaturePreprocessor {
    static balanceParens(source: string): string {
        let depth = 0;

        for (const char of source) {
            if (char === "(") depth++;
            else if (char === ")") depth--;
        }

        return depth > 0 ? source + ")".repeat(depth) : source;
    }

    static split(rawSignature: string): SplitSignature {
        const balanced = SignaturePreprocessor.balanceParens(rawSignature.trim());
        const { text: working, restore } = protectOperators(balanced);

        let angleDepth = 0;
        let parenStart = -1;

        for (let i = 0; i < working.length; i++) {
            const char = working[i];

            if (char === "(" && angleDepth === 0) {
                parenStart = i;
                break;
            }

            if (char === "<") angleDepth++;
            else if (char === ">") angleDepth--;
        }

        if (parenStart === -1) {
            throw new Error(`Not a function signature (no parameter list found): ${rawSignature}`);
        }

        let parenDepth = 0;
        let parenEnd = -1;

        for (let i = parenStart; i < working.length; i++) {
            if (working[i] === "(") parenDepth++;
            else if (working[i] === ")") {
                parenDepth--;
                if (parenDepth === 0) {
                    parenEnd = i;
                    break;
                }
            }
        }

        if (parenEnd === -1) {
            throw new Error(`Unbalanced parameter list: ${rawSignature}`);
        }

        return {
            head: restore(working.slice(0, parenStart)).trim(),
            parameterListText: restore(working.slice(parenStart + 1, parenEnd)),
            trailing: restore(working.slice(parenEnd + 1)).trim(),
        };
    }

    static splitParameters(parameterListText: string): string[] {
        const text = parameterListText.trim();
        if (!text) return [];

        const parts: string[] = [];
        let depth = 0;
        let current = "";

        for (const char of text) {
            depth += BRACKET_DEPTH_DELTA[char] ?? 0;

            if (char === "," && depth === 0) {
                parts.push(current);
                current = "";
                continue;
            }

            current += char;
        }

        parts.push(current);

        return parts.map((part) => SignaturePreprocessor.stripDefaultValue(part));
    }

    static stripDefaultValue(parameterText: string): string {
        let depth = 0;

        for (let i = 0; i < parameterText.length; i++) {
            const char = parameterText[i];
            depth += BRACKET_DEPTH_DELTA[char] ?? 0;

            const isPlainEquals = char === "=" && depth === 0 &&
                parameterText[i - 1] !== "=" && parameterText[i - 1] !== "!" &&
                parameterText[i - 1] !== "<" && parameterText[i - 1] !== ">" &&
                parameterText[i + 1] !== "=";

            if (isPlainEquals) return parameterText.slice(0, i).trim();
        }

        return parameterText.trim();
    }
}
