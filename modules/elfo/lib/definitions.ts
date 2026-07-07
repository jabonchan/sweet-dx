import { deeplevel } from "../deps.ts";
import * as helpers from "./helpers.ts";

export type Structs = ReturnType<typeof helpers.getCorrectStructs>;

export interface RawSectionHeader {
    name: number;
    type: number;
    flags: bigint;
    addr: bigint;
    offset: bigint;
    size: bigint;
    link: number;
    info: number;
    addralign: bigint;
    entsize: bigint;
}

export const ELFMAG = new Uint8Array([ 0x7F, 0x45, 0x4C, 0x46 ]);

export type Bits = 32 | 64;

export enum Class {
    ELF32 = 1,
    ELF64 = 2,
}

export enum Endianness {
    Little = 1,
    Big = 2,
}

export enum ET {
    NONE = 0,
    REL = 1,
    EXEC = 2,
    DYN = 3,
    CORE = 4,
}

export enum SHN {
    UNDEF = 0x0000,
    ABS = 0xFFF1,
    COMMON = 0xFFF2,
}

export enum SHT {
    NULL = 0,
    PROGBITS = 1,
    SYMTAB = 2,
    STRTAB = 3,
    RELA = 4,
    HASH = 5,
    DYNAMIC = 6,
    NOTE = 7,
    NOBITS = 8,
    REL = 9,
    SHLIB = 10,
    DYNSYM = 11,
    INIT_ARRAY = 14,
    FINI_ARRAY = 15,
    ARM_ATTRIBUTES = 0x70000003,
}

export enum SHF {
    WRITE = 0x1,
    ALLOC = 0x2,
    EXECINSTR = 0x4,
    MERGE = 0x10,
    STRINGS = 0x20,
    INFO_LINK = 0x40,
    LINK_ORDER = 0x80,
}
export enum PT {
    NULL = 0,
    LOAD = 1,
    DYNAMIC = 2,
    INTERP = 3,
    NOTE = 4,
    SHLIB = 5,
    PHDR = 6,
    TLS = 7,
    GNU_EH_FRAME = 0x6474e550,
    GNU_STACK = 0x6474e551,
    GNU_RELRO = 0x6474e552,
    ARM_EXIDX = 0x70000001,
}

export enum Short {
    W = 0x1,
    A = 0x2,
    E = 0x4,
    M = 0x10,
    S = 0x20,
    I = 0x40,
    L = 0x80,
}

export enum STB {
    LOCAL = 0,
    GLOBAL = 1,
    WEAK = 2,
}

export enum STT {
    NOTYPE = 0,
    OBJECT = 1,
    FUNC = 2,
    SECTION = 3,
    FILE = 4,
}

export enum STV {
    DEFAULT = 0,
    INTERNAL = 1,
    HIDDEN = 2,
    PROTECTED = 3,
}

export enum EV {
    NONE = 0,
    CURRENT = 1,
}

export enum EM {
    NONE = 0,
    M32 = 1,
    SPARC = 2,
    X86 = 3,
    M68K = 4,
    M88K = 5,
    IAMCU = 6,
    I860 = 7,
    MIPS = 8,
    S370 = 9,
    MIPS_RS3_LE = 10,

    PARISC = 15,
    VPP500 = 17,
    SPARC32PLUS = 18,
    I960 = 19,
    PPC = 20,
    PPC64 = 21,
    S390 = 22,

    V800 = 36,
    FR20 = 37,
    RH32 = 38,
    RCE = 39,
    ARM = 40,
    ALPHA = 41,
    SH = 42,
    SPARCV9 = 43,
    TRICORE = 44,
    ARC = 45,
    H8_300 = 46,
    H8_300H = 47,
    H8S = 48,
    H8_500 = 49,
    IA64 = 50,
    MIPS_X = 51,
    COLDFIRE = 52,
    M68HC12 = 53,
    MMA = 54,
    PCP = 55,
    NCPU = 56,
    NDR1 = 57,
    STARCORE = 58,
    ME16 = 59,
    ST100 = 60,
    TINYJ = 61,

    X86_64 = 62,
    PDSP = 63,
    PDP10 = 64,
    PDP11 = 65,
    FX66 = 66,
    ST9PLUS = 67,
    ST7 = 68,
    MC68HC16 = 69,
    MC68HC11 = 70,
    MC68HC08 = 71,
    MC68HC05 = 72,
    SVX = 73,
    ST19 = 74,
    VAX = 75,
    CRIS = 76,
    JAVELIN = 77,
    FIREPATH = 78,
    ZSP = 79,
    MMIX = 80,
    HUANY = 81,
    PRISM = 82,
    AVR = 83,
    FR30 = 84,
    D10V = 85,
    D30V = 86,
    V850 = 87,
    M32R = 88,
    MN10300 = 89,
    MN10200 = 90,
    PJ = 91,
    OPENRISC = 92,
    ARC_COMPACT = 93,
    XTENSA = 94,
    VIDEOCORE = 95,
    TMM_GPP = 96,
    NS32K = 97,
    TPC = 98,
    SNP1K = 99,
    ST200 = 100,

