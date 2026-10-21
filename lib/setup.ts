import * as modules from "../deps.ts";

export const REQUIRED_FOLDERS = [ "./source/code", "./source/hooks", "./source/nso", "./source/symbols" ];
export const REQUIRED_FILES = [ "./source/nso/main" ];

export const LAYOUT_HELP = `  source/
    code/      your .cpp / .c / .s files
    hooks/     your .hks hook files
    symbols/   your .sym symbol files
    nso/
      main     the game's main (NSO) file, v1.0.0`;

const NOTE_PATH = "./source/nso/PUT_MAIN_HERE.txt";
const DIALOG_TITLE = "SweetDX - first-time setup";

/** Everything a build needs that is not there yet. */
export function findMissingInputs(): string[] {
    const missing: string[] = [];

    for (const folder of REQUIRED_FOLDERS) {
        if (!modules.archivo.existsAsDirectory(folder)) missing.push(`folder  ${folder}`);
    }

    for (const file of REQUIRED_FILES) {
        if (!modules.archivo.existsAsFile(file)) missing.push(`file    ${file}`);
    }

    return missing;
}

/** Creates any missing source folders plus a reminder note. Never touches existing files. */
export function createSourceLayout(): string[] {
    const created: string[] = [];

    for (const folder of REQUIRED_FOLDERS) {
        if (!modules.archivo.existsAsDirectory(folder)) {
            Deno.mkdirSync(folder, { recursive: true });
            created.push(folder.replace("./", ""));
        }
    }

    if (!modules.archivo.existsAsFile("./source/nso/main") && !modules.archivo.existsAsFile(NOTE_PATH)) {
        Deno.writeTextFileSync(
            NOTE_PATH,
            "Place your own legally obtained copy of the game's main file here, named exactly \"main\" (no extension).\r\n" +
            "It must be New Super Mario Bros. U Deluxe v1.0.0.\r\n"
        );
    }

    return created;
}

/** The text shown both in the dialog window and in the console. Pure, so it is easy to test. */
export function buildGuideText(sourceDir: string, created: string[], mainStillMissing: boolean): string {
    const lines: string[] = [
        "SweetDX needs a one-time setup before it can build.",
        ""
    ];

    if (created.length > 0) {
        lines.push("I created these folders for you:");
        for (const folder of created) lines.push(`    ${folder}`);
    } else {
        lines.push("Your source folders already exist.");
    }

    lines.push(
        "",
        `Location: ${sourceDir}`,
        "",
        "What to do next:",
        "",
        "  1. Copy your own legally obtained copy of the game's main file",
        "     (New Super Mario Bros. U Deluxe v1.0.0) into the \"nso\" folder.",
        "     It must be named exactly \"main\" (no file extension).",
        "",
        "  2. Put your mod files in the other folders:",
        "       code      your .cpp / .c / .s files",
        "       hooks     your .hks hook files",
        "       symbols   your .sym symbol files",
        "",
        "  3. Run SweetDX again."
    );

    if (!mainStillMissing) {
        lines.push("", "(source/nso/main was found, so you can skip step 1.)");
    }

    return lines.join("\n");
}

function run(command: string, args: string[], env: Record<string, string> = {}): void {
    try {
        modules.child_process.spawnSync(command, args, {
            stdio: "ignore",
            env: { ...Deno.env.toObject(), ...env }
        });
    } catch {
        // No file manager / dialog tool available: the console text is still printed.
    }
}

function openFolder(dir: string): void {
    switch (Deno.build.os) {
        case "windows": return run("explorer.exe", [ dir ]);
        case "darwin": return run("open", [ dir ]);
        default: return run("xdg-open", [ dir ]);
    }
}

/** Blocks until the user closes the dialog. The text travels via an env var to avoid any quoting issues. */
function showDialog(message: string): void {
    const env = { SWEETDX_MSG: message, SWEETDX_TITLE: DIALOG_TITLE };

    switch (Deno.build.os) {
        case "windows":
            return run("powershell", [
                "-NoProfile",
                "-WindowStyle", "Hidden",
                "-Command",
                // A hidden top-most owner form keeps the dialog above the Explorer window we just opened.
                "Add-Type -AssemblyName System.Windows.Forms; " +
                "$f = New-Object System.Windows.Forms.Form -Property @{ TopMost = $true }; " +
                "[void][System.Windows.Forms.MessageBox]::Show($f, $env:SWEETDX_MSG, $env:SWEETDX_TITLE, 'OK', 'Information')"
            ], env);
        case "darwin":
            return run("osascript", [
                "-e",
                "display dialog (system attribute \"SWEETDX_MSG\") with title (system attribute \"SWEETDX_TITLE\") buttons {\"OK\"} default button \"OK\""
            ], env);
        default:
            return run("zenity", [ "--info", "--no-markup", "--title", DIALOG_TITLE, "--text", message ]);
    }
}

export interface SetupResult {
    created: string[];
    message: string;
}

/**
 * First-run experience: create the folders, open them, and show what to do next.
 * With gui = false it only creates the folders and returns the text.
 */
export function runFirstTimeSetup(options: { gui: boolean }): SetupResult {
    const created = createSourceLayout();
    const sourceDir = Deno.realPathSync("./source");
    const message = buildGuideText(sourceDir, created, !modules.archivo.existsAsFile("./source/nso/main"));

    if (options.gui) {
        openFolder(sourceDir);
        showDialog(message);
    }

    return { created, message };
}
