import { SignatureParser } from "../parsing/signature-parser.ts";
import { SymbolExtractor } from "./symbol-extractor.ts";
import { SourceGenerator } from "../codegen/source-generator.ts";
import { ClangCompiler } from "./clang-compiler.ts";
import { CppParser } from "../parsing/cpp-parser.ts";

export class Mangler {
    private readonly signatureParser: SignatureParser;
    private readonly sourceGenerator = new SourceGenerator();
    private readonly clangCompiler = new ClangCompiler();
    private readonly symbolExtractor = new SymbolExtractor();

    private constructor(parser: CppParser) {
        this.signatureParser = new SignatureParser(parser);
    }

    static async create(): Promise<Mangler> {
        return new Mangler(await CppParser.load());
    }

    mangle(definition: string): string {
        const signature = this.signatureParser.parse(definition);
        const source = this.sourceGenerator.generate(signature);
        const compiled = this.clangCompiler.compile(source);

        try {
            const symbols = this.symbolExtractor.extract(compiled.objectPath);

            if (symbols.length !== 1) {
                throw new Error(
                    `Expected exactly one defined function symbol in the generated translation unit, found ` +
                        `${symbols.length}: ${symbols.join(", ") || "(none)"}.\n\n--- generated source ---\n${source}`,
                );
            }

            return symbols[0];
        } finally {
            compiled.cleanup();
        }
    }
}
