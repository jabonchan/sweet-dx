import { utils } from "../deps.ts";

/**
 * Encodes an ARM (A32) `B`, or `BL` when `link` is set, from `src` to `dest`
 * as 4 little-endian bytes.
 */
export function assembleBranchInstruction(
    src: number,
    dest: number,
    link: boolean = false,
) {
    if (!Number.isSafeInteger(src) || !Number.isSafeInteger(dest)) {
        throw new Error("Branch source and destination must be safe integers.");
    }

    if ((src & 3) !== 0 || (dest & 3) !== 0) {
        throw new Error(
            `Branch source (${utils.hexify(src)}) and destination (${
                utils.hexify(dest)
            }) must both be 4-byte aligned.`,
        );
    }

    // The offset is in words and relative to PC, which is 8 bytes (2 words) ahead of `src`.
    let instruction = (dest / 4) - (src / 4) - 2;

    if (instruction < -0x800000 || instruction > 0x7FFFFF) {
        throw new Error(
            `Branch from ${utils.hexify(src)} to ${
                utils.hexify(dest)
            } is out of range (ARM B/BL can only reach +-32 MiB).`,
        );
    }

    instruction &= 0x00FFFFFF;
    instruction |= 0b101 << 25;

    if (link) instruction |= 1 << 24;

    // Condition `AL` (always), then `>>> 0` to make it unsigned again.
    instruction |= 14 << 28;
    instruction >>>= 0;

    const array = new Uint8Array([
        instruction & 0xFF,
        (instruction >>> 8) & 0xFF,
        (instruction >>> 16) & 0xFF,
        (instruction >>> 24) & 0xFF,
    ]);

    return array;
}
