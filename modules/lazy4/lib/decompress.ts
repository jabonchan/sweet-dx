import { lz4js } from "../deps.ts";

export function decompress(compressed: Uint8Array, decompressedSize: number): Uint8Array {
    const dst = lz4js.makeBuffer(decompressedSize);
    const bytesWritten = lz4js.decompressBlock(compressed, dst, 0, compressed.length, 0);

    if (bytesWritten !== decompressedSize) {
        throw new Error(
            `LZ4 decompress size mismatch: expected ${decompressedSize}, got ${bytesWritten}`
        );
    }

    return dst;
}