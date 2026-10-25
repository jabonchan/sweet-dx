import { assertEquals, assertStringIncludes, assertThrows } from "@std/assert";
import { filetendo, way } from "../../deps.ts";

const TEXT = new Uint8Array(0x40).map((_, i) => i * 3);
const RO = new Uint8Array(0x18).map((_, i) => 0xFF - i);
const DATA = new Uint8Array([ 0xDE, 0xAD, 0xBE, 0xEF, 0x01, 0x02, 0x03, 0x04 ]);

// The game's main NSO, it's gitignored so the test only runs where it exists
const GAME_NSO = way.join(import.meta.dirname!, "../../source/nso/main");

function stream(...chunks: Uint8Array[]) {
    return {
        *[Symbol.iterator]() {
            let offset = 0;

            for (const chunk of chunks) {
                yield [ chunk, offset ] as const;
                offset += chunk.length;
            }
        },
    };
}

export function test(dir: string) {
    const path = way.join(dir, "./filetendo.nso");
    const tamperedPath = way.join(dir, "./filetendo-tampered.nso");
    const nso = new filetendo.NSO(path);
    const errors = { outOfOrder: "", earlyDigest: "", twice: "", missingSection: "" };

    try {
        nso.writeSection(".ro", stream(RO));
    } catch (e) {
        errors.outOfOrder = (e as Error).message;
    }

    try {
        nso.digest();
    } catch (e) {
        errors.earlyDigest = (e as Error).message;
    }

    nso.setProperty("textMemoryOffset", 0x0);
    nso.setProperty("roMemoryOffset", 0x1000);
    nso.setProperty("dataMemoryOffset", 0x2000);
    nso.setProperty("bssSize", 0x30);
    nso.setProperty("embeddedOffset", 0);
    nso.setProperty("embeddedSize", 0);
    nso.setProperty("dynstrOffset", 0x4);
    nso.setProperty("dynstrSize", 0x8);
    nso.setProperty("dynsymOffset", 0xC);
    nso.setProperty("dynsymSize", 0x10);

    // Two chunks, so the hash has to cover both
    nso.writeSection(".text", stream(TEXT.subarray(0, 0x10), TEXT.subarray(0x10)));
    nso.writeSection(".ro", stream(RO));

    try {
        nso.writeSection(".ro", stream(RO));
    } catch (e) {
        errors.twice = (e as Error).message;
    }

    try {
        nso.digest();
    } catch (e) {
        errors.missingSection = (e as Error).message;
    }

    nso.writeSection(".data", stream(DATA));
    nso.digest();

    const parsed = new filetendo.ParsedNSO(path);

    // Changing what the first read returned must not change the next one
    const firstRead = parsed.data.read();
    firstRead[0] ^= 0xFF;
    const secondRead = parsed.data.read();

    const segments = parsed.segments.map(segment => [ ...segment.read() ]);
    const hashes = parsed.segments.map(segment => segment.verifyHash());
    const instruction = parsed.getInstructionAt(4);
    const moduleName = parsed.getModuleName();

    parsed.close();

    // Same file with the last byte of .data flipped
    const bytes = Deno.readFileSync(path);
    bytes[bytes.length - 1] ^= 0xFF;
    Deno.writeFileSync(tamperedPath, bytes);

    const tampered = new filetendo.ParsedNSO(tamperedPath);
    let tamperedRead = "";
    let tamperedReadAgain = "";

    try {
        tampered.data.read();
    } catch (e) {
        tamperedRead = (e as Error).message;
    }

    try {
        tampered.data.read();
    } catch (e) {
        tamperedReadAgain = (e as Error).message;
    }

    tampered.close();

    // Opened again so verifyHash doesn't see what the reads cached
    const tamperedAgain = new filetendo.ParsedNSO(tamperedPath);
    const tamperedHash = tamperedAgain.data.verifyHash();

    tamperedAgain.close();

    let game: { compressed: boolean[]; hashes: boolean[] } | null = null;

    try {
        const main = new filetendo.ParsedNSO(GAME_NSO);
        game = { compressed: main.segments.map(segment => segment.isCompressed), hashes: main.segments.map(segment => segment.verifyHash()) };
        main.close();
    } catch {
        game = null;
    }

    Deno.test("filetendo: NSO checks the order of the sections and what's missing", () => {
        assertStringIncludes(errors.outOfOrder, `Expected ".text" next`);
        assertStringIncludes(errors.earlyDigest, "missing required properties");
        assertStringIncludes(errors.twice, "already been written");
        assertStringIncludes(errors.missingSection, "missing required sections: .data");
    });

    Deno.test("filetendo: a written NSO parses back with the same header", () => {
        assertEquals(parsed.flags, filetendo.FLAGS);
        assertEquals(parsed.version, 0);
        assertEquals([ ...parsed.buildId ], new Array(filetendo.BUILD_ID_SIZE).fill(0));
        assertEquals(parsed.bssSize, 0x30);
        assertEquals(parsed.segments.map(segment => segment.memoryOffset), [ 0x0, 0x1000, 0x2000 ]);
        assertEquals([ parsed.embeddedOffset, parsed.embeddedSize ], [ 0, 0 ]);
        assertEquals([ parsed.dynstrOffset, parsed.dynstrSize, parsed.dynsymOffset, parsed.dynsymSize ], [ 0x4, 0x8, 0xC, 0x10 ]);
        assertEquals(moduleName, "");
    });

    Deno.test("filetendo: a written NSO parses back with the same segments and hashes", () => {
        assertEquals(segments, [ [ ...TEXT ], [ ...RO ], [ ...DATA ] ]);
        assertEquals(hashes, [ true, true, true ]);
    });

    Deno.test("filetendo: getInstructionAt", () => {
        assertEquals(instruction, new DataView(TEXT.buffer).getUint32(4, true));
        assertThrows(() => parsed.getInstructionAt(2), Error, "multiple of 4");
    });

    Deno.test("filetendo: segment read returns a copy", () => {
        assertEquals(secondRead[0], DATA[0]);
    });

    Deno.test("filetendo: a changed segment fails its hash", () => {
        assertStringIncludes(tamperedRead, "Hashes don't match");
    });

    Deno.test("filetendo: a changed segment keeps failing on the next read", () => {
        assertStringIncludes(tamperedReadAgain, "Hashes don't match");
    });

    Deno.test("filetendo: verifyHash returns false for a changed segment", () => {
        assertEquals(tamperedHash, false);
    });

    if (!game) return;

    Deno.test("filetendo: the game's main NSO decompresses and matches its hashes", () => {
        assertEquals(game!.compressed.includes(true), true);
        assertEquals(game!.hashes, [ true, true, true ]);
    });
}
