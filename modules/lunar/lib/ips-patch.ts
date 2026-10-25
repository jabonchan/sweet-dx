import { archivo, utils } from "../deps.ts";

const IPSMAG = utils.encode("PATCH");
const IPSEND = utils.encode("EOF");

/** A single IPS record: bytes to write at a file offset */
export interface Patch {
    address: number;
    data: Uint8Array;
}

/** Builds an IPS patch file from a list of non-overlapping records */
export class IPSPatch {
    private patches: Patch[] = [];
    private closed: boolean = false;

    constructor() {}

    /** Number of records added so far */
    get count(): number {
        return this.patches.length;
    }

    /** Checks whether two records write to any of the same bytes */
    static doPatchesOverlap(a: Patch, b: Patch): boolean {
        const startA = a.address;
        const endA = a.address + a.data.byteLength;

        const startB = b.address;
        const endB = b.address + b.data.byteLength;

        return startA < endB && startB < endA;
    }

    /** Checks the record fits the IPS format (24-bit address, 16-bit non-zero size) and doesn't overlap */
    addPatch(patch: Patch): void {
        if (this.closed)
            throw new Error("Trying to add patch to already-closed IPSPatch object");

        if (!Number.isInteger(patch.address) || patch.address < 0 || patch.address > 0x00FFFFFF)
            throw new Error("Invalid IPS address patch range (0x00000000 - 0x00FFFFFF): " + utils.hexify(patch.address));

        if (patch.data.byteLength === 0)
            throw new Error("An IPS patch cannot have empty data (a size of 0 is the RLE marker): " + utils.hexify(patch.address));

        if (patch.data.byteLength > 0x0000FFFF)
            throw new Error("The IPS patch data is too large (0x0000FFFF): " + utils.hexify(patch.data.byteLength));

        if (patch.address === 0x454F46) {
            throw new Error(
                "0x00454F46 ('EOF') is a reserved IPS address: a record starting there would be read as the end of the patch. Start the patch a few bytes earlier or later.",
            );
        }

        const overlappingPatch = this.patches.find((existingPatch) => IPSPatch.doPatchesOverlap(existingPatch, patch));

        if (overlappingPatch) {
            throw new Error(
                `Patches overlap at ${utils.hexify(overlappingPatch.address)}-${
                    utils.hexify(overlappingPatch.address + overlappingPatch.data.byteLength - 1)
                } and ${utils.hexify(patch.address)}-${utils.hexify(patch.address + patch.data.byteLength - 1)}`,
            );
        }

        this.patches.push({ address: patch.address, data: new Uint8Array(patch.data) });
    }

    /** Writes PATCH, every record and EOF to path. No more records can be added after */
    saveAndClose(path: string): void {
        let size = IPSMAG.length + IPSEND.length;

        for (const patch of this.patches) size += 5 + patch.data.byteLength;

        const out = new Uint8Array(size);
        let offset = 0;

        out.set(IPSMAG, offset);
        offset += IPSMAG.length;

        for (const patch of this.patches) {
            out[offset++] = (patch.address >>> 16) & 0xFF;
            out[offset++] = (patch.address >>> 8) & 0xFF;
            out[offset++] = patch.address & 0xFF;
            out[offset++] = (patch.data.byteLength >>> 8) & 0xFF;
            out[offset++] = patch.data.byteLength & 0xFF;

            out.set(patch.data, offset);
            offset += patch.data.byteLength;
        }

        out.set(IPSEND, offset);

        const file = new archivo.Archivo(path, { empty: true });

        try {
            file.writeAt(0x00, out);
        } finally {
            this.closed = true;
            file.close();
        }
    }
}
