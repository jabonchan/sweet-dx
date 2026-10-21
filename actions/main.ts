import { extractAssets, type ExtractedAssets } from "../lib/extract-assets.ts";
import { IncompatibleFlags, parseArgv } from "../lib/parse-argv.ts";
import { validatePath } from "../lib/validate-path.ts";
import { Recuerdo, way } from "../deps.ts";
import { compile } from "./compile.ts";

import metadata from "../deno.json" with { type: "json" };

/** Prints "<name> v<version> by <author>", taken from deno.json's "@author/name". */
function printHeader() {
    const [author, name] = metadata.name.split("/");
    console.log(`${name} v${metadata.version} by ${author}\n`);
}

/**
 * CLI entry point. Dispatches to --version, --help, --init or compilation
 * depending on the flags passed.
 *
 * @param argv Command line arguments (without the executable/script).
 * @returns Process exit code: 0 on success, non-zero on failure.
 */
export function main(argv: string[]): number {
    // ---------------------------------------------------------------------
    // Step 1: Parse the arguments
    // ---------------------------------------------------------------------
    // parseArgv already prints the error, so we only need to exit.
    const context = parseArgv(argv);
    if (!context) return 1;

    // ---------------------------------------------------------------------
    // Step 2: Reject incompatible flag combinations
    // ---------------------------------------------------------------------
    for (const { flag, conflicts, message } of IncompatibleFlags) {
        if (context[flag] && conflicts.some((conflict) => context[conflict])) {
            console.error(message);
            return 1;
        }
    }

    // ---------------------------------------------------------------------
    // Step 3: --version
    // ---------------------------------------------------------------------
    if (context.version) {
        console.log(metadata.version);
        return 0;
    }

    // ---------------------------------------------------------------------
    // Step 4: --help
    // ---------------------------------------------------------------------
    if (context.help) {
        printHeader();

        console.log(
            `Usage:
  sweetdx --source=<dir> --output=<path> --log-file=<path> [--verbose]
  sweetdx --init=<path>
  sweetdx --help
  sweetdx --version

Example:
  sweetdx --output=./output --log-file=debug.log --source=./source

Compile:
  --source=<dir>      Directory containing the source files to compile
  --output=<path>     Where to write the compiled binary and patch (must not exist yet)
  --log-file=<path>   Where to write the compilation log (must not exist yet)
  --verbose           Prints the compilation log to the terminal too

Other:
  --init=<path>       Create a new project at <path> (must not exist yet)
  --help              Show this help message and exit
  --version           Print the version number and exit

Notes:
  Flags that take a value must use the form --flag=value.
  --help, --version and --init can't be combined with other flags.`,
        );

        return 0;
    }

    // ---------------------------------------------------------------------
    // Step 5: --init (create a new empty project)
    // ---------------------------------------------------------------------
    if (context.init) {
        // The target must not exist yet, but its parent directory must.
        const init = validatePath(context.init, "available");

        if (!init.valid) {
            console.error(
                "Error: path passed to --init isn't available (Already exists? Parent directory doesn't exists?)",
            );
            return 1;
        }

        printHeader();

        // Create the project root and its subfolders.
        try {
            Deno.mkdirSync(init.path);
            Deno.mkdirSync(way.join(init.path, "./code"));
            Deno.mkdirSync(way.join(init.path, "./hooks"));
            Deno.mkdirSync(way.join(init.path, "./include"));
            Deno.mkdirSync(way.join(init.path, "./nso"));
            Deno.mkdirSync(way.join(init.path, "./symbols"));
        } catch (e) {
            // Remove whatever was partially created before reporting the error.
            try {
                Deno.removeSync(init.path, { recursive: true });
            } catch {
                // .
            }

            console.error(
                `Error: Failed to create a new project due to ${
                    (e as Error).message
                }`,
            );
            return 1;
        }

        console.log(
            `Success! Created the following structure:
    ${init.path}
        |
        |- code     Your .cpp, .c and .s files go here
        |- hooks    Your .hks files go here
        |- include  Your .hpp and .h files go here
        |- nso      Your main (NSMBUDX main.nso) goes here
        -- symbols  Your .sym files go here`,
        );

        return 0;
    }

    // ---------------------------------------------------------------------
    // Step 6: Validate the compilation flags
    // ---------------------------------------------------------------------
    // Compiling requires --source, --log-file and --output.
    if (!context.source || !context.logFile || !context.output) {
        console.error(
            `Error: Missing one or more values for the following flags: --source, --log-file and/or --output`,
        );
        return 1;
    }

    // The log file and output must not exist yet (their parent must);
    // the source must be an existing directory.
    const log = validatePath(context.logFile, "available");
    const source = validatePath(context.source, "folder");
    const output = validatePath(context.output, "available");

    if (!log.valid) {
        console.error(
            "Error: path passed to --log-file isn't available (Already exists? Parent directory doesn't exists?)",
        );
        return 1;
    }

    if (!output.valid) {
        console.error(
            "Error: path passed to --output isn't available (Already exists? Parent directory doesn't exists?)",
        );
        return 1;
    }

    if (!source.valid) {
        console.error(
            "Error: path passed to --source isn't a valid directory (Doesn't exists? Is a file?)",
        );
        return 1;
    }

    printHeader();

    // ---------------------------------------------------------------------
    // Step 7: Set up the global logger
    // ---------------------------------------------------------------------
    // Everything logged through Recuerdo goes to the log file; with
    // --verbose it's also printed to the terminal.
    if (context.verbose) {
        new Recuerdo(log.path, true).registerAsGlobal();
    } else {
        new Recuerdo(log.path).registerAsGlobal();
    }

    // ---------------------------------------------------------------------
    // Step 8: Extract the bundled assets (crt0 and linker scripts)
    // ---------------------------------------------------------------------
    let assets: ExtractedAssets;

    try {
        assets = extractAssets();
    } catch (e) {
        Recuerdo.error(
            `Failed to extract assets due to ${(e as Error).message}`,
        );
        return 1;
    }

    // ---------------------------------------------------------------------
    // Step 9: Compile
    // ---------------------------------------------------------------------
    // The extracted assets are always cleaned up afterwards. On failure
    // (non-zero status or thrown error) the partially written output folder
    // is removed so the user can re-run with the same --output.
    try {
        const status = compile(output.path, source.path, assets);
        assets.cleanup();

        if (status) {
            console.error(
                `Compilation failed! Check the log (${log.path}) for more details`,
            );

            try {
                Deno.removeSync(output.path, { recursive: true });
            } catch {
                // .
            }

            return status;
        } else {
            console.log(
                `Finished. Compiled binary and patch are available at ${output.path}`,
            );
        }

        return 0;
    } catch (e) {
        // Unexpected error thrown from compile(): log it and clean up.
        assets.cleanup();
        Recuerdo.error(e);
        console.error(
            `Compilation failed! Check the log (${log.path}) for more details`,
        );

        try {
            Deno.removeSync(output.path, { recursive: true });
        } catch {
            // .
        }

        return 1;
    }
}
