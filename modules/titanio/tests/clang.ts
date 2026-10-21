import { utils, way } from "../deps.ts";
import type { TestSource } from "./sources/types.ts";

/** The SweetDX target (the same one getClangMacros() describes), C++20 for char8_t and <=>, no standard library. */
export const CLANG_ARGS: readonly string[] = [
    "--target=armv7l-none-eabihf",
    "-mcpu=cortex-a57",
    "-mfpu=crypto-neon-fp-armv8",
    "-mfloat-abi=hard",
    "-mabi=aapcs-linux",
    "-std=c++20",
    "-nostdlib",
    "-fno-exceptions",
    "-fno-rtti",
];

/** Whether `clang++` can be run. Every test is skipped otherwise. */
export const HAS_CLANG: boolean = (() => {
    try {
        return new Deno.Command("clang++", {
            args: ["--version"],
            stdout: "null",
            stderr: "null",
        }).outputSync().success;
    } catch {
        return false;
    }
})();

export interface CompiledSource {
    /** Every symbol defined in the assembly: labels and aliases (clang emits C1 constructors as `C1 = C2`). */
    symbols: Set<string>;
    /** clang's stderr when the source doesn't compile. */
    error?: string;
}

/** Builds the `.cpp` file of a test source: its prelude followed by every case's definition. */
export function renderSource(source: TestSource): string {
    return `${source.prelude.trim()}\n\n${
        source.cases.map(([, definition]) => definition.trim()).join("\n")
    }\n`;
}

/**
 * Writes every source to a single temporary directory right away, then compiles each one to assembly and reads
 * the symbols clang defines. The directory is removed before returning, the tests only need the symbols.
 */
export function compileSources(
    sources: readonly TestSource[],
): Map<string, CompiledSource> {
    return utils.withTempDir((dir) => {
        for (const source of sources) {
            Deno.writeTextFileSync(
                way.join(dir, `${source.name}.cpp`),
                renderSource(source),
            );
        }

        const compiled = new Map<string, CompiledSource>();

        for (const source of sources) {
            const input = way.join(dir, `${source.name}.cpp`);
            const output = way.join(dir, `${source.name}.s`);
            const result = new Deno.Command("clang++", {
                args: [...CLANG_ARGS, "-S", input, "-o", output],
            }).outputSync();

            if (!result.success) {
                compiled.set(source.name, {
                    symbols: new Set(),
                    error: new TextDecoder().decode(result.stderr),
                });
                continue;
            }

            const assembly = Deno.readTextFileSync(output);
            const symbols = new Set(
                [...assembly.matchAll(/^(_Z\w+)(?::| = )/gm)].map((match) =>
                    match[1]
                ),
            );

            compiled.set(source.name, { symbols });
        }

        return compiled;
    });
}

/** The symbols that look the most like `mangled` (longest common prefix), to make failures readable. */
export function closestSymbols(
    mangled: string,
    symbols: Set<string>,
    count: number = 3,
): string[] {
    const commonPrefix = (symbol: string) => {
        let i = 0;
        while (
            i < symbol.length && i < mangled.length && symbol[i] === mangled[i]
        ) i++;
        return i;
    };

    return [...symbols].sort((a, b) => commonPrefix(b) - commonPrefix(a)).slice(
        0,
        count,
    );
}
