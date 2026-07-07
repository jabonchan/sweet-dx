import { createParser } from "https://deno.land/x/deno_tree_sitter@1.0.1.2/main/main.js";
import cpp from "https://esm.sh/gh/jeff-hykin/common_tree_sitter_languages@1.3.2.0/main/cpp.js";

// deno-lint-ignore no-explicit-any
export type SyntaxNode = any;

export class CppParser {
    private static instance: Promise<CppParser> | null = null;

    // deno-lint-ignore no-explicit-any
    private constructor(private readonly parser: any) {}

    static load(): Promise<CppParser> {
        if (!CppParser.instance) {
            CppParser.instance = createParser(cpp).then((parser: unknown) => new CppParser(parser));
        }

        return CppParser.instance;
    }

    parse(source: string): SyntaxNode {
        return this.parser.parse(source).rootNode;
    }

    static hasError(node: SyntaxNode): boolean {
        if (node.type === "ERROR" || node.isMissing) return true;

        for (let i = 0; i < node.childCount; i++) {
            if (CppParser.hasError(node.child(i))) return true;
        }

        return false;
    }

    static findFirstError(node: SyntaxNode): SyntaxNode | null {
        if (node.type === "ERROR" || node.isMissing) return node;

        for (let i = 0; i < node.childCount; i++) {
            const found = CppParser.findFirstError(node.child(i));
            if (found) return found;
        }

        return null;
    }
}