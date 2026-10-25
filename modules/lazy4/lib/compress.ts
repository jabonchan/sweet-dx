import { lz4js } from "../deps.ts";

/** Compresses `data` into a raw LZ4 block (no frame header) */
export function compress(data: Uint8Array): Uint8Array {
    const dst = lz4js.makeBuffer(lz4js.compressBound(data.length));
    const hashTable = new Uint32Array(1 << 16);
    const compressedSize = lz4js.compressBlock(data, dst, 0, data.length, hashTable);

    // lz4js returns 0 when it finds nothing to match: the data must be stored as literals
    if (compressedSize === 0 && data.length > 0) return literalsBlock(data);

    return dst.subarray(0, compressedSize);
}

// A block with a single sequence of literals and no match: token, extra length bytes, then the data
function literalsBlock(data: Uint8Array): Uint8Array {
    const extraLength = data.length >= 15 ? Math.floor((data.length - 15) / 255) + 1 : 0;
    const block = new Uint8Array(1 + extraLength + data.length);

    block[0] = Math.min(data.length, 15) << 4;

    for (let i = 0, rest = data.length - 15; i < extraLength; i++, rest -= 255) {
        block[1 + i] = Math.min(rest, 255);
    }

    block.set(data, 1 + extraLength);

    return block;
}
