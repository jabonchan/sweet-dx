import { way } from "../deps.ts";

export interface ExtractedAssets {
    dir: string;
    crt0: string;
    linker: string;
    sdk: string;
    cleanup: () => void;
}

export function extractAssets(): ExtractedAssets {
    const dir = Deno.makeTempDirSync({ prefix: "SweetDX-Temp-Assets-" });

    const extract = (name: string) => {
        const target = way.join(dir, name);
        const parsed = way.parse(
            way.join(import.meta.dirname!, "../assets", name),
        );

        Deno.writeFileSync(
            target,
            Deno.readFileSync(
                Deno.build.os === "windows"
                    ? parsed.entry.path.windows
                    : parsed.entry.path.unix,
            ),
        );
        return target;
    };

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
}
