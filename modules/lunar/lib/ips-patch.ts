import { archivo, utils } from "../deps.ts";

const IPSMAG = utils.encode("PATCH");
const IPSEND = utils.encode("EOF");

export interface Patch {
    address: number,
    data: Uint8Array
}

export class IPSPatch {
    private patches: Patch[] = [];
    constructor() {};

    get count(): number {
        return this.patches.length;
    }

    addPatch(patch: Patch): void {
        if (!Number.isInteger(patch.address) || patch.address < 0 || patch.address > 0x00FFFFFF)
            throw new Error("Invalid IPS address patch range (0x00000000 - 0x00FFFFFF): " + utils.hexify(patch.address));

        // In the IPS format a record size of 0 means "RLE record": the next 3 bytes would be
        // misread as a run length and a fill value, corrupting every record after it.
        if (patch.data.byteLength === 0)
            throw new Error("An IPS patch cannot have empty data (a size of 0 is the RLE marker): " + utils.hexify(patch.address));

        if (patch.data.byteLength > 0x0000FFFF)
            throw new Error("The IPS patch data is too large (0x0000FFFF): " + utils.hexify(patch.data.byteLength));

        if (patch.address === 0x454F46)
            throw new Error("0x00454F46 ('EOF') is a reserved IPS address: a record starting there would be read as the end of the patch. Start the patch a few bytes earlier or later.");

        this.patches.push(patch);
    }

    writeToNewFile(path: string): void {
        // Build the whole file in memory and write it once (was: stat + seek + write per record).
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

        const file = new archivo.Archivo(path);

        try {
            // Archivo opens without truncating and we write at offset 0: a pre-existing longer
            // file would otherwise keep stale bytes after the "EOF" marker.
            file.handle.truncateSync(0);
            file.writeAt(0, out);
        } finally {
            file.close();
        }
    }
}
