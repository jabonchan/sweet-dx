import { ElfRelocation, ElfRelocationSection } from "./relocation.ts";
import { archivo, deeplevel, utils } from "../deps.ts";
import { ElfSegment } from "./segment.ts";
import { ElfSection } from "./section.ts";
import { ElfSymbol } from "./symbol.ts";
import { format } from "./format.ts";

import * as helpers from "./helpers.ts";
import * as defs from "./definitions.ts";

export class Elf {
    public readonly file: archivo.Archivo;
    public readonly bits: defs.Bits;
    public readonly endianness: deeplevel.types.Endianness;

    public readonly type: defs.ET;
    public readonly machine: defs.EM;
    public readonly version: defs.EV;
    public readonly entry: bigint;
    public readonly flags: number;
    public readonly sectionHeaderStringTableIndex: number;

    public readonly segments: readonly ElfSegment[];
    public readonly sections: readonly ElfSection[];
    public readonly symbols: readonly ElfSymbol[];
    public readonly relaSections: readonly ElfRelocationSection[];
    public readonly relSections: readonly ElfRelocationSection[];

    private readonly structs: defs.Structs;

    constructor(public readonly path: string) {
        this.file = new archivo.Archivo(path);

        if (!utils.compareBuffers(defs.ELFMAG, this.file.readAt(0x00, defs.ELFMAG.length))) {
            throw new Error(`Invalid ELF file "${this.path}": incorrect magic number.`);
        }

        const identClass = this.file.readAt(0x04, 1)[0];
        const identData = this.file.readAt(0x05, 1)[0];

        if (identClass === defs.Class.ELF32) {
            this.bits = 32;
        } else if (identClass === defs.Class.ELF64) {
            this.bits = 64;
        } else {
            throw new Error(`Invalid ELF file "${this.path}": unsupported class ${helpers.hex(identClass, 2)}.`);
        }

        if (identData === defs.Endianness.Little) {
            this.endianness = deeplevel.types.Endianness.Little;
        } else if (identData === defs.Endianness.Big) {
            this.endianness = deeplevel.types.Endianness.Big;
        } else {
            throw new Error(`Invalid ELF file "${this.path}": unsupported data encoding ${helpers.hex(identData, 2)}.`);
        }

        this.structs = helpers.getCorrectStructs(this.bits, this.endianness);

        const eheader = this.structs.Ehdr.unpack(
            this.file.readAt(0x00, this.structs.Ehdr.byteLength).buffer,
        );

        const machine = Number(eheader.machine) as defs.EM;
        const type = Number(eheader.type) as defs.ET;
        const version = Number(eheader.version) as defs.EV;

        if (!(machine in defs.EM)) {
            throw new Error(`Invalid ELF file "${this.path}": unsupported machine ${helpers.hex(machine, 4)}.`);
        }
        if (!(type in defs.ET)) {
            throw new Error(`Invalid ELF file "${this.path}": unsupported type ${helpers.hex(type, 4)}.`);
        }
        if (!(version in defs.EV)) {
            throw new Error(`Invalid ELF file "${this.path}": unsupported version ${version}.`);
        }

        this.type = type;
        this.machine = machine;
        this.version = version;
        this.entry = helpers.toBigInt(eheader.entry);
        this.flags = Number(eheader.flags);
        this.sectionHeaderStringTableIndex = Number(eheader.shstrndx);

        this.segments = this.parseSegments(
            helpers.toBigInt(eheader.phoff),
            Number(eheader.phnum),
            Number(eheader.phentsize),
        );

        const sectionHeaderCount = Number(eheader.shnum);

        if (!sectionHeaderCount) {
            throw new Error(`Invalid ELF file "${this.path}": no section headers found.`);
        }

        this.sections = this.parseSections(
            helpers.toBigInt(eheader.shoff),
            sectionHeaderCount,
            Number(eheader.shentsize),
        );

        const symtab = this.sections.find((section) => section.type === defs.SHT.SYMTAB);

        if (!symtab) {
            throw new Error(`Invalid ELF file "${this.path}": no symbol table found.`);
        }

        const symbolTableCache = new Map<number, ElfSymbol[]>();

        this.symbols = this.readSymbolTable(symtab.index, symbolTableCache);

        this.relaSections = this.sections
            .filter((section) => section.type === defs.SHT.RELA)
            .map((section) => this.parseRelocationSection(section, true, symbolTableCache));

        this.relSections = this.sections
            .filter((section) => section.type === defs.SHT.REL)
            .map((section) => this.parseRelocationSection(section, false, symbolTableCache));
    }

    get loadableSegments(): ElfSegment[] {
        return this.segments.filter((segment) => segment.isLoadable);
    }

    findSection(name: string): ElfSection | undefined {
        return this.sections.find((section) => section.name === name);
    }

    findSymbol(name: string): ElfSymbol | undefined {
        return this.symbols.find(sym => sym.name === name);
    }

    formatAsString(): string {
        return format(this);
    }

    private parseSegments(offset: bigint, count: number, entrySize: number): ElfSegment[] {
        const segments: ElfSegment[] = [];

        for (let i = 0; i < count; i++) {
            const readOffset = Number(offset) + i * entrySize;
            const phdr = this.structs.Phdr.unpack(
                this.file.readAt(readOffset, this.structs.Phdr.byteLength).buffer,
            );

            segments.push(new ElfSegment(
                this.file,
                i,
                Number(phdr.type),
                Number(phdr.flags),
                helpers.toBigInt(phdr.offset),
                helpers.toBigInt(phdr.vaddr),
                helpers.toBigInt(phdr.paddr),
                helpers.toBigInt(phdr.filesz),
                helpers.toBigInt(phdr.memsz),
                helpers.toBigInt(phdr.align),
            ));
        }

        return segments;
    }

