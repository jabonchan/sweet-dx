import { hexify } from "../../utils/mod.ts";
import { archivo, utils } from "../deps.ts";

export type SymEntry = {
    readonly name: string;
    readonly address: number;
};

// The trailing ";" is optional: codedx's own main.sym omits it on its first entry.
const STATEMENT_PATTERN = /^([^\s=]+)\s*=\s*(-?0x[0-9a-fA-F]+)\s*;?$/i;

/** A parsed `.sym` file: `name = 0xADDRESS;` lines, with `#` comments. */
export class Sym {
    readonly file: archivo.Archivo;
    readonly symbols: readonly SymEntry[];

    /** Reads and parses the `.sym` file at `path`, then closes it. */
    constructor(public readonly path: string) {
        this.file = new archivo.Archivo(path, { readOnly: true });

        try {
            this.symbols = this.parse(this.file.readAsText());
        } finally {
            this.file.close();
        }
    }

    /** Returns the symbol named `name`, if any. */
    findSymbol(name: string): SymEntry | undefined {
        return this.symbols.find((symbol) => symbol.name === name);
    }

    /**
     * Writes the symbols as a linker script of `name = address;` assignments,
     * sorted by address, with `offset` subtracted from every address.
     */
    toLinker(path: string, offset: number): void {
        const text = this.symbols
            .toSorted((a, b) => a.address - b.address)
            .map((symbol) =>
                `${symbol.name} = ${hexify(symbol.address - offset)}`
            )
            .join(";\n") + ";\n";

        const file = new archivo.Archivo(path, { empty: true });

        try {
            file.writeAt(0x00, utils.encode(text));
        } finally {
            file.close();
        }
    }

    /** Parses every line, failing on invalid syntax or duplicate names. */
    private parse(text: string): SymEntry[] {
        const symbols: SymEntry[] = [];
        const firstSeenAt = new Map<string, number>();
        const lines = text.split(/\r\n|\r|\n/);

        for (let i = 0; i < lines.length; i++) {
            const commentIndex = lines[i].indexOf("#");
            const statement = (commentIndex === -1
                ? lines[i]
                : lines[i].slice(0, commentIndex)).trim();

            if (statement.length === 0) {
                continue;
            }

            const match = statement.match(STATEMENT_PATTERN);

            if (!match) {
                throw new Error(
                    `Invalid symbol definition at line ${
                        i + 1
                    } in "${this.path}": "${lines[i].trim()}".`,
                );
            }

            const [, name, hex] = match;
            const first = firstSeenAt.get(name);

            if (first !== undefined) {
                throw new Error(
                    `Duplicate symbol "${name}" at line ${
                        i + 1
                    } in "${this.path}" (first defined at line ${first}).`,
                );
            }

            firstSeenAt.set(name, i + 1);
            const address = utils.dehexify(hex);

            if (address < 0) {
                throw new Error("Addresses can't be negative!");
            }

            symbols.push({ name, address });
        }

        return symbols;
    }
}
