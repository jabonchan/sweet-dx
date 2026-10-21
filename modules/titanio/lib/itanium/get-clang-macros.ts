import { principe, Recuerdo, utils, way } from "../../deps.ts";

let MACROS = "";
let CHECKED_CLANGPP = false;
let CHECKED_CLANG = false;

// Environment variables that change clang's command line or header search, so the dump doesn't depend on the machine
const IGNORED_ENV = new Set([
    "CPATH",
    "C_INCLUDE_PATH",
    "CPLUS_INCLUDE_PATH",
    "CCC_OVERRIDE_OPTIONS",
]);

/** Removes the variables of IGNORED_ENV from Deno.env, so the clang++ processes started afterwards don't see them. */
export function cleanEnv(): void {
    // Names are case-insensitive on Windows
    for (const name of Object.keys(Deno.env.toObject())) {
        if (IGNORED_ENV.has(name.toUpperCase())) Deno.env.delete(name);
    }
}

// --no-default-config was added in clang 16
const MIN_CLANG_VERSION = 16;

/** Fails unless `clang++` (or `clang`) is installed and at least `MIN_CLANG_VERSION`. */
export function checkClangVersion(isCPP: boolean = true): void {
    if (isCPP && CHECKED_CLANGPP) return;
    if (!isCPP && CHECKED_CLANG) return;

    const tool = isCPP ? `clang++` : "clang";
    const output = principe.exec`${tool} --version`;
    const text = utils.decode(output.stdout);
    // "clang version 21.1.8 (...)", "Apple clang version 15.0.0 (...)", "Ubuntu clang version 18.1.3 (...)"
    const major = Number(/clang version (\d+)\./.exec(text)?.[1]);

    if (output.status !== 0 || !major) {
        throw new Error(
            `Could not read the version of ${tool} from "${tool} --version":\n${
                (text || utils.decode(output.stderr)).trim()
            }`,
        );
    }

    if (major < MIN_CLANG_VERSION) {
        throw new Error(
            `${tool} ${major} is too old, titanio needs ${tool} ${MIN_CLANG_VERSION} or newer`,
        );
    }

    if (isCPP) CHECKED_CLANGPP = true;
    else CHECKED_CLANG = true;
}

/**
 * Dumps the predefined macros of `clang++` for the game's target (32-bit ARM,
 * Cortex-A57), after including a few standard headers so their typedefs and
 * library macros show up too. The result is cached for the whole run.
 */
export function getClangMacros(): string {
    if (MACROS) {
        Recuerdo.log("Using cached clang++ macros");
        return MACROS;
    }

    return utils.withTempDir((dirpath) => {
        const filepath = way.join(dirpath, "./macros.cpp");

        Deno.writeTextFileSync(
            filepath,
            `#if __has_include(<version>)
#include <version>
#endif
#if __has_include(<cstddef>)
#include <cstddef>
#endif
#if __has_include(<cstdint>)
#include <cstdint>
#endif
#if __has_include(<cstdarg>)
#include <cstdarg>
#endif`,
        );

        cleanEnv();
        checkClangVersion();

        // --no-default-config: config files (clang++.cfg, <triple>-clang++.cfg) can add flags such as -stdlib= or -isystem
        const output = principe.exec`
            clang++
                --no-default-config
                --target=armv7l-none-eabihf
                -mcpu=cortex-a57
                -mfpu=crypto-neon-fp-armv8
                -mfloat-abi=hard
                -mabi=aapcs-linux
                -dM
                -E
                -x c++
                ${filepath}`;

        const stdout = utils.decode(output.stdout).trim().replace(/\r/g, "");

        // Without the dump, the typedefs and the data model silently fall back to defaults and the symbols are wrong
        if (output.status !== 0) {
            throw new Error(
                `clang++ failed to dump its predefined macros (exit code ${output.status}):\n${
                    utils.decode(output.stderr).trim()
                }`,
            );
        }
        if (!/^#define __SIZE_TYPE__ /m.test(stdout)) {
            throw new Error(
                `clang++ didn't report its predefined macros (no __SIZE_TYPE__ in the output):\n${stdout}`,
            );
        }

        MACROS = stdout;

        Recuerdo.log(`Dumped clang++ macros:\n${MACROS}`);
        return MACROS;
    });
}
