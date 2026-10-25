import { archivo, way } from "../deps.ts";

/** Makes path absolute and checks it's a folder, a file or available (parent exists) */
export function validatePath(path: string, type: "folder" | "file" | "available"): { path: string; valid: boolean } {
    // Relative paths are resolved against the current working directory
    if (way.isRelative(path))
        path = way.join(way.cwd(), path);

    switch (type) {
        case "folder":
            return { path, valid: archivo.existsAsDirectory(path) };
        case "file":
            return { path, valid: archivo.existsAsFile(path) };
        case "available":
            return { path, valid: !archivo.exists(path) && archivo.existsAsDirectory(way.dirpath(path)) };
    }
}
