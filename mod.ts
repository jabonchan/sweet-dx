import { compile } from "./lib/compile.ts";
import { findMissingInputs, runFirstTimeSetup } from "./lib/setup.ts";
import { formatImportReport, importCodedx } from "./lib/import-codedx.ts";

const HELP = `SweetDX - a sweeter way to mod New Super Mario Bros. U Deluxe

Usage: sweetdx [options]

Run from the folder that contains ./source (code, hooks, nso, symbols).
On first run, SweetDX creates those folders for you and shows what to do next.

Options:
  -v, --verbose   Echo the full build log to the console (always saved to debug.log)
      --dry-run   Build and validate everything without writing into ./atmosphere
      --init      Set up ./source (create folders and show the guide) without building
      --no-gui    Never open windows or Explorer; print everything to the console
      --import-codedx <folder>
                  Import a checkout of RicBent/codedx (source, hooks, include, main.sym)
                  into this project. Never overwrites existing files.
      --allow-unresolved
                  Let undefined symbols link as address 0 instead of failing the build
      --skip-build-id-check
                  Build even if source/nso/main is not the supported game version
  -h, --help      Show this help
`;

const KNOWN = new Set([ "-v", "--verbose", "--dry-run", "--init", "--no-gui", "--allow-unresolved", "--skip-build-id-check", "-h", "--help" ]);

// "--import-codedx" takes a value, so pull it (and its value) out before checking the rest.
const args = [ ...Deno.args ];
let importFolder: string | undefined;
const importAt = args.indexOf("--import-codedx");

if (importAt !== -1) {
    importFolder = args[importAt + 1];

    if (!importFolder || importFolder.startsWith("-")) {
        console.error("--import-codedx needs the path to a codedx folder, e.g.  --import-codedx C:\\path\\to\\codedx\n");
        console.error(HELP);
        Deno.exit(2);
    }

    args.splice(importAt, 2);
}

const unknown = args.filter(arg => !KNOWN.has(arg));

if (args.includes("-h") || args.includes("--help")) {
    console.log(HELP);
    Deno.exit(0);
}

if (unknown.length > 0) {
    console.error(`Unknown option(s): ${unknown.join(", ")}\n`);
    console.error(HELP);
    Deno.exit(2);
}

if (importFolder !== undefined) {
    try {
        console.log(formatImportReport(importCodedx(importFolder)));
        Deno.exit(0);
    } catch (e) {
        console.error(`SweetDX: import failed.\n\n${e instanceof Error ? e.message : String(e)}`);
        Deno.exit(1);
    }
}

// First run (or --init): create the folders, open them and show what to do next. Nothing is built.
const needsSetup = findMissingInputs().length > 0;

if (args.includes("--init") || needsSetup) {
    if (!needsSetup) {
        console.log("Everything is already set up: the source folders and source/nso/main exist.");
        Deno.exit(0);
    }

    const result = runFirstTimeSetup({ gui: !args.includes("--no-gui") });

    console.log(`\n${result.message}\n`);
    Deno.exit(2); // setup was needed, so nothing was built
}

try {
    const summary = compile({
        verbose: args.includes("-v") || args.includes("--verbose"),
        dryRun: args.includes("--dry-run"),
        skipBuildIdCheck: args.includes("--skip-build-id-check"),
        allowUnresolved: args.includes("--allow-unresolved")
    });

    for (const warning of summary.warnings) console.warn(`WARNING: ${warning}`);

    console.log(`SweetDX: build succeeded in ${summary.durationMs} ms${summary.deployed ? "" : " (dry run, nothing written)"}`);
    console.log(`  ${summary.sources} source file(s), ${summary.symbolFiles} symbol file(s), ${summary.hooks} hook(s), ${summary.trampolines} trampoline(s), ${summary.patches} patch(es)`);

    if (summary.deployed) {
        console.log(`  subsdk0 -> ${summary.subsdk0}`);
        console.log(`  ips     -> ${summary.ips}`);
        console.log("  Copy the atmosphere folder to the root of your SD card to install.");
    }
} catch (e) {
    // compile() has already rolled back everything it created.
    // Never delete user folders here.
    console.error(`SweetDX: build failed.\n\n${e instanceof Error ? e.message : String(e)}\n`);
    console.error("Full details were saved to debug.log (or run again with --verbose).");
    Deno.exit(1);
}
