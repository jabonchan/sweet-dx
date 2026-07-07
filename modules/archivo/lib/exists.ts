import { way } from "../deps.ts";

export function existsAsFile(path: string): boolean {
    if (way.isRelative(path)) {
        path = way.join(Deno.cwd(), path);
    } else {
        path = way.normalize(path);
    }
    
    try {
        const stat = Deno.statSync(path);
        return stat.isFile;
    } catch {
        return false;
    }
}

export function existsAsDirectory(path: string): boolean {
    if (way.isRelative(path)) {
        path = way.join(Deno.cwd(), path);
    } else {
        path = way.normalize(path);
    }
    
    try {
        const stat = Deno.statSync(path);
        return stat.isDirectory;
    } catch {
        return false;
    }
}

export function exists(path: string): boolean {
    if (way.isRelative(path)) {
        path = way.join(Deno.cwd(), path);
    } else {
        path = way.normalize(path);
    }

    try {
        Deno.statSync(path);
        return true;
    } catch {
        return false;
    }
}