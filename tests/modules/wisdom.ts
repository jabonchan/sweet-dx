import { assertEquals, assertStringIncludes } from "@std/assert";
import { principe, way, wisdom } from "../../deps.ts";

function hasClang() {
    try {
        return principe.exec`clang++ --version`.status === 0;
    } catch {
        return false;
    }
}

const GOOD_SYM = `# comment
first_c_name = 0x00000100 # trailing comment
_ZN5ActorD2Ev = 0x2D98;
Actor::~Actor() as D0 = 0x2E5C;
Actor::Actor(const ActorBuildInfo*) as c2 = 0x2C54;
bool Foo::operator==(Foo const&) const = 0x40;
void Foo::bar(int) = 0x10
`;

const BAD_SYMS: Record<string, string> = {
    duplicate: "_ZN3Foo3barEi = 0x10;\nvoid Foo::bar(int) = 0x20;\n",
    variantOnCName: "foo as D0 = 0x10;\n",
    variantOnFunction: "void Foo::bar(int) as C1 = 0x10;\n",
    invalid: "foo = bar;\n",
};

const GOOD_HKS = `@ comment line
hookOne:
    type: hook
    address: 0x00001000 @ trailing comment
    symbol: void Foo::bar(int)
    trampoline: fooTrampoline

callOne:
    type: call
    address: 0x2000
    symbol: _ZN3Foo3barEi

ctorHook:
    type: hook
    address: 0x3000
    symbol: Foo::Foo()

instrOne:
    type: instr
    address: 0x4000
    instruction: mov r0, #1

dataOne:
    type: data
    address: 0x5001
    data: DEAD 0xBE ef
`;

const BAD_HKS: Record<string, string> = {
    // "constructor" is in every object through its prototype, it used to pass the type check and crash
    prototypeType: "bad:\n    type: constructor\n    address: 0x100\n    symbol: foo\n",
    missingField: "bad:\n    type: hook\n    address: 0x100\n",
    unknownField: "bad:\n    type: call\n    address: 0x100\n    symbol: foo\n    trampoline: bar\n",
    unaligned: "bad:\n    type: hook\n    address: 0x102\n    symbol: foo\n",
    duplicateHook: "bad:\n    type: call\n    address: 0x100\n    symbol: foo\nbad:\n    type: call\n    address: 0x200\n    symbol: foo\n",
    fieldBeforeHeader: "    type: call\n",
    oddData: "bad:\n    type: data\n    address: 0x100\n    data: ABC\n",
};

export function test(dir: string) {
    // Signatures are mangled with clang's macros
    if (!hasClang()) return;

    Deno.writeTextFileSync(way.join(dir, "./wisdom.sym"), GOOD_SYM);
    new wisdom.Sym(way.join(dir, "./wisdom.sym")).toLinker(way.join(dir, "./wisdom.ld"), 0x10);

    const linker = Deno.readTextFileSync(way.join(dir, "./wisdom.ld"));
    const symErrors: Record<string, string> = {};

    for (const [ name, text ] of Object.entries(BAD_SYMS)) {
        const path = way.join(dir, `./wisdom-${name}.sym`);
        Deno.writeTextFileSync(path, text);

        try {
            new wisdom.Sym(path).toLinker(path + ".ld", 0);
        } catch (e) {
            symErrors[name] = (e as Error).message;
        }
    }

    Deno.writeTextFileSync(way.join(dir, "./wisdom.hks"), GOOD_HKS);

    const hks = new wisdom.Hks(way.join(dir, "./wisdom.hks"));
    const hksErrors: Record<string, string> = {};

    for (const [ name, text ] of Object.entries(BAD_HKS)) {
        const path = way.join(dir, `./wisdom-${name}.hks`);
        Deno.writeTextFileSync(path, text);

        try {
            new wisdom.Hks(path);
        } catch (e) {
            hksErrors[name] = (e as Error).message;
        }
    }

    Deno.test("wisdom: toLinker mangles, applies the offset and sorts by address", () => {
        const expected = [
            "_ZN3Foo3barEi = 0x00000000;",
            "_ZNK3FooeqERKS_ = 0x00000030;",
            "first_c_name = 0x000000F0;",
            "_ZN5ActorC2EPK14ActorBuildInfo = 0x00002C44;",
            "_ZN5ActorD2Ev = 0x00002D88;",
            "_ZN5ActorD0Ev = 0x00002E4C;",
        ];

        assertEquals(linker, expected.join("\n") + "\n");
    });

    Deno.test("wisdom: bad .sym files", () => {
        assertStringIncludes(symErrors.duplicate, `Duplicate symbol "_ZN3Foo3barEi" at line 2`);
        assertStringIncludes(symErrors.variantOnCName, `can't use "as D0"`);
        assertStringIncludes(symErrors.variantOnFunction, "is not a constructor");
        assertStringIncludes(symErrors.invalid, "Invalid symbol definition at line 1");
    });

    Deno.test("wisdom: hook with a C++ signature and a C trampoline", () => {
        assertEquals(hks.findHook("hookOne"), {
            name: "hookOne",
            type: "hook",
            address: 0x1000,
            symbol: { symbol: [ "_ZN3Foo3barEi" ], type: "c++", source: "void Foo::bar(int)" },
            trampoline: { symbol: [ "fooTrampoline" ], type: "c", source: "fooTrampoline" },
        });
    });

    Deno.test("wisdom: call with a mangled symbol", () => {
        assertEquals(hks.findHook("callOne"), {
            name: "callOne",
            type: "call",
            address: 0x2000,
            symbol: { symbol: [ "_ZN3Foo3barEi" ], type: "mangled", source: "_ZN3Foo3barEi" },
        });
    });

    Deno.test("wisdom: a constructor gets every variant, C1 first", () => {
        const ctor = hks.findHook("ctorHook");
        assertEquals(ctor?.type === "hook" && ctor.symbol.symbol, [ "_ZN3FooC1Ev", "_ZN3FooC2Ev", "_ZN3FooC3Ev" ]);
    });

    Deno.test("wisdom: instr and data hooks", () => {
        assertEquals(hks.findHook("instrOne"), { name: "instrOne", type: "instr", address: 0x4000, instruction: "mov r0, #1" });
        assertEquals(hks.findHook("dataOne"), { name: "dataOne", type: "data", address: 0x5001, data: new Uint8Array([ 0xDE, 0xAD, 0xBE, 0xEF ]) });
    });

    Deno.test("wisdom: bad .hks files", () => {
        assertStringIncludes(hksErrors.prototypeType, `missing or invalid "type"`);
        assertStringIncludes(hksErrors.missingField, `missing required field "symbol"`);
        assertStringIncludes(hksErrors.unknownField, `unknown field "trampoline"`);
        assertStringIncludes(hksErrors.unaligned, "not aligned to 4");
        assertStringIncludes(hksErrors.duplicateHook, `Duplicate hook "bad"`);
        assertStringIncludes(hksErrors.fieldBeforeHeader, "before any hook header");
        assertStringIncludes(hksErrors.oddData, "even hex digit count");
    });
}
