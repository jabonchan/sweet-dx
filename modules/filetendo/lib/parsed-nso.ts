import { archivo, utils } from "../deps.ts";
import { NSOSegment } from "./nso-segment.ts";
import * as helpers from "./helpers.ts";
import * as defs from "./definitions.ts";

export class ParsedNSO {
    public readonly file: archivo.Archivo;

    public readonly version: number;
    public readonly flags: number;
    public readonly buildId: Uint8Array;
    public readonly bssSize: number;

    public readonly moduleNameOffset: number;
    public readonly moduleNameSize: number;

    public readonly embeddedOffset: number;
    public readonly embeddedSize: number;
    public readonly dynstrOffset: number;
    public readonly dynstrSize: number;
    public readonly dynsymOffset: number;
    public readonly dynsymSize: number;

    public readonly text: NSOSegment;
    public readonly ro: NSOSegment;
    public readonly data: NSOSegment;

    private readonly segmentsByName: ReadonlyMap<defs.NSOSectionName, NSOSegment>;

    constructor(public readonly path: string) {
        this.file = new archivo.Archivo(path);

        const magicBytes = utils.encode(defs.MAGIC_STRING);

        if (!utils.compareBuffers(magicBytes, this.file.readAt(0x00, magicBytes.length))) {
            throw new Error(`Invalid NSO file "${this.path}": incorrect magic number.`);
        }

        const header = defs.NSO_HEADER.unpack(this.file.readAt(0x00, defs.NSO_HEADER.byteLength).buffer);

        this.version = header.version;
        this.flags = header.flags;
        this.buildId = new Uint8Array(header.buildId);
        this.bssSize = header.bssSize;

        this.moduleNameOffset = header.moduleNameOffset;
        this.moduleNameSize = header.moduleNameSize;

        this.embeddedOffset = header.embeddedOffset;
        this.embeddedSize = header.embeddedSize;
        this.dynstrOffset = header.dynstrOffset;
        this.dynstrSize = header.dynstrSize;
        this.dynsymOffset = header.dynsymOffset;
        this.dynsymSize = header.dynsymSize;

        this.text = new NSOSegment(
            this.file,
            ".text",
            header.textFileOffset,
            header.textFileSize,
            header.textMemoryOffset,
            header.textSize,
            (this.flags & defs.NSOFlag.TextCompress) !== 0,
            (this.flags & defs.NSOFlag.TextHash) !== 0,
            new Uint8Array(header.textHash),
        );

        this.ro = new NSOSegment(
            this.file,
            ".ro",
            header.roFileOffset,
            header.roFileSize,
            header.roMemoryOffset,
            header.roSize,
            (this.flags & defs.NSOFlag.RoCompress) !== 0,
            (this.flags & defs.NSOFlag.RoHash) !== 0,
            new Uint8Array(header.roHash),
        );

        this.data = new NSOSegment(
            this.file,
            ".data",
            header.dataFileOffset,
            header.dataFileSize,
            header.dataMemoryOffset,
            header.dataSize,
            (this.flags & defs.NSOFlag.DataCompress) !== 0,
            (this.flags & defs.NSOFlag.DataHash) !== 0,
            new Uint8Array(header.dataHash),
        );

        this.segmentsByName = new Map([
            [".text", this.text],
            [".ro", this.ro],
            [".data", this.data],
        ]);
    }

    get segments(): readonly NSOSegment[] {
        return defs.SECTION_ORDER.map((name) => this.getSegment(name));
    }

    getSegment(name: defs.NSOSectionName): NSOSegment {
        const segment = this.segmentsByName.get(name);

        if (!segment) {
            throw new Error(`Unknown NSO segment "${name}".`);
        }

        return segment;
    }

    getModuleName(): string {
        if (this.moduleNameSize === 0) return "";

        return utils.decode(this.file.readAt(this.moduleNameOffset, this.moduleNameSize)).replace(/\0+$/, "");
    }

    getInstructionAt(offset: number): number {
        if (offset < 0 || offset % 4 !== 0) {
            throw new Error(`Instruction offset ${utils.hexify(offset)} must be a non-negative multiple of 4.`);
        }

        return helpers.readUint32(this.text.readAt(offset, 4));
    }

    close(): void {
        this.file.close();
    }
}
