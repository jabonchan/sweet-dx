import { deeplevel } from "../deps.ts";
import * as defs from "./definitions.ts";

export function getCorrectStructs(bits: defs.Bits, endian: deeplevel.types.Endianness): {
    Ehdr: typeof defs.Ehdr32_LE | typeof defs.Ehdr32_BE | typeof defs.Ehdr64_LE | typeof defs.Ehdr64_BE;
    Phdr: typeof defs.PHDR32LE | typeof defs.PHDR32BE | typeof defs.PHDR64LE | typeof defs.PHDR64BE;
    Shdr: typeof defs.Shdr32_LE | typeof defs.Shdr32_BE | typeof defs.Shdr64_LE | typeof defs.Shdr64_BE;
    Sym: typeof defs.Sym32_LE | typeof defs.Sym32_BE | typeof defs.Sym64_LE | typeof defs.Sym64_BE;
    Rela: typeof defs.Rela32_LE | typeof defs.Rela32_BE | typeof defs.Rela64_LE | typeof defs.Rela64_BE;
    Rel: typeof defs.Rel32_LE | typeof defs.Rel32_BE | typeof defs.Rel64_LE | typeof defs.Rel64_BE;
} {
    const is32 = bits === 32;
    const isLittle = endian === deeplevel.types.Endianness.Little;

    return {
        Ehdr: is32
            ? (isLittle ? defs.Ehdr32_LE : defs.Ehdr32_BE)
            : (isLittle ? defs.Ehdr64_LE : defs.Ehdr64_BE),
        Phdr: is32
            ? (isLittle ? defs.PHDR32LE : defs.PHDR32BE)
            : (isLittle ? defs.PHDR64LE : defs.PHDR64BE),
        Shdr: is32
            ? (isLittle ? defs.Shdr32_LE : defs.Shdr32_BE)
            : (isLittle ? defs.Shdr64_LE : defs.Shdr64_BE),
        Sym: is32
            ? (isLittle ? defs.Sym32_LE : defs.Sym32_BE)
            : (isLittle ? defs.Sym64_LE : defs.Sym64_BE),
        Rela: is32
            ? (isLittle ? defs.Rela32_LE : defs.Rela32_BE)
            : (isLittle ? defs.Rela64_LE : defs.Rela64_BE),
        Rel: is32
            ? (isLittle ? defs.Rel32_LE : defs.Rel32_BE)
            : (isLittle ? defs.Rel64_LE : defs.Rel64_BE),
    };
}

export function decodeRelocationInfo(bits: defs.Bits, info: bigint): { symbolIndex: number; type: number } {
    if (bits === 32) {
        const n = Number(info);
        return { symbolIndex: (n >>> 8) & 0xFFFFFF, type: n & 0xFF };
    }

    return { symbolIndex: Number(info >> 32n), type: Number(info & 0xFFFFFFFFn) };
}

export function toBigInt(value: unknown): bigint {
    return typeof value === "bigint" ? value : BigInt(value as number);
}

export function hex(value: number | bigint, width: number = 8): string {
    return "0x" + value.toString(16).padStart(width, "0");
}

export function readCString(bytes: Uint8Array, offset: number): string {
    if (offset < 0 || offset > bytes.length) {
        throw new Error(`String table offset ${hex(offset)} is out of bounds for a table of ${bytes.length} bytes.`);
    }

    let end = offset;
    while (end < bytes.length && bytes[end] !== 0) end++;

    return new TextDecoder().decode(bytes.subarray(offset, end));
}

export function sectionFlagLetters(flags: bigint): string {
    return Object.entries(defs.Short)
        .filter(([, value]) => typeof value === "number")
        .filter(([, value]) => (flags & BigInt(value as number)) !== 0n)
        .map(([key]) => key)
        .join("") || "none";
}

export function segmentFlagLetters(flags: number): string {
    return `${flags & 0x4 ? "R" : " "}${flags & 0x2 ? "W" : " "}${flags & 0x1 ? "E" : " "}`;
}
