import { assert, assertEquals, assertThrows } from "@std/assert";
import { lazy4 } from "../../deps.ts";

// Same bytes every run, and random enough that lz4js can't compress them
function random(length: number, seed: number) {
    const bytes = new Uint8Array(length);

    for (let i = 0; i < length; i++) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        bytes[i] = seed >>> 24;
    }

    return bytes;
}

export function test(_dir: string) {
    Deno.test("lazy4: round trip of small and boundary sizes", () => {
        for (const length of [ 1, 14, 15, 16, 254, 269, 270, 271, 525, 4096 ]) {
            const data = random(length, length);
            assertEquals([ ...lazy4.decompress(lazy4.compress(data), length) ], [ ...data ], `${length} bytes`);
        }
    });

    Deno.test("lazy4: round trip of an empty buffer", () => {
        assertEquals(lazy4.decompress(lazy4.compress(new Uint8Array(0)), 0).length, 0);
    });

    Deno.test("lazy4: repeated data gets smaller", () => {
        const data = new Uint8Array(0x10000).map((_, i) => i % 7);
        const compressed = lazy4.compress(data);

        assert(compressed.length < data.length / 10, `${compressed.length} bytes`);
        assertEquals([ ...lazy4.decompress(compressed, data.length) ], [ ...data ]);
    });

    // lz4js gives up on these, so they're stored as a single run of literals
    Deno.test("lazy4: literal lengths of 15 and 270 get their extra length bytes", () => {
        const fifteen = lazy4.compress(random(15, 3));
        assertEquals(fifteen.length, 1 + 1 + 15);
        assertEquals([ fifteen[0], fifteen[1] ], [ 0xF0, 0 ]);

        const big = lazy4.compress(random(270, 4));
        assertEquals([ big[0], big[1], big[2] ], [ 0xF0, 255, 0 ]);
    });

    Deno.test("lazy4: decompress fails on the wrong size", () => {
        const compressed = lazy4.compress(random(100, 1));

        assertThrows(() => lazy4.decompress(compressed, 99));
        assertThrows(() => lazy4.decompress(compressed, 101), Error, "size mismatch");
    });
}
