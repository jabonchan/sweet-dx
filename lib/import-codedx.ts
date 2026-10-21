import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Imports a checkout of RicBent/codedx (GPL-3.0) into a SweetDX project.
 *
 *   codedx                  SweetDX
 *   source/**          ->   source/code/**
 *   hooks/**           ->   source/hooks/**
 *   include/**         ->   include/**          (compiled with -iquote/-I include)
 *   main.sym           ->   source/symbols/main.sym
 *
 * Nothing is ever overwritten: an existing, different file is skipped and reported.
 * codedx's linker.ld / sdk.ld are not copied; SweetDX ships its own in ./assets.
 */

export interface ImportReport {
    copied: string[];
    unchanged: string[];
    skippedExisting: string[];
    skippedCrt0: string[];
}

const IGNORED = new Set([ ".git", ".github", ".gitignore", ".DS_Store", "Thumbs.db" ]);

// SweetDX's assets/crt0.s already provides the .crt0 section. A second one fails the (strict) link.
const DEFINES_CRT0 = /\.section\s+"?\.crt0"?/;

/** What is missing from `root` for it to look like a codedx checkout (empty = looks fine). */
export function codedxProblems(root: string): string[] {
    const problems: string[] = [];

    if (!isDirectory(path.join(root, "source"))) problems.push("a \"source\" folder");
    if (!isDirectory(path.join(root, "hooks"))) problems.push("a \"hooks\" folder");
    if (!isFile(path.join(root, "main.sym"))) problems.push("a \"main.sym\" file");

    return problems;
}

export function importCodedx(codedxRoot: string, projectRoot: string = "."): ImportReport {
    const root = path.resolve(codedxRoot);

    if (!isDirectory(root)) throw new Error(`"${codedxRoot}" is not a folder.`);

    const problems = codedxProblems(root);

    if (problems.length > 0) {
        throw new Error(`"${codedxRoot}" does not look like a codedx checkout. It is missing: ${problems.join(", ")}.`);
    }

    const report: ImportReport = { copied: [], unchanged: [], skippedExisting: [], skippedCrt0: [] };
    const project = path.resolve(projectRoot);

    const folders: { from: string; to: string; scanCrt0: boolean }[] = [
        { from: "source", to: "source/code", scanCrt0: true },
        { from: "hooks", to: "source/hooks", scanCrt0: false },
        { from: "include", to: "include", scanCrt0: false },
    ];

    for (const { from, to, scanCrt0 } of folders) {
        const sourceDir = path.join(root, from);

        if (!isDirectory(sourceDir)) continue; // include/ is optional

        for (const file of walk(sourceDir)) {
            const relative = path.relative(sourceDir, file);
            const shown = path.posix.join(to, relative.split(path.sep).join("/"));

            if (scanCrt0 && /\.s$/i.test(file) && DEFINES_CRT0.test(fs.readFileSync(file, "utf8"))) {
                report.skippedCrt0.push(shown);
                continue;
            }

            copyFile(file, path.join(project, to, relative), shown, report);
        }
    }

    copyFile(path.join(root, "main.sym"), path.join(project, "source/symbols/main.sym"), "source/symbols/main.sym", report);

    return report;
}

function copyFile(from: string, to: string, shown: string, report: ImportReport): void {
    if (fs.existsSync(to)) {
        if (fs.readFileSync(from).equals(fs.readFileSync(to))) report.unchanged.push(shown);
        else report.skippedExisting.push(shown);

        return;
    }

    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    report.copied.push(shown);
}

function* walk(dir: string): Generator<string> {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (IGNORED.has(entry.name) || entry.isSymbolicLink()) continue;

        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) yield* walk(full);
        else if (entry.isFile()) yield full;
    }
}

function isDirectory(p: string): boolean {
    try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function isFile(p: string): boolean {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}

export function formatImportReport(report: ImportReport): string {
    const lines = [ `Imported ${report.copied.length} file(s) from codedx.` ];

    if (report.unchanged.length > 0) lines.push(`${report.unchanged.length} file(s) were already up to date.`);

    if (report.skippedExisting.length > 0) {
        lines.push("", "Skipped (a different file already exists; nothing was overwritten):");
        for (const file of report.skippedExisting) lines.push(`  ${file}`);
    }

    if (report.skippedCrt0.length > 0) {
        lines.push("", "Skipped (defines its own .crt0, but SweetDX already provides one in assets/crt0.s):");
        for (const file of report.skippedCrt0) lines.push(`  ${file}`);
        lines.push("If your code truly depends on that file's startup code, merge it into assets/crt0.s.");
    }

    lines.push(
        "",
        "codedx is GPL-3.0 licensed: keep its license and copyright notices with the code you imported.",
        "Next: put your game's main at source/nso/main, then run SweetDX again."
    );

    return lines.join("\n");
}
