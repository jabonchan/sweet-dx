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

    addPatch(patch: Patch): void {
        if (patch.address < 0 || patch.address > 0x00FFFFFF)
            throw new Error("Invalid IPS address patch range (0x00000000 - 0x00FFFFFF): " + utils.hexify(patch.address));

        if (patch.data.byteLength > 0x0000FFFF)
            throw new Error("The IPS patch data is too large (0x0000FFFF): " + utils.hexify(patch.data.byteLength));

        if (patch.address === 0x454F46)
            throw new Error("0x00454F46 ('EOF') is a reserved IPS address.");

        this.patches.push(patch);
    }

    writeToNewFile(path: string): void {
        const file = new archivo.Archivo(path);

        file.append(IPSMAG);

        for (const patch of this.patches) {
            const addrHigh = (patch.address >>> 16) & 0xFF;
            const addrMiddle = (patch.address >>> 8) & 0xFF;
            const addrLow = patch.address & 0xFF;

            const sizeHigh = (patch.data.byteLength >>> 8) & 0xFF;
            const sizeLow = patch.data.byteLength & 0xFF;

            const data = patch.data;

            file.append(new Uint8Array([ addrHigh, addrMiddle, addrLow, sizeHigh, sizeLow, ...data ]));
        }

        file.append(IPSEND);
        file.close();
    }
}