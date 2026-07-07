import type { ElfSection } from "./section.ts";

export class ElfRelocation {
    constructor(
        public readonly offset: bigint,
        public readonly symbolIndex: number,
        public readonly type: number,
        public readonly addend: bigint | null,
        public readonly symbolName: string,
    ) {}
}

export class ElfRelocationSection {
    constructor(
        public readonly section: ElfSection,
        public readonly entries: ElfRelocation[],
    ) {}

    get name(): string {
        return this.section.name;
    }
}
