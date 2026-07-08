export function assembleBranchInstruction(src: number, dest: number, link: boolean = false) {
    if ((src & 3) !== 0 || (dest & 3) !== 0) {
        throw new Error("Source and destination must be 4-byte aligned");
    }

    let instruction = (dest >> 2) - (src >> 2) - 2;

    if (instruction < -0x1000000 || instruction > 0xFFFFFF) {
        throw new Error("Out of bounds jump range!");
    }

    instruction &= 0x00FFFFFF;
    instruction |= 0b101 << 25;
    if (link) instruction |= 1 << 24;
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
