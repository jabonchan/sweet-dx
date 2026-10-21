// Compiles hard C++ definitions with clang (for the SweetDX target) and checks that titanio mangles the same
// signatures into exactly the symbols clang emits. Every test is skipped when clang++ is not installed.
import { closestSymbols, compileSources, HAS_CLANG } from "./clang.ts";
import { assert, assertEquals, fail } from "@std/assert";
import { SOURCES } from "./sources/mod.ts";
import { mangle } from "../mod.ts";

// Written to a single temporary directory and compiled as soon as this file is loaded
const COMPILED = HAS_CLANG ? compileSources(SOURCES) : new Map();

for (const source of SOURCES) {
    const compiled = () => COMPILED.get(source.name)!;

    Deno.test(
        { name: `${source.name}.cpp compiles`, ignore: !HAS_CLANG },
        () => {
            if (compiled().error) fail(compiled().error);
        },
    );

    for (const [signature, , options] of source.cases) {
        const compare = () => {
            const { symbols, error } = compiled();

            if (error) fail(`${source.name}.cpp doesn't compile`);

            const mangled = mangle(signature);

            assert(
                symbols.has(mangled),
                `clang doesn't define ${mangled}\nClosest symbols of ${source.name}.cpp:\n  ${
                    closestSymbols(mangled, symbols).join("\n  ")
                }`,
            );
        };

        if (options?.knownMismatch) {
            continue;
        }

        Deno.test(
            { name: `${source.name}: ${signature}`, ignore: !HAS_CLANG },
            compare,
        );
    }

    // Guards against two cases passing with the same symbol
    Deno.test({
        name: `${source.name}: every signature has its own symbol`,
        ignore: !HAS_CLANG,
    }, () => {
        const seen = new Map<string, string>();

        for (const [signature] of source.cases) {
            let mangled: string;

            try {
                mangled = mangle(signature);
            } catch {
                continue;
            }

            assertEquals(
                seen.get(mangled),
                undefined,
                `"${signature}" and "${
                    seen.get(mangled)
                }" both mangle to ${mangled}`,
            );
            seen.set(mangled, signature);
        }
    });
}
