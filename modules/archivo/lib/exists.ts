import { way } from "../deps.ts";

/** Checks whether `path` exists and is a file. Relative paths resolve from the cwd */
export function existsAsFile(path: string): boolean {
    if (way.isRelative(path))
        path = way.join(Deno.cwd(), path);
    else
        path = way.normalize(path);

    try {
        const stat = Deno.statSync(path);
        return stat.isFile;
    } catch {
        return false;
    }
}

/** Checks whether `path` exists and is a directory. Relative paths resolve from the cwd */
export function existsAsDirectory(path: string): boolean {
    if (way.isRelative(path))
        path = way.join(Deno.cwd(), path);
    else
        path = way.normalize(path);

    try {
        const stat = Deno.statSync(path);
        return stat.isDirectory;
    } catch {
        return false;
    }
}

/** Checks whether anything exists at `path`. Relative paths resolve from the cwd */
export function exists(path: string): boolean {
    if (way.isRelative(path))
        path = way.join(Deno.cwd(), path);
    else
        path = way.normalize(path);

    try {
        Deno.statSync(path);
        return true;
    } catch {
        return false;
    }
}
