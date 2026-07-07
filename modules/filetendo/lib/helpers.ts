import { archivo, utils, sha256 } from "../deps.ts";

export function writeUint32(file: archivo.Archivo, offset: number, value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 0xFFFFFFFF) {
        throw new Error(`Value ${value} is not a valid unsigned 32-bit integer for offset ${utils.hexify(offset)}.`);
    }

    const buffer = new Uint8Array(4);
    new DataView(buffer.buffer).setUint32(0, value, true);
    file.writeAt(offset, buffer);
}

export function readUint32(bytes: Uint8Array, offset: number = 0): number {
    return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

export function writeSectionStream(file: archivo.Archivo, stream: archivo.ArchivoStream): { size: number; hash: Uint8Array } {
    const hasher = new sha256.Hash();
    let size = 0;

    const hashedStream = utils.interceptReadStream(stream, ([chunk, chunkOffset]) => {
        hasher.update(chunk);
        size += chunk.byteLength;
        return [chunk, chunkOffset] as const;
    });

    for (const [chunk] of hashedStream) {
        file.append(chunk);
    }

    return { size, hash: hasher.digest() };
}
