import type { archivo } from "../deps.ts";
import * as defs from "./definitions.ts";

/** A program header, with lazy access to its contents */
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

    /** Whether this is a `PT_LOAD` segment */
    get isLoadable(): boolean {
        return this.type === defs.PT.LOAD;
    }

    /** Streams the segment's bytes as stored in the file (`filesz`, not `memsz`) */
    read(chunkSize?: number): archivo.ArchivoStream {
        return this.file.createReadStream({ offset: Number(this.offset), size: Number(this.filesz), chunkSize });
    }
}
