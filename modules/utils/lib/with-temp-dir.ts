import { way } from "../deps.ts"

function sleepSync(ms: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * Removes a temp directory without ever throwing. On Windows a file that is
 * still open (or being scanned by antivirus) makes removal fail; throwing from a
 * `finally` would replace the real build error with a confusing "access denied".
 */
function removeQuietly(dir: string, attempts = 5): void {
    for (let i = 0; i < attempts; i++) {
        try {
            Deno.removeSync(dir, { recursive: true });
            return;
        } catch (error) {
            if (error instanceof Deno.errors.NotFound) return;
            if (i < attempts - 1) sleepSync(100 * (i + 1));
        }
    }

    console.warn(`SweetDX: could not remove temporary directory "${dir}". It is safe to delete manually.`);
}

export function withTempDir<T extends unknown>(callback: (dirpath: string) => T): T {
    const dir = way.normalize(Deno.makeTempDirSync({ suffix: Math.random().toString(), prefix: "Deno-Temp" }));

    try {
        return callback(dir);
    } finally {
        removeQuietly(dir);
    }
}
