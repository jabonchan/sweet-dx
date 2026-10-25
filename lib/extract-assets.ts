import { way } from "../deps.ts";

/** Paths to the bundled assets after they've been copied to a temp folder */
export interface ExtractedAssets {
    /** Temp folder holding all the extracted assets */
    dir: string;
    /** Startup assembly, compiled together with the user's code */
    crt0: string;
    /** Main linker script */
    linker: string;
    /** Linker script with the SDK's symbols */
    sdk: string;
    /** Deletes `dir` and everything inside it. Never throws */
    cleanup: () => void;
}

/** Copies crt0.s, linker.ld and sdk.ld to a temp folder so clang and ld can read them */
export function extractAssets(): ExtractedAssets {
    const dir = Deno.makeTempDirSync({ prefix: "SweetDX-Temp-Assets-" });

    // Copies assets/<name> into the temp folder and returns its new path
    const extract = (name: string) => {
        const target = way.join(dir, name);
        const parsed = way.parse(way.join(import.meta.dirname!, "../assets", name));

        // Use the path format that matches the current OS
        Deno.writeFileSync(target, Deno.readFileSync(Deno.build.os === "windows" ? parsed.entry.path.windows : parsed.entry.path.unix));
        return target;
    };

    try {
        return {
            dir,
            crt0: extract("crt0.s"),
            linker: extract("linker.ld"),
            sdk: extract("sdk.ld"),
            cleanup: () => {
                try {
                    Deno.removeSync(dir, { recursive: true });
                } catch { /* */ }
            },
        };
    } catch (e) {
        try {
            Deno.removeSync(dir, { recursive: true });
        } catch { /* */ }

        throw e;
    }
}
