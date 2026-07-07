import { archivo, lazy4, sha256, utils } from "../deps.ts";
import * as defs from "./definitions.ts";

export class NSOSegment {
    private cachedData: Uint8Array | null = null;

    constructor(
        private readonly file: archivo.Archivo,
        public readonly name: defs.NSOSectionName,
        public readonly fileOffset: number,
        public readonly fileSize: number,
        public readonly memoryOffset: number,
        public readonly size: number,
        public readonly isCompressed: boolean,
        public readonly isHashChecked: boolean,
        public readonly hash: Uint8Array,
    ) {}

    read(): Uint8Array {
        if (this.cachedData) return this.cachedData;

        const raw = this.file.readAt(this.fileOffset, this.fileSize);

        this.cachedData = this.isCompressed ? lazy4.decompress(raw, this.size) : raw;

        return this.cachedData;
    }

    readAt(offset: number, length: number): Uint8Array {
        const data = this.read();

        if (offset < 0 || length < 0 || offset + length > data.length) {
            throw new Error(
                `Offset ${utils.hexify(offset)} (length ${length}) is out of bounds for the "${this.name}" segment (size ${utils.hexify(data.length)}).`,
            );
        }

        return data.subarray(offset, offset + length);
    }

    verifyHash(): boolean {
        const hasher = new sha256.Hash();
        hasher.update(this.read());

        return utils.compareBuffers(hasher.digest(), this.hash);
    }
}