    IP2K = 101,
    MAX = 102,
    CR = 103,
    F2MC16 = 104,
    MSP430 = 105,
    BLACKFIN = 106,
    SE_C33 = 107,
    SEP = 108,
    ARCA = 109,
    UNICORE = 110,
    EXCESS = 111,
    DXP = 112,
    ALTERA_NIOS2 = 113,
    CRX = 114,
    XGATE = 115,
    C166 = 116,
    M16C = 117,
    DSPIC30F = 118,
    CE = 119,
    M32C = 120,

    TSK3000 = 131,
    RS08 = 132,
    SHARC = 133,
    ECOG2 = 134,
    SCORE7 = 135,
    DSP24 = 136,
    VIDEOCORE3 = 137,
    LATTICEMICO32 = 138,
    SE_C17 = 139,
    TI_C6000 = 140,
    TI_C2000 = 141,
    TI_C5500 = 142,
    MMDSP_PLUS = 160,
    CYPRESS_M8C = 161,
    R32C = 162,
    TRIMEDIA = 163,
    QDSP6 = 164,
    I8051 = 165,
    STXP7X = 166,
    NDS32 = 167,
    ECOG1 = 168,
    MAXQ30 = 169,
    XIMO16 = 170,
    MANIK = 171,
    CRAYNV2 = 172,

    RX = 173,
    METAG = 174,
    MCST_ELBRUS = 175,
    ECOG16 = 176,
    CR16 = 177,
    ETPU = 178,
    SLE9X = 179,
    L10M = 180,
    K10M = 181,

    AARCH64 = 183,
    AVR32 = 185,
    STM8 = 186,
    TILE64 = 187,
    TILEPRO = 188,
    MICROBLAZE = 189,
    CUDA = 190,
    TILEGX = 191,
    CLOUDSHIELD = 192,
    COREA_1ST = 193,
    COREA_2ND = 194,
    ARC_COMPACT2 = 195,
    OPEN8 = 196,
    RL78 = 197,
    VIDEOCORE5 = 198,
    R78KOR = 199,

    RISCV = 243,
    BPF = 247,
    CSKY = 252,
    LOONGARCH = 258,
}

export const Elf_Ident = new deeplevel.NativeArray({ length: 16, type: "u8" });

export const PHDR32LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    align: deeplevel.types.Alignment.Packed,
    fields: [
        { name: "type", type: "u32" },
        { name: "offset", type: "u32" },
        { name: "vaddr", type: "u32" },
        { name: "paddr", type: "u32" },
        { name: "filesz", type: "u32" },
        { name: "memsz", type: "u32" },
        { name: "flags", type: "u32" },
        { name: "align", type: "u32" },
    ],
});

export const PHDR32BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    align: deeplevel.types.Alignment.Packed,
    fields: [
        { name: "type", type: "u32" },
        { name: "offset", type: "u32" },
        { name: "vaddr", type: "u32" },
        { name: "paddr", type: "u32" },
        { name: "filesz", type: "u32" },
        { name: "memsz", type: "u32" },
        { name: "flags", type: "u32" },
        { name: "align", type: "u32" },
    ],
});

export const PHDR64LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    align: deeplevel.types.Alignment.Packed,
    fields: [
        { name: "type", type: "u32" },
        { name: "flags", type: "u32" },
        { name: "offset", type: "u64" },
        { name: "vaddr", type: "u64" },
        { name: "paddr", type: "u64" },
        { name: "filesz", type: "u64" },
        { name: "memsz", type: "u64" },
        { name: "align", type: "u64" },
    ],
});

export const PHDR64BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    align: deeplevel.types.Alignment.Packed,
    fields: [
        { name: "type", type: "u32" },
        { name: "flags", type: "u32" },
        { name: "offset", type: "u64" },
        { name: "vaddr", type: "u64" },
        { name: "paddr", type: "u64" },
        { name: "filesz", type: "u64" },
        { name: "memsz", type: "u64" },
        { name: "align", type: "u64" },
    ],
});

export const Ehdr32_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "ident", type: Elf_Ident },
        { name: "type", type: "u16" },
        { name: "machine", type: "u16" },
        { name: "version", type: "u32" },
        { name: "entry", type: "u32" },
        { name: "phoff", type: "u32" },
        { name: "shoff", type: "u32" },
        { name: "flags", type: "u32" },
        { name: "ehsize", type: "u16" },
        { name: "phentsize", type: "u16" },
        { name: "phnum", type: "u16" },
        { name: "shentsize", type: "u16" },
        { name: "shnum", type: "u16" },
        { name: "shstrndx", type: "u16" },
    ],
});

export const Ehdr32_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "ident", type: Elf_Ident },
        { name: "type", type: "u16" },
        { name: "machine", type: "u16" },
        { name: "version", type: "u32" },
        { name: "entry", type: "u32" },
        { name: "phoff", type: "u32" },
        { name: "shoff", type: "u32" },
        { name: "flags", type: "u32" },
        { name: "ehsize", type: "u16" },
        { name: "phentsize", type: "u16" },
        { name: "phnum", type: "u16" },
        { name: "shentsize", type: "u16" },
        { name: "shnum", type: "u16" },
        { name: "shstrndx", type: "u16" },
    ],
});

