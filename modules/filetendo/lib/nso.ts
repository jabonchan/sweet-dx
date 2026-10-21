import { archivo, utils } from "../deps.ts";
import * as defs from "./definitions.ts";
import * as helpers from "./helpers.ts";

/**
 * Writes a new, uncompressed NSO file. Set every property and write the three
 * segments in order, then call `digest()`; it fails if anything is missing.
 */
export class NSO {
    private readonly file: archivo.Archivo;
    private readonly setProperties = new Set<defs.NSOProperty>();
    private readonly writtenSections = new Set<defs.NSOSectionName>();
    private nextSectionIndex = 0;

    /** Creates (or empties) the file at `path` and writes the fixed header fields. */
    constructor(public readonly path: string) {
        this.file = new archivo.Archivo(path, { empty: true });

        try {
            this.file.writeAt(0x00, new Uint8Array(defs.TOTAL_HEADER_SIZE));
            this.file.writeAt(
                defs.FIXED_OFFSETS.magic,
                utils.encode(defs.MAGIC_STRING),
            );
            this.file.writeAt(
                defs.FIXED_OFFSETS.buildId,
                new Uint8Array(defs.BUILD_ID_SIZE),
            );

            helpers.writeUint32(
                this.file,
                defs.FIXED_OFFSETS.flags,
                defs.FLAGS,
            );
            helpers.writeUint32(
                this.file,
                defs.FIXED_OFFSETS.moduleNameOffset,
                defs.MODULE_NAME_OFFSET,
            );
            helpers.writeUint32(
                this.file,
                defs.FIXED_OFFSETS.moduleNameSize,
                defs.MODULE_NAME_SIZE,
            );
        } catch (e) {
            this.file.close();
            throw e;
        }
    }

    /** Writes one of the required header values. */
    setProperty(property: defs.NSOProperty, value: number): void {
        helpers.writeUint32(this.file, defs.PROPERTY_OFFSETS[property], value);
        this.setProperties.add(property);
    }

    /**
     * Appends a segment's data to the file and fills in its offset, sizes and
     * hash in the header. Segments must be written in `SECTION_ORDER`.
     */
    writeSection(
        section: defs.NSOSectionName,
        stream: archivo.ArchivoStream,
    ): void {
        if (this.writtenSections.has(section)) {
            throw new Error(
                `The "${section}" section has already been written and cannot be written again.`,
            );
        }

        const expected = defs.SECTION_ORDER[this.nextSectionIndex];

        if (section !== expected) {
            throw new Error(
                `Sections must be written in order (${
                    defs.SECTION_ORDER.join(", ")
                }). Expected "${expected}" next, but got "${section}".`,
            );
        }

        const info = defs.SECTION_OFFSETS[section];

        helpers.writeUint32(this.file, info.fileOffset, this.file.getSize());

        const { size, hash } = helpers.writeSectionStream(this.file, stream);

        // Uncompressed, so the size in memory and in the file are the same.
        helpers.writeUint32(this.file, info.size, size);
        helpers.writeUint32(this.file, info.fileSize, size);
        this.file.writeAt(info.hash, hash);

        this.writtenSections.add(section);
        this.nextSectionIndex++;
    }

    /** Closes the file without finalising it (build failed). Safe to call more than once. */
    abort(): void {
        try {
            this.file.close();
        } catch {
            // Already closed.
        }
    }

    /** Checks every property and segment was written, then closes the file. */
    digest(): void {
        const missingProperties = defs.ALL_PROPERTIES.filter((property) =>
            !this.setProperties.has(property)
        );

        if (missingProperties.length > 0) {
            throw new Error(
                `Cannot digest the NSO: missing required properties: ${
                    missingProperties.join(", ")
                }.`,
            );
        }

        const missingSections = defs.SECTION_ORDER.filter((section) =>
            !this.writtenSections.has(section)
        );

        if (missingSections.length > 0) {
            throw new Error(
                `Cannot digest the NSO: missing required sections: ${
                    missingSections.join(", ")
                }.`,
            );
        }

        this.file.close();
    }
}
