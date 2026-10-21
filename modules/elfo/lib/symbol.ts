import * as defs from "./definitions.ts";

/** A symbol table entry. */
export class ElfSymbol {
    constructor(
        public readonly index: number,
        public readonly name: string,
        public readonly binding: defs.STB,
        public readonly type: defs.STT,
        public readonly visibility: defs.STV,
        public readonly sectionIndex: number,
        public readonly value: bigint,
        public readonly size: bigint,
    ) {}

    /** Whether the symbol is defined elsewhere (section index `SHN_UNDEF`). */
    get isUndefined(): boolean {
        return this.sectionIndex === defs.SHN.UNDEF;
    }
}
