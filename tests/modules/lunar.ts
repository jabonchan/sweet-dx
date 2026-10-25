import { assertEquals, assertThrows } from "@std/assert";
import { lunar, utils, way } from "../../deps.ts";

export function test(dir: string) {
    const path = way.join(dir, "./lunar.ips");
    const patch = new lunar.IPSPatch();
    const data = new Uint8Array([ 0xAA, 0xBB ]);

    patch.addPatch({ address: 0x10, data });
    patch.addPatch({ address: 0x123456, data: new Uint8Array([ 0x01 ]) });
    data[0] = 0x00;
    patch.saveAndClose(path);

    const bytes = Deno.readFileSync(path);

    Deno.test("lunar: saveAndClose writes PATCH, every record and EOF", () => {
        const records = [ 0x00, 0x00, 0x10, 0x00, 0x02, 0xAA, 0xBB, 0x12, 0x34, 0x56, 0x00, 0x01, 0x01 ];
        assertEquals([ ...bytes ], [ ...utils.encode("PATCH"), ...records, ...utils.encode("EOF") ]);
    });

    Deno.test("lunar: count is the number of records", () => {
        assertEquals(patch.count, 2);
    });

    Deno.test("lunar: no records after saveAndClose", () => {
        assertThrows(() => patch.addPatch({ address: 0x500, data: new Uint8Array([ 0x01 ]) }), Error, "already-closed");
    });

    Deno.test("lunar: addPatch rejects what IPS can't store", () => {
        const patch = new lunar.IPSPatch();

        assertThrows(() => patch.addPatch({ address: -1, data: new Uint8Array([ 0x01 ]) }), Error, "Invalid IPS address");
        assertThrows(() => patch.addPatch({ address: 0x1000000, data: new Uint8Array([ 0x01 ]) }), Error, "Invalid IPS address");
        assertThrows(() => patch.addPatch({ address: 1.5, data: new Uint8Array([ 0x01 ]) }), Error, "Invalid IPS address");
        assertThrows(() => patch.addPatch({ address: 0x10, data: new Uint8Array(0) }), Error, "empty data");
        assertThrows(() => patch.addPatch({ address: 0x10, data: new Uint8Array(0x10000) }), Error, "too large");
        assertThrows(() => patch.addPatch({ address: 0x454F46, data: new Uint8Array([ 0x01 ]) }), Error, "reserved");
        assertEquals(patch.count, 0);
    });

    Deno.test("lunar: the largest address and size are fine", () => {
        const patch = new lunar.IPSPatch();

        patch.addPatch({ address: 0xFFFFFF, data: new Uint8Array([ 0x01 ]) });
        patch.addPatch({ address: 0x10, data: new Uint8Array(0xFFFF) });

        assertEquals(patch.count, 2);
    });

    Deno.test("lunar: overlapping records are rejected, touching ones aren't", () => {
        const patch = new lunar.IPSPatch();

        patch.addPatch({ address: 0x100, data: new Uint8Array(4) });
        patch.addPatch({ address: 0x104, data: new Uint8Array(1) });
        patch.addPatch({ address: 0xFC, data: new Uint8Array(4) });

        assertThrows(() => patch.addPatch({ address: 0x103, data: new Uint8Array(1) }), Error, "overlap");
        assertThrows(() => patch.addPatch({ address: 0xF0, data: new Uint8Array(0x20) }), Error, "overlap");
        assertEquals(patch.count, 3);
    });

    Deno.test("lunar: doPatchesOverlap", () => {
        assertEquals(lunar.IPSPatch.doPatchesOverlap({ address: 0, data: new Uint8Array(2) }, { address: 1, data: new Uint8Array(1) }), true);
        assertEquals(lunar.IPSPatch.doPatchesOverlap({ address: 0, data: new Uint8Array(2) }, { address: 2, data: new Uint8Array(1) }), false);
        assertEquals(lunar.IPSPatch.doPatchesOverlap({ address: 5, data: new Uint8Array(1) }, { address: 0, data: new Uint8Array(6) }), true);
    });
}
