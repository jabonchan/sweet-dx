import { archivo, way } from "../deps.ts";

/** Extensions accepted inside the code/ folder. */
const CODE_EXTENSIONS = [".cpp", ".c", ".s"];

/**
 * Lists the project's input files, filtered by extension:
 *  - code: .cpp, .c and .s files from code/
 *  - symbols: .sym files from symbols/
 *  - hooks: .hks files from hooks/
 *  - include: header directory
 *
 * @param source Root folder of the project.
 */
export function getSourceFiles(source: string) {
    const code = archivo.listFiles(way.join(source, "./code"))
        .filter((file) => CODE_EXTENSIONS.includes(file.entry.extension ?? ""));

    const symbols = archivo.listFiles(way.join(source, "./symbols"))
        .filter((file) => file.entry.extension === ".sym");

    const hooks = archivo.listFiles(way.join(source, "./hooks"))
        .filter((file) => file.entry.extension === ".hks");

    const include = way.join(source, "./include");

    const seenFilenames = new Set<string>();

    for (const file of code) {
        const name = file.entry.stem?.toLowerCase();

        if (name === "crt0" || name === "trampolines") {
            throw new Error(
                "A source code file can't be named crt0 or trampolines (RESERVED FILENAMES)",
            );
        }

        if (!name) {
            throw new Error(
                "A source code file must have a name, it can't be just an extension",
            );
        }

        if (seenFilenames.has(name)) {
            throw new Error(
                `Each source code file must have an unique name. Two or more files have the same name; "${file
                    .entry.stem!}"`,
            );
        }

        seenFilenames.add(name);
    }

    return { code, symbols, hooks, include };
}
