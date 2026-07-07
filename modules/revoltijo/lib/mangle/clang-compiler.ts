import { child_process } from "../../deps.ts";

export interface CompiledObject {
    objectPath: string;
    cleanup(): void;
}

export class ClangCompiler {
    constructor(private readonly targetTriple: string = "arm-none-eabi") {}

    compile(source: string): CompiledObject {
        const dir = Deno.makeTempDirSync({ prefix: "revoltijo-" });
        const sourcePath = `${dir}/signature.cpp`;
        const objectPath = `${dir}/signature.o`;

        const cleanup = (): void => {
            Deno.removeSync(dir, { recursive: true });
        };

        try {
            Deno.writeTextFileSync(sourcePath, source);

            const result = child_process.spawnSync("clang++", [
                "-c",
                `--target=${this.targetTriple}`,
                "-ffreestanding",
                "-fno-exceptions",
                "-fno-rtti",
                "-o",
                objectPath,
                sourcePath,
            ], { stdio: "pipe" });

            if (result.status !== 0) {
                const stderr = new TextDecoder().decode(result.stderr ?? new Uint8Array());
                throw new Error(
                    `clang++ failed to compile the generated signature:\n${stderr}\n\n--- generated source ---\n${source}`,
                );
            }

            return { objectPath, cleanup };
        } catch (error) {
            cleanup();
            throw error;
        }
    }
}
