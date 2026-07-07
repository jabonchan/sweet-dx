export interface ArrayDeclaratorMatch {
    typeText: string;
    kind: "reference" | "pointer";
    name: string | null;
    size: string | null;
}

export class ArrayDeclaratorMatcher {
    private static readonly PATTERN = /^(.*)\(\s*(&|\*)\s*([A-Za-z_]\w*)?\s*\)\s*\[\s*([^\]]*)\s*\]$/s;

    static match(parameterText: string): ArrayDeclaratorMatch | null {
        const match = ArrayDeclaratorMatcher.PATTERN.exec(parameterText.trim());
        if (!match) return null;

        const [, typeText, marker, name, size] = match;

        return {
            typeText: typeText.trim(),
            kind: marker === "&" ? "reference" : "pointer",
            name: name || null,
            size: size.trim() || null,
        };
    }
}
