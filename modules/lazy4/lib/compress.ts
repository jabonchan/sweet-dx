import { lz4js } from "../deps.ts";

function encodeLiteralBlock(src: Uint8Array): Uint8Array {
    const out: number[] = [];
    const literalCount = src.length;

    if (literalCount >= 0xf) {
        out.push(0xf0);
        let n = literalCount - 0xf;
        while (n >= 0xff) {
            out.push(0xff);
            n -= 0xff;
        }
        out.push(n);
    } else {
        out.push(literalCount << 4);
    }

    for (const b of src) out.push(b);
    return new Uint8Array(out);
}

export function compress(data: Uint8Array): Uint8Array {
    const dst = lz4js.makeBuffer(lz4js.compressBound(data.length));
    const hashTable = new Uint32Array(1 << 16);

    const compressedSize = lz4js.compressBlock(data, dst, 0, data.length, hashTable);

    if (compressedSize === 0) {
        return encodeLiteralBlock(data);
    }

    return dst.subarray(0, compressedSize);
}