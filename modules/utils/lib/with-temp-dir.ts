import { attempt } from "./attempt.ts";
import { way } from "../deps.ts";

/**
 * Creates a temporary directory, runs `callback` with its path and removes the
 * directory afterwards, even if `callback` throws.
 */
export function withTempDir<T extends unknown>(
    callback: (dirpath: string) => T,
): T {
    const dir = way.normalize(
        Deno.makeTempDirSync({
            suffix: Math.random().toString(),
            prefix: "SweetDX-Temp-",
        }),
    );
    let result: T;

    try {
        result = callback(dir);
    } finally {
        attempt(
            () => Deno.removeSync(dir, { recursive: true }),
            () => {},
            "Failed to delete temporary SweetDX directory",
        );
    }

    return result;
}
