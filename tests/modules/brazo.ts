import { assertEquals, assertNotEquals, assertThrows } from "@std/assert";
import { brazo, principe } from "../../deps.ts";

function hasClang() {
    try {
        return principe.exec`clang++ --version`.status === 0;
    } catch {
        return false;
    }
}

function word(bytes: Uint8Array) {
    return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);
}

export function test(_dir: string) {
    Deno.test("brazo: B and BL encodings", () => {
        assertEquals([ ...brazo.assembleBranchInstruction(0, 8) ], [ 0x00, 0x00, 0x00, 0xEA ]);
        assertEquals(word(brazo.assembleBranchInstruction(0, 0)), 0xEAFFFFFE);
        assertEquals(word(brazo.assembleBranchInstruction(0x100, 0, true)), 0xEBFFFFBE);
        assertEquals(word(brazo.assembleBranchInstruction(0x1000, 0x2000, true)), 0xEB0003FE);
    });

    Deno.test("brazo: branches reach +-32 MiB and no further", () => {
        const base = 0x4000000;

        assertEquals(word(brazo.assembleBranchInstruction(base, base + 8 + 0x7FFFFF * 4)), 0xEA7FFFFF);
        assertEquals(word(brazo.assembleBranchInstruction(base, base + 8 - 0x800000 * 4)), 0xEA800000);
        assertThrows(() => brazo.assembleBranchInstruction(base, base + 8 + 0x800000 * 4), Error, "out of range");
        assertThrows(() => brazo.assembleBranchInstruction(base, base + 4 - 0x800000 * 4), Error, "out of range");
    });

    Deno.test("brazo: branch addresses must be aligned safe integers", () => {
        assertThrows(() => brazo.assembleBranchInstruction(2, 8), Error, "aligned");
        assertThrows(() => brazo.assembleBranchInstruction(0, 6), Error, "aligned");
        assertThrows(() => brazo.assembleBranchInstruction(0, 2 ** 60), Error, "safe integers");
    });

    if (!hasClang()) return;

    // assembleInstruction makes its own temp dir for clang, so it's called as little as possible
    Deno.test("brazo: assembleInstruction", () => {
        assertEquals(word(brazo.assembleInstruction("mov r0, #1")), 0xE3A00001);
        assertEquals(word(brazo.assembleInstruction("  bx   lr ")), 0xE12FFF1E);
        // Both are relative to the instruction itself
        assertEquals([ ...brazo.assembleInstruction("b .") ], [ ...brazo.assembleBranchInstruction(0, 0) ]);
    });

    Deno.test("brazo: assembleInstruction returns a copy of the cached bytes", () => {
        const first = brazo.assembleInstruction("mov r0, #1");
        first[0] = 0xFF;

        assertNotEquals(brazo.assembleInstruction("mov r0, #1")[0], 0xFF);
    });

    Deno.test("brazo: assembleInstruction fails on bad input", () => {
        assertThrows(() => brazo.assembleInstruction("nop\n    nop"), Error, "multiple instructions");
        assertThrows(() => brazo.assembleInstruction("notaninstruction r0"), Error, "Failed to assemble");
    });
}