    private parseSections(offset: bigint, count: number, entrySize: number): ElfSection[] {
        const rawHeaders: defs.RawSectionHeader[] = [];

        for (let i = 0; i < count; i++) {
            const readOffset = Number(offset) + i * entrySize;
            const shdr = this.structs.Shdr.unpack(
                this.file.readAt(readOffset, this.structs.Shdr.byteLength).buffer,
            );

            rawHeaders.push({
                name: Number(shdr.name),
                type: Number(shdr.type),
                flags: helpers.toBigInt(shdr.flags),
                addr: helpers.toBigInt(shdr.addr),
                offset: helpers.toBigInt(shdr.offset),
                size: helpers.toBigInt(shdr.size),
                link: Number(shdr.link),
                info: Number(shdr.info),
                addralign: helpers.toBigInt(shdr.addralign),
                entsize: helpers.toBigInt(shdr.entsize),
            });
        }

        if (this.sectionHeaderStringTableIndex >= rawHeaders.length) {
            throw new Error(
                `Invalid ELF file "${this.path}": section header string table index ${this.sectionHeaderStringTableIndex} is out of bounds.`,
            );
        }

        const stringTableHeader = rawHeaders[this.sectionHeaderStringTableIndex];
        const stringTable = this.file.readAt(Number(stringTableHeader.offset), Number(stringTableHeader.size));

        return rawHeaders.map((raw, index) =>
            new ElfSection(
                this.file,
                index,
                helpers.readCString(stringTable, raw.name),
                raw.type,
                raw.flags,
                raw.addr,
                raw.offset,
                raw.size,
                raw.link,
                raw.info,
                raw.addralign,
                raw.entsize,
            )
        );
    }

    private readSymbolTable(sectionIndex: number, cache: Map<number, ElfSymbol[]>): ElfSymbol[] {
        const cached = cache.get(sectionIndex);
        if (cached) return cached;

        const section = this.sections[sectionIndex];

        if (!section) {
            throw new Error(`Invalid ELF file "${this.path}": symbol table section index ${sectionIndex} is out of bounds.`);
        }

        if (section.entsize <= 0n) {
            throw new Error(`Invalid ELF file "${this.path}": symbol table "${section.name}" has an entry size of zero.`);
        }

        const stringTableSection = this.sections[section.link];

        if (!stringTableSection) {
            throw new Error(`Invalid ELF file "${this.path}": symbol table "${section.name}" links to an out-of-bounds string table.`);
        }

        const entrySize = Number(section.entsize);
        const count = Number(section.size) / entrySize;

        if (!Number.isInteger(count)) {
            throw new Error(`Invalid ELF file "${this.path}": symbol table "${section.name}" size is not a multiple of its entry size.`);
        }

        const symbolBuffer = this.file.readAt(Number(section.offset), Number(section.size));
        const stringBuffer = this.file.readAt(Number(stringTableSection.offset), Number(stringTableSection.size));

        const symbols: ElfSymbol[] = [];

        for (let i = 0; i < count; i++) {
            const sym = this.structs.Sym.unpack(symbolBuffer.buffer, i * entrySize);
            const info = Number(sym.info);

            symbols.push(new ElfSymbol(
                i,
                helpers.readCString(stringBuffer, Number(sym.name)),
                ((info >> 4) & 0xF) as defs.STB,
                (info & 0xF) as defs.STT,
                (Number(sym.other) & 0x3) as defs.STV,
                Number(sym.shndx),
                helpers.toBigInt(sym.value),
                helpers.toBigInt(sym.size),
            ));
        }

        cache.set(sectionIndex, symbols);
        return symbols;
    }

    private parseRelocationSection(
        section: ElfSection,
        hasAddend: boolean,
        symbolTableCache: Map<number, ElfSymbol[]>,
    ): ElfRelocationSection {
        if (section.entsize <= 0n) {
            throw new Error(`Invalid ELF file "${this.path}": relocation section "${section.name}" has an entry size of zero.`);
        }

        const entrySize = Number(section.entsize);
        const count = Number(section.size) / entrySize;

        if (!Number.isInteger(count)) {
            throw new Error(`Invalid ELF file "${this.path}": relocation section "${section.name}" size is not a multiple of its entry size.`);
        }

        const symbolTable = this.readSymbolTable(section.link, symbolTableCache);
        const buffer = this.file.readAt(Number(section.offset), Number(section.size));

        const entries: ElfRelocation[] = [];

        for (let i = 0; i < count; i++) {
            const relOffset = i * entrySize;

            let offset: bigint;
            let info: bigint;
            let addend: bigint | null;

            if (hasAddend) {
                const raw = this.structs.Rela.unpack(buffer.buffer, relOffset);
                offset = helpers.toBigInt(raw.offset);
                info = helpers.toBigInt(raw.info);
                addend = helpers.toBigInt(raw.addend);
            } else {
                const raw = this.structs.Rel.unpack(buffer.buffer, relOffset);
                offset = helpers.toBigInt(raw.offset);
                info = helpers.toBigInt(raw.info);
                addend = null;
            }

            const { symbolIndex, type } = helpers.decodeRelocationInfo(this.bits, info);
            const symbolName = symbolTable[symbolIndex]?.name || `sym[${symbolIndex}]`;

            entries.push(new ElfRelocation(offset, symbolIndex, type, addend, symbolName));
        }

        return new ElfRelocationSection(section, entries);
    }
}
