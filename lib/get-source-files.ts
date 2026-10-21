import { archivo, way } from "../deps.ts";

const CODE_EXTENSIONS = [".cpp", ".c", ".s"];

export function getSourceFiles(source: string) {
    const code = archivo.listFiles(way.join(source, "./code"))
        .filter((file) => CODE_EXTENSIONS.includes(file.entry.extension ?? ""));

    const symbols = archivo.listFiles(way.join(source, "./symbols"))
        .filter((file) => file.entry.extension === ".sym");

    const hooks = archivo.listFiles(way.join(source, "./hooks"))
        .filter((file) => file.entry.extension === ".hks");

    return { code, symbols, hooks };
}
