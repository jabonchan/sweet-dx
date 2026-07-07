import { existsSync } from "node:fs";
import { way } from "../deps.ts";
import { existsAsDirectory, existsAsFile } from "./exists.ts";

export interface FSEnviroment {
    root: string,
    folders: string[],
    available: { folders: string[], files: string[] },
    files: string[]
}

export function checkEnviroment(env: FSEnviroment): void {
    const root = way.normalize(env.root);

    if (way.isRelative(root)) {
        throw new Error(`The provided root isn't a full path: "${env.root}"`);
    }

    const folders = env.folders.map(folder => way.join(root, folder));
    const files = env.files.map(file => way.join(root, file));
    const available = {
        folders: env.available.folders.map(folder => way.join(root, folder)),
        files: env.available.files.map(file => way.join(root, file))
    }

    for (const file of files) {
        if (!existsAsFile(file)) throw new Error(`FSEnviroment missing file: "${file}"`);
    }

    for (const folder of folders) {
        if (!existsAsDirectory(folder)) throw new Error(`FSEnviroment missing folder: "${folder}"`);
    }

    for (const file of available.files) {
        if (existsSync(file)) throw new Error(`FSEnviroment file already exists: "${file}"`);
        if (!existsAsDirectory(way.dirpath(file))) throw new Error(`FSEnviroment file has no existing parent directory: "${file}"`);
    }

    for (const folder of available.folders) {
        if (existsSync(folder)) throw new Error(`FSEnviroment folder already exists: "${folder}"`);
        if (!existsAsDirectory(way.dirpath(folder))) throw new Error(`FSEnviroment folder has no existing parent directory: "${folder}"`);
    }
}