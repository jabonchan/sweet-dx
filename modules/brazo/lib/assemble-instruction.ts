import { utils, way, child_process, archivo, elfo } from "../deps.ts";

const cache = new Map<string, Uint8Array>();

export function assembleInstruction(instr: string): Uint8Array {
    const key = instr.trim().toLowerCase();
    const cached = cache.get(key);

    if (cached) return cached.slice();

    const assembled = assembleUncached(instr);

    cache.set(key, assembled.slice());

    return assembled;
}

function assembleUncached(instr: string): Uint8Array {
    return utils.withTempDir((dirpath) => {
        const file = way.join(dirpath, "./temp.s");
        const code = `.section ".instruction"\n.arm\n.fpu crypto-neon-fp-armv8\n    ${instr.trim().toLowerCase()}\n`;
        const out = way.join(dirpath, "./temp.o");

        Deno.writeTextFileSync(file, code);

        const proc = child_process.spawnSync("clang++", [
            "--target=armv7l-none-eabihf",
            "-mcpu=cortex-a57",
            "-mfpu=crypto-neon-fp-armv8",
            "-mfloat-abi=hard",
            "-fPIC",
            "-nostdlib",
            "-fno-rtti",
            "-fno-exceptions",
            "-fpermissive",
            "-c",
            file,
            "-o",
            out
        ], { stdio: "pipe" });

        if (proc.error) {
            throw new Error(`Failed to run clang++ while assembling "${instr}": ${proc.error.message}`);
        }

        if (proc.status || !archivo.existsAsFile(out)) {
            // Surface clang's own explanation (e.g. "invalid operand") instead of a bare failure.
            const stderr = proc.stderr ? utils.decode(proc.stderr).trim() : "";

            throw new Error(`Failed to assemble instruction: ${instr}${stderr ? `\n${stderr.slice(0, 800)}` : ""}`);
        }

        const elf = new elfo.Elf(out);

        try {
            const sec = elf.findSection(".instruction");

            if (!sec) throw new Error("Failed to assemble instruction: " + instr);
            if (sec.size > 4n) throw new Error("Provided multiple instructions, only one at a time is supported: " + instr);

            for (const [bytes] of sec.read(4)) {
                return bytes.slice();
            }

            throw new Error("Failed to assemble instruction: " + instr);
        } finally {
            elf.file.close();
        }
    });
}
