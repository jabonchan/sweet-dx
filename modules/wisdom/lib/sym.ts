import { hexify } from "../../utils/mod.ts";
import { archivo, utils } from "../deps.ts";

export type SymEntry = {
    readonly name: string;
    readonly address: number;
};

const STATEMENT_PATTERN = /^([^\s=]+)\s*=\s*(-?0x[0-9a-fA-F]+)\s*;$/i;

export class Sym {
    readonly file: archivo.Archivo;
    readonly symbols: readonly SymEntry[];

    constructor(public readonly path: string) {
        this.file = new archivo.Archivo(path);
        this.symbols = this.parse(this.file.readAsText());

        this.file.close();
    }

    findSymbol(name: string): SymEntry | undefined {
        return this.symbols.find((symbol) => symbol.name === name);
    }

    toLinker(path: string, offset: number): void {
        const text = this.symbols
            .toSorted((a, b) => a.address - b.address)
            .map(symbol => `${symbol.name} = ${hexify(symbol.address - offset)}`)
            .join(";\n") + ";\n";

        const file = new archivo.Archivo(path);
        
        file.writeAt(0x00, utils.encode(text));
        file.close();
    }

    private parse(text: string): SymEntry[] {
        const symbols: SymEntry[] = [];
        const lines = text.split(/\r\n|\r|\n/);

        for (let i = 0; i < lines.length; i++) {
            const commentIndex = lines[i].indexOf("#");
            const statement = (commentIndex === -1 ? lines[i] : lines[i].slice(0, commentIndex)).trim();

            if (statement.length === 0) continue;

            const match = statement.match(STATEMENT_PATTERN);

            if (!match) {
                throw new Error(`Invalid symbol definition at line ${i + 1} in "${this.path}": "${lines[i].trim()}".`);
            }

            const [, name, hex] = match;

            symbols.push({ name, address: utils.dehexify(hex) });
        }

        return symbols;
    }
}
