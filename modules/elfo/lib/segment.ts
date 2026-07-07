import { archivo } from "../deps.ts";
import * as defs from "./definitions.ts";

export class ElfSegment {
    constructor(
        private readonly file: archivo.Archivo,
        public readonly index: number,
        public readonly type: number,
        public readonly flags: number,
        public readonly offset: bigint,
        public readonly vaddr: bigint,
        public readonly paddr: bigint,
        public readonly filesz: bigint,
        public readonly memsz: bigint,
        public readonly align: bigint,
    ) {}

    get isLoadable(): boolean {
        return this.type === defs.PT.LOAD;
    }

    read(chunkSize?: number): archivo.ArchivoStream {
        return this.file.createReadStream({ offset: Number(this.offset), size: Number(this.filesz), chunkSize  });
    }
}
