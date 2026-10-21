import { archivo, way } from "../deps.ts";

/**
 * Resolves `path` to an absolute path and checks it against `type`:
 *  - "folder": must be an existing directory.
 *  - "file": must be an existing file.
 *  - "available": must not exist, but its parent directory must
 *    (i.e. it can be created).
 *
 * @returns The absolute path and whether it passed the check.
 */
export function validatePath(
    path: string,
    type: "folder" | "file" | "available",
): {
    path: string;
    valid: boolean;
} {
    // Relative paths are resolved against the current working directory.
    if (way.isRelative(path)) {
        path = way.join(way.cwd(), path);
    }

    switch (type) {
        case "folder":
            return { path, valid: archivo.existsAsDirectory(path) };
        case "file":
            return { path, valid: archivo.existsAsFile(path) };
        case "available":
            return {
                path,
                valid: !archivo.exists(path) &&
                    archivo.existsAsDirectory(way.dirpath(path)),
            };
    }
}
