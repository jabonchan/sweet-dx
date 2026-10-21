import type { ElfSection } from "./section.ts";

/** A single relocation entry. `addend` is `null` for `SHT_REL` entries. */
export class ElfRelocation {
    constructor(
        public readonly offset: bigint,
        public readonly symbolIndex: number,
        public readonly type: number,
        public readonly addend: bigint | null,
        public readonly symbolName: string,
    ) {}
}

/** A relocation section together with its parsed entries. */
export class ElfRelocationSection {
    constructor(
        public readonly section: ElfSection,
        public readonly entries: ElfRelocation[],
    ) {}

    get name(): string {
        return this.section.name;
    }
}
