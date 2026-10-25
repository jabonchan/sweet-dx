import { archivo, elfo, principe, titanio, utils, way } from "../deps.ts";

const cache = new Map<string, Uint8Array>();

/** Assembles one ARM instruction into its 4 bytes with clang++, cached */
export function assembleInstruction(instr: string): Uint8Array {
    const key = instr.replace(/\s+/g, " ").trim();
    const cached = cache.get(key);

    if (cached) return new Uint8Array(cached);

    const assembled = assembleUncached(instr);
    cache.set(key, new Uint8Array(assembled));

    return assembled;
}

/** Assembles the instruction in a temp dir and reads it back from the .instruction section */
function assembleUncached(instr: string): Uint8Array {
    titanio.checkClangVersion();
    titanio.cleanEnv();

    return utils.withTempDir((dirpath) => {
        const file = way.join(dirpath, "./temp.s");
        const code = `.section ".instruction"\n.arm\n.fpu crypto-neon-fp-armv8\n    ${instr.trim()}\n`;
        const out = way.join(dirpath, "./temp.o");

        Deno.writeTextFileSync(file, code);

        const output = principe.exec`clang++
            --no-default-config
            --target=armv7l-none-eabihf
            -mcpu=cortex-a57
            -mfpu=crypto-neon-fp-armv8
            -mfloat-abi=hard
            -mabi=aapcs-linux
            -fPIC
            -nostdlib
            -fno-rtti
            -fno-exceptions
            -fpermissive
            -c

            ${file}

            -o

            ${out}
        `;

        if (output.status || !archivo.existsAsFile(out)) {
            const stderr = output.stderr ? utils.decode(output.stderr).trim() : "";
            throw new Error(`Failed to assemble instruction: ${instr}${stderr ? `\n${stderr.slice(0, 800)}` : ""}`);
        }

        const elf = new elfo.Elf(out);

        try {
            const sec = elf.findSection(".instruction");

            if (!sec)
                throw new Error("Failed to assemble instruction: " + instr);
            if (sec.size > 4n)
                throw new Error("Provided multiple instructions, only one at a time is supported: " + instr);
            for (const [bytes] of sec.read(4)) return bytes;

            throw new Error("Failed to assemble instruction: " + instr);
        } finally {
            elf.file.close();
        }
    });
}
