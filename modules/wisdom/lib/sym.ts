import { archivo, titanio, utils } from "../deps.ts";
import { hexify } from "../../utils/mod.ts";

export type SymEntry = {
    readonly name: string;
    /** The `as C1`...`as D2` of a C++ constructor/destructor signature, if it has one */
    readonly variant: titanio.SpecialVariant | "default";
    readonly address: number;
    readonly line: number;
};

// The ; is optional (codedx's main.sym misses one), names can be signatures with "as D0" and such
const STATEMENT_PATTERN = /^(.+?)(?:\s+as\s+(C[123]|D[012]))?\s*=\s*(-?0x[0-9a-fA-F]+)\s*;?$/i;

/** A parsed `.sym` file: `name = 0xADDRESS;` lines, with `#` comments */
export class Sym {
    readonly file: archivo.Archivo;
    readonly symbols: readonly SymEntry[];

    /** Reads and parses the `.sym` file at `path`, then closes it */
    constructor(public readonly path: string) {
        this.file = new archivo.Archivo(path, { readOnly: true });

        try {
            this.symbols = this.parse(this.file.readAsText());
        } finally {
            this.file.close();
        }
    }

    /** Linker script sorted by address, signatures are mangled first and duplicates are an error */
    toLinker(path: string, offset: number): void {
        const firstSeenAt = new Map<string, SymEntry>();

        for (const symbol of this.symbols) {
            const name = this.linkableName(symbol);
            const first = firstSeenAt.get(name);

            if (first !== undefined) {
                throw new Error(
                    `Duplicate symbol "${name}" at line ${symbol.line} in "${this.path}" ("${symbol.name}"), first defined at line ${first.line} ("${first.name}").`,
                );
            }

            firstSeenAt.set(name, symbol);
        }

        const sorted = [ ...firstSeenAt ].toSorted(([, a], [, b]) => a.address - b.address);
        const text = sorted.map(([name, symbol]) => `${name} = ${hexify(symbol.address - offset)}`).join(";\n") + ";\n";

        const file = new archivo.Archivo(path, { empty: true });

        try {
            file.writeAt(0x00, utils.encode(text));
        } finally {
            file.close();
        }
    }

    /** Mangled goes first since _ZN3FooC1Ev is also a valid C name, no variant means C1/D1 */
    private linkableName(symbol: SymEntry): string {
        const { name, variant, line } = symbol;

        if (titanio.isMangledCppSignature_FAST(name) || titanio.isCFunctionName(name)) {
            if (variant !== "default") {
                throw new Error(
                    `Symbol "${name}" at line ${line} in "${this.path}" can't use "as ${variant}", only C++ constructor and destructor signatures can.`,
                );
            }

            return name;
        }

        try {
            return titanio.mangleAs(name, variant);
        } catch (error) {
            throw new Error(
                `Symbol "${name}" (variant: ${variant}) at line ${line} in "${this.path}" could not be resolved as a C name, a mangled C++ symbol or a C++ function signature:\n${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /** Duplicates are checked in toLinker once everything is mangled */
    private parse(text: string): SymEntry[] {
        const symbols: SymEntry[] = [];
        const lines = text.split(/\r\n|\r|\n/);

        for (let i = 0; i < lines.length; i++) {
            const commentIndex = lines[i].indexOf("#");
            const statement = (commentIndex === -1 ? lines[i] : lines[i].slice(0, commentIndex)).trim();

            if (statement.length === 0)
                continue;

            const match = statement.match(STATEMENT_PATTERN);

            if (!match)
                throw new Error(`Invalid symbol definition at line ${i + 1} in "${this.path}": "${lines[i].trim()}".`);

            const [, name, variant, hex] = match;
            const address = utils.dehexify(hex);

            if (address < 0)
                throw new Error("Addresses can't be negative!");

            symbols.push({
                name,
                variant: (variant?.toUpperCase() ?? "default") as titanio.SpecialVariant | "default",
                address,
                line: i + 1,
            });
        }

        return symbols;
    }
}
