import { elfo, principe, utils, way } from "../../deps.ts";
import { assertEquals, assertStringIncludes } from "@std/assert";

function hasClang() {
    try {
        return principe.exec`clang++ --version`.status === 0;
    } catch {
        return false;
    }
}

const SOURCE = `extern "C" int external(int);
extern "C" int callsExternal(int x) { return external(x) + 1; }
extern "C" int counter = 5;
extern "C" const char message[] = "elfo";
`;

export function test(dir: string) {
    if (!hasClang()) return;

    const source = way.join(dir, "./elfo.cpp");
    const object = way.join(dir, "./elfo.o");

    Deno.writeTextFileSync(source, SOURCE);

    const output = principe.exec`clang++ --no-default-config --target=armv7l-none-eabihf -mcpu=cortex-a57 -mfloat-abi=hard -c ${source} -o ${object}`;

    if (output.status !== 0)
        throw new Error(utils.decode(output.stderr));

    // Sections and symbols are parsed in the constructor, only section contents need the file open
    const elf = new elfo.Elf(object);
    const wasOpen = elf.file.isOpen();
    const data = [ ...elf.findSection(".data")!.read() ].flatMap(([ chunk ]) => [ ...chunk ]);

    elf.file.close();

    let notAnElf = "";

    try {
        new elfo.Elf(source);
    } catch (e) {
        notAnElf = (e as Error).message;
    }

    Deno.test("elfo: header of a 32-bit ARM object", () => {
        assertEquals(elf.bits, 32);
        assertEquals(elf.type, elfo.ET.REL);
        assertEquals(elf.machine, elfo.EM.ARM);
    });

    Deno.test("elfo: sections and their types", () => {
        assertEquals(elf.findSection(".text")?.type, elfo.SHT.PROGBITS);
        assertEquals(elf.findSection(".data")?.type, elfo.SHT.PROGBITS);
        assertEquals(elf.findSection(".symtab")?.type, elfo.SHT.SYMTAB);
        assertEquals(elf.findSection(".strtab")?.type, elfo.SHT.STRTAB);
        assertEquals(elf.findSection(".rel.text")?.type, elfo.SHT.REL);
    });

    Deno.test("elfo: defined and undefined symbols", () => {
        const callsExternal = elf.findSymbol("callsExternal")!;

        assertEquals([ callsExternal.type, callsExternal.binding, callsExternal.isUndefined ], [ elfo.STT.FUNC, elfo.STB.GLOBAL, false ]);
        assertEquals(elf.findSymbol("counter")?.type, elfo.STT.OBJECT);
        assertEquals(elf.findSymbol("message")?.isUndefined, false);
        assertEquals(elf.findSymbol("external")?.isUndefined, true);
    });

    Deno.test("elfo: REL relocations have their symbol names and no addend", () => {
        const text = elf.relSections.find(rel => rel.name === ".rel.text")!;

        assertEquals(text.entries.some(entry => entry.symbolName === "external"), true);
        assertEquals(text.entries.every(entry => entry.addend === null), true);
    });

    Deno.test("elfo: section contents", () => {
        assertEquals(data, [ 0x05, 0x00, 0x00, 0x00 ]);
    });

    Deno.test("elfo: an object file has no segments", () => {
        assertEquals(elf.segments.length, 0);
        assertEquals(elf.loadableSegments.length, 0);
    });

    Deno.test("elfo: findSection and findSymbol return null when missing", () => {
        assertEquals(elf.findSection(".nope"), null);
        assertEquals(elf.findSymbol("nope"), null);
    });

    Deno.test("elfo: the file stays open after parsing", () => {
        assertEquals(wasOpen, true);
    });

    Deno.test("elfo: anything that isn't an ELF is rejected", () => {
        assertStringIncludes(notAnElf, "incorrect magic number");
    });
}
