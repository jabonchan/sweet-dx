import { deeplevel } from "../deps.ts";

export const MAGIC_STRING = "NSO0";
export const HEADER_SIZE = 0x100;
export const MODULE_NAME_OFFSET = 0x100;
export const MODULE_NAME_SIZE = 1;
export const TOTAL_HEADER_SIZE = HEADER_SIZE + MODULE_NAME_SIZE;
export const BUILD_ID_SIZE = 0x20;

export const FLAGS = 0b00111000;

export const FIXED_OFFSETS = {
    magic: 0x00,
    flags: 0x0C,
    moduleNameOffset: 0x1C,
    moduleNameSize: 0x2C,
    buildId: 0x40,
} as const;

export type NSOSectionName = ".text" | ".ro" | ".data";

export const SECTION_ORDER: readonly NSOSectionName[] = [".text", ".ro", ".data"];

export const SECTION_OFFSETS: Record<NSOSectionName, { fileOffset: number; size: number; fileSize: number; hash: number }> = {
    ".text": { fileOffset: 0x10, size: 0x18, fileSize: 0x60, hash: 0xA0 },
    ".ro": { fileOffset: 0x20, size: 0x28, fileSize: 0x64, hash: 0xC0 },
    ".data": { fileOffset: 0x30, size: 0x38, fileSize: 0x68, hash: 0xE0 },
};

export type NSOProperty =
    | "textMemoryOffset"
    | "roMemoryOffset"
    | "dataMemoryOffset"
    | "bssSize"
    | "embeddedOffset"
    | "embeddedSize"
    | "dynstrOffset"
    | "dynstrSize"
    | "dynsymOffset"
    | "dynsymSize";

export const PROPERTY_OFFSETS: Record<NSOProperty, number> = {
    textMemoryOffset: 0x14,
    roMemoryOffset: 0x24,
    dataMemoryOffset: 0x34,
    bssSize: 0x3C,
    embeddedOffset: 0x88,
    embeddedSize: 0x8C,
    dynstrOffset: 0x90,
    dynstrSize: 0x94,
    dynsymOffset: 0x98,
    dynsymSize: 0x9C,
};

export const ALL_PROPERTIES = Object.keys(PROPERTY_OFFSETS) as NSOProperty[];

export enum NSOFlag {
    TextCompress = 1 << 0,
    RoCompress = 1 << 1,
    DataCompress = 1 << 2,
    TextHash = 1 << 3,
    RoHash = 1 << 4,
    DataHash = 1 << 5,
}

export const COMPRESS_FLAGS: Record<NSOSectionName, NSOFlag> = {
    ".text": NSOFlag.TextCompress,
    ".ro": NSOFlag.RoCompress,
    ".data": NSOFlag.DataCompress,
};

export const HASH_FLAGS: Record<NSOSectionName, NSOFlag> = {
    ".text": NSOFlag.TextHash,
    ".ro": NSOFlag.RoHash,
    ".data": NSOFlag.DataHash,
};

const U8Array = (length: number) => new deeplevel.NativeArray({ length, type: "u8" });

export const NSO_HEADER = new deeplevel.Struct({
    endianness: deeplevel.types.Endianness.Little,
    align: deeplevel.types.Alignment.Packed,
    fields: [
        { name: "magic", type: U8Array(4) },
        { name: "version", type: "u32" },
        { name: "reserved", type: "u32" },
        { name: "flags", type: "u32" },

        { name: "textFileOffset", type: "u32" },
        { name: "textMemoryOffset", type: "u32" },
        { name: "textSize", type: "u32" },
        { name: "moduleNameOffset", type: "u32" },

        { name: "roFileOffset", type: "u32" },
        { name: "roMemoryOffset", type: "u32" },
        { name: "roSize", type: "u32" },
        { name: "moduleNameSize", type: "u32" },

        { name: "dataFileOffset", type: "u32" },
        { name: "dataMemoryOffset", type: "u32" },
        { name: "dataSize", type: "u32" },
        { name: "bssSize", type: "u32" },

        { name: "buildId", type: U8Array(BUILD_ID_SIZE) },

        { name: "textFileSize", type: "u32" },
        { name: "roFileSize", type: "u32" },
        { name: "dataFileSize", type: "u32" },
        { name: "reserved2", type: U8Array(0x1C) },

        { name: "embeddedOffset", type: "u32" },
        { name: "embeddedSize", type: "u32" },
        { name: "dynstrOffset", type: "u32" },
        { name: "dynstrSize", type: "u32" },
        { name: "dynsymOffset", type: "u32" },
        { name: "dynsymSize", type: "u32" },

        { name: "textHash", type: U8Array(0x20) },
        { name: "roHash", type: U8Array(0x20) },
        { name: "dataHash", type: U8Array(0x20) },
    ],
});

export type NSOHeader = ReturnType<typeof NSO_HEADER.unpack>;
