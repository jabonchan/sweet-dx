import { elfo } from "../../deps.ts";

export class SymbolExtractor {
    extract(objectPath: string): string[] {
        const elf = new elfo.Elf(objectPath);

        try {
            return elf.symbols
                .filter((symbol) =>
                    symbol.type === elfo.STT.FUNC &&
                    !symbol.isUndefined &&
                    symbol.binding !== elfo.STB.LOCAL
                )
                .map((symbol) => symbol.name);
        } finally {
            elf.file.close();
        }
    }
}