export const Ehdr64_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "ident", type: Elf_Ident },
        { name: "type", type: "u16" },
        { name: "machine", type: "u16" },
        { name: "version", type: "u32" },
        { name: "entry", type: "u64" },
        { name: "phoff", type: "u64" },
        { name: "shoff", type: "u64" },
        { name: "flags", type: "u32" },
        { name: "ehsize", type: "u16" },
        { name: "phentsize", type: "u16" },
        { name: "phnum", type: "u16" },
        { name: "shentsize", type: "u16" },
        { name: "shnum", type: "u16" },
        { name: "shstrndx", type: "u16" },
    ],
});

export const Ehdr64_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "ident", type: Elf_Ident },
        { name: "type", type: "u16" },
        { name: "machine", type: "u16" },
        { name: "version", type: "u32" },
        { name: "entry", type: "u64" },
        { name: "phoff", type: "u64" },
        { name: "shoff", type: "u64" },
        { name: "flags", type: "u32" },
        { name: "ehsize", type: "u16" },
        { name: "phentsize", type: "u16" },
        { name: "phnum", type: "u16" },
        { name: "shentsize", type: "u16" },
        { name: "shnum", type: "u16" },
        { name: "shstrndx", type: "u16" },
    ],
});

export const Shdr32_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "name", type: "u32" },
        { name: "type", type: "u32" },
        { name: "flags", type: "u32" },
        { name: "addr", type: "u32" },
        { name: "offset", type: "u32" },
        { name: "size", type: "u32" },
        { name: "link", type: "u32" },
        { name: "info", type: "u32" },
        { name: "addralign", type: "u32" },
        { name: "entsize", type: "u32" },
    ],
});

export const Shdr32_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "name", type: "u32" },
        { name: "type", type: "u32" },
        { name: "flags", type: "u32" },
        { name: "addr", type: "u32" },
        { name: "offset", type: "u32" },
        { name: "size", type: "u32" },
        { name: "link", type: "u32" },
        { name: "info", type: "u32" },
        { name: "addralign", type: "u32" },
        { name: "entsize", type: "u32" },
    ],
});

export const Shdr64_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "name", type: "u32" },
        { name: "type", type: "u32" },
        { name: "flags", type: "u64" },
        { name: "addr", type: "u64" },
        { name: "offset", type: "u64" },
        { name: "size", type: "u64" },
        { name: "link", type: "u32" },
        { name: "info", type: "u32" },
        { name: "addralign", type: "u64" },
        { name: "entsize", type: "u64" },
    ],
});

export const Shdr64_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "name", type: "u32" },
        { name: "type", type: "u32" },
        { name: "flags", type: "u64" },
        { name: "addr", type: "u64" },
        { name: "offset", type: "u64" },
        { name: "size", type: "u64" },
        { name: "link", type: "u32" },
        { name: "info", type: "u32" },
        { name: "addralign", type: "u64" },
        { name: "entsize", type: "u64" },
    ],
});

export const Sym32_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "name", type: "u32" },
        { name: "value", type: "u32" },
        { name: "size", type: "u32" },
        { name: "info", type: "u8" },
        { name: "other", type: "u8" },
        { name: "shndx", type: "u16" },
    ],
});

export const Sym32_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "name", type: "u32" },
        { name: "value", type: "u32" },
        { name: "size", type: "u32" },
        { name: "info", type: "u8" },
        { name: "other", type: "u8" },
        { name: "shndx", type: "u16" },
    ],
});

export const Sym64_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "name", type: "u32" },
        { name: "info", type: "u8" },
        { name: "other", type: "u8" },
        { name: "shndx", type: "u16" },
        { name: "value", type: "u64" },
        { name: "size", type: "u64" },
    ],
});

export const Sym64_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "name", type: "u32" },
        { name: "info", type: "u8" },
        { name: "other", type: "u8" },
        { name: "shndx", type: "u16" },
        { name: "value", type: "u64" },
        { name: "size", type: "u64" },
    ],
});

export const Rela32_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "offset", type: "u32" },
        { name: "info", type: "u32" },
        { name: "addend", type: "i32" },
    ],
});

export const Rela32_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "offset", type: "u32" },
        { name: "info", type: "u32" },
        { name: "addend", type: "i32" },
    ],
});

export const Rela64_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "offset", type: "u64" },
        { name: "info", type: "u64" },
        { name: "addend", type: "i64" },
    ],
});

export const Rela64_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "offset", type: "u64" },
        { name: "info", type: "u64" },
        { name: "addend", type: "i64" },
    ],
});

export const Rel32_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "offset", type: "u32" },
        { name: "info", type: "u32" },
    ],
});

export const Rel32_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "offset", type: "u32" },
        { name: "info", type: "u32" },
    ],
});

export const Rel64_LE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    fields: [
        { name: "offset", type: "u64" },
        { name: "info", type: "u64" },
    ],
});

export const Rel64_BE = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Big,
    fields: [
        { name: "offset", type: "u64" },
        { name: "info", type: "u64" },
    ],
});
