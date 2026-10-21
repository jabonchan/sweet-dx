export function assembleBranchInstruction(src: number, dest: number, link: boolean = false) {
    const hex = (n: number) => "0x" + n.toString(16).toUpperCase();

    if ((src & 3) !== 0 || (dest & 3) !== 0) {
        throw new Error(`Branch source (${hex(src)}) and destination (${hex(dest)}) must both be 4-byte aligned.`);
    }

    // Both addresses are multiples of 4, so plain division is exact and, unlike ">>",
    // stays correct above 2^31.
    let instruction = (dest / 4) - (src / 4) - 2;

    // ARM B/BL encode a SIGNED 24-bit word offset (+-32 MiB). The old check allowed a
    // 25-bit range, so offsets past +-0x7FFFFF words were silently truncated into a
    // branch to the wrong place instead of failing.
    if (instruction < -0x800000 || instruction > 0x7FFFFF) {
        throw new Error(`Branch from ${hex(src)} to ${hex(dest)} is out of range (ARM B/BL can only reach +-32 MiB).`);
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
