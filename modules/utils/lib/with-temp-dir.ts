import { way } from "../deps.ts"

export function withTempDir<T extends unknown>(callback: (dirpath: string) => T): T {
    const dir = way.normalize(Deno.makeTempDirSync({ suffix: Math.random().toString(), prefix: "Deno-Temp" }));

    try {
        return callback(dir);
    } finally {
        Deno.removeSync(dir, { recursive: true });
    }
}