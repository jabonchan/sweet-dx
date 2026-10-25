import { $, child_process, type shexec } from "./deps.ts";

/** Parses a command line, runs it synchronously and returns its output */
export function exec(template: TemplateStringsArray, ...substitutions: shexec.ShexecSubstitution) {
    let parsed: { executable: string; arguments: string[] };

    try {
        parsed = $.parse(template, ...substitutions);
    } catch {
        throw new Error("Invalid command line syntax: " + String.raw(template, ...substitutions));
    }

    const output = child_process.spawnSync(
        parsed.executable,
        parsed.arguments,
        // Read on every call, so changes made to Deno.env reach the child
        { stdio: "pipe", env: Deno.env.toObject(), cwd: Deno.cwd() },
    );

    if (output.error) {
        if ((output.error as unknown as { code: string }).code === "ENOENT")
            throw new Error(`Could not find an executable named "${parsed.executable}"`);

        throw new Error(`Failed to execute ${parsed.executable} due to ${output.error.message}`);
    }

    return output;
}
