import { archivo } from "../deps.ts";
import * as defs from "./definitions.ts";

export class ElfSection {
    constructor(
        private readonly file: archivo.Archivo,
        public readonly index: number,
        public readonly name: string,
        public readonly type: number,
        public readonly flags: bigint,
        public readonly addr: bigint,
        public readonly offset: bigint,
        public readonly size: bigint,
        public readonly link: number,
        public readonly info: number,
        public readonly addralign: bigint,
        public readonly entsize: bigint,
    ) {}

    read(chunkSize?: number): archivo.ArchivoStream {
        if (this.type === defs.SHT.NOBITS) {
            return archivo.Archivo.bufferToReadStream(new Uint8Array(Number(this.size)), { offset: 0, chunkSize })
        }

        return this.file.createReadStream({ offset: Number(this.offset), size: Number(this.size), chunkSize });
    }
}
