import { utils, way, child_process, archivo, elfo } from "../deps.ts";

export function assembleInstruction(instr: string) {
    return utils.withTempDir((dirpath) => {
        const file = way.join(dirpath, "./temp.s");
        const code = `.section ".instruction"\n.arm\n.fpu crypto-neon-fp-armv8\n    ${instr.trim().toLowerCase()}\n`;
        const out = way.join(dirpath, "./temp.o");

        Deno.writeTextFileSync(file, code);

        const proc = child_process.spawnSync("clang", [
            file,
            "--target=armv7l-none-eabihf",
            "-mcpu=cortex-a57",
            "-mfpu=crypto-neon-fp-armv8",
            "-mfloat-abi=hard",
            "-o",
            out,
            "-c",
        ], { stdio: "pipe" });

        if (proc.status || !archivo.existsAsFile(out)) throw new Error("Failed to assemble instruction: " + instr);

        const elf = new elfo.Elf(out);
        const sec = elf.findSection(".instruction");

        if (!sec) {
            elf.file.close();
            throw new Error("Failed to assemble instruction: " + instr);
        }

        if (sec.size > 4n) {
            elf.file.close();
            throw new Error("Provided multiple instructions, only one at a time is supported: " + instr);
        }

        try {
            for (const [instr, _] of sec.read(4)) {
                elf.file.close();
                return instr;
            }

            throw new Error("Failed to assemble instruction: " + instr);
        } catch {
            elf.file.close();
            throw new Error("Failed to assemble instruction: " + instr);
        }
    })
}