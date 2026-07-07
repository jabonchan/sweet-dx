import { way } from "../deps.ts";
import { existsAsDirectory } from "./exists.ts";

export function listFiles(path: string, array: way.ParsedPath[] = []) {
    path = way.normalize(path);

    if (way.isRelative(path)) path = way.join(way.cwd(), path);
    if (!existsAsDirectory(path)) throw new Error("Invalid directory for read: " + path);

    for (const entry of Deno.readDirSync(path)) {
        const entrypath = way.join(path, entry.name);

        if (entry.isSymlink) continue;
        if (entry.isDirectory) {
            listFiles(entrypath, array);
            continue;
        }

        array.push(way.parse(entrypath));
    }

    return array;
}