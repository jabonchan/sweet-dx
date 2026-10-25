import { elfo, principe, titanio, utils, way } from "../../deps.ts";
import { assert, assertEquals, assertThrows } from "@std/assert";

function hasClang() {
    try {
        return principe.exec`clang++ --version`.status === 0;
    } catch {
        return false;
    }
}

// Same target as getClangMacros(), C++20 for char8_t and <=>
const CLANG_ARGS = [
    "--no-default-config",
    "--target=armv7l-none-eabihf",
    "-mcpu=cortex-a57",
    "-mfpu=crypto-neon-fp-armv8",
    "-mfloat-abi=hard",
    "-mabi=aapcs-linux",
    "-std=c++20",
    "-nostdlib",
    "-fno-exceptions",
    "-fno-rtti",
];

// RTTI on, so typeinfo and typeinfo names are emitted
const ENTITY_CLANG_ARGS = CLANG_ARGS.filter(arg => arg !== "-fno-rtti");

// What can't be compiled in: names without _Z, typeinfo for builtins (libc++abi has those) and typedefs
const ENTITY_CASES: [string, string][] = [
    [ "::n_global", "n_global" ],
    [ "int entities::Holder::s_count", "_ZN8entities6Holder7s_countE" ],
    [ "void (*entities::n_callback)(int)", "_ZN8entities10n_callbackE" ],
    [ "typeinfo for int", "_ZTIi" ],
    [ "typeinfo for char const*", "_ZTIPKc" ],
    [ "typeinfo name for u32", "_ZTSj" ],
    [ "guard variable for n_global", "_ZGV8n_global" ],
];

const FUNCTION_SIGNATURES = [ "void Foo::bar(int)", "Foo::Foo()", "Foo::~Foo()", "Foo::operator bool() const", "int (*Foo::get())(int)" ];

// Compiles titanio.cpp and checks every function in it survives demangle -> mangle
export function test(dir: string) {
    if (!hasClang()) return;

    const source = way.join(import.meta.dirname!, "./titanio.cpp");
    const object = way.join(dir, "./titanio.o");
    const output = principe.exec`clang++ ${CLANG_ARGS} -c ${source} -o ${object}`;

    if (output.status !== 0)
        throw new Error(utils.decode(output.stderr));

    const elf = new elfo.Elf(object);

    // _ZT are special names (thunks, vtables...), not functions a signature can describe
    const functions = elf.symbols.filter(symbol => !symbol.isUndefined && symbol.type === elfo.STT.FUNC && symbol.name.startsWith("_Z") && !symbol.name.startsWith("_ZT"));
    const symbols = [ ...new Set(functions.map(symbol => symbol.name)) ];

    elf.file.close();

    Deno.test("titanio: titanio.cpp defines C++ functions", () => {
        assert(symbols.length > 0);
    });

    for (const symbol of symbols) {
        Deno.test(`titanio: ${symbol}`, () => {
            const signature = titanio.demangle(symbol);
            const mangled = titanio.mangle(signature);

            assert(mangled.includes(symbol), `"${signature}" mangles to ${mangled.join(", ")}, not ${symbol}`);
        });
    }

    testEntities(dir);
}

// Compiles titanio-entities.cpp and checks every variable and special name in it survives demangle -> mangle
function testEntities(dir: string) {
    const source = way.join(import.meta.dirname!, "./titanio-entities.cpp");
    const object = way.join(dir, "./titanio-entities.o");
    const output = principe.exec`clang++ ${ENTITY_CLANG_ARGS} -c ${source} -o ${object}`;

    if (output.status !== 0)
        throw new Error(utils.decode(output.stderr));

    const elf = new elfo.Elf(object);

    // Local statics (_ZZ, _ZGVZ) and construction vtables (_ZTC) aren't supported
    const objects = elf.symbols.filter(symbol => !symbol.isUndefined && symbol.type === elfo.STT.OBJECT && symbol.name.startsWith("_Z") && !/^_Z(Z|GVZ|TC)/.test(symbol.name));
    const symbols = [ ...new Set(objects.map(symbol => symbol.name)) ];

    elf.file.close();

    Deno.test("titanio: titanio-entities.cpp defines every kind of entity", () => {
        for (const prefix of [ "_ZN", "_ZTV", "_ZTT", "_ZTI", "_ZTS", "_ZGV" ])
            assert(symbols.some(symbol => symbol.startsWith(prefix)), `No ${prefix} symbol in ${symbols.join(", ")}`);
    });

    for (const symbol of symbols) {
        Deno.test(`titanio: ${symbol}`, () => {
            const signature = titanio.demangle(symbol);

            assert(titanio.isCppEntitySignature(signature), `"${signature}" is not detected as an entity`);
            assert(!titanio.isCppFunctionSignature(signature), `"${signature}" is detected as a function`);
            assertEquals(titanio.mangleAs(signature, "default"), symbol);
            assertEquals(titanio.mangle(signature), [ symbol ]);
        });
    }

    for (const [ signature, symbol ] of ENTITY_CASES) {
        Deno.test(`titanio: ${signature}`, () => {
            assert(titanio.isCppEntitySignature(signature), `"${signature}" is not detected as an entity`);
            assertEquals(titanio.mangleAs(signature, "default"), symbol);
        });
    }

    Deno.test("titanio: functions are not entities", () => {
        for (const signature of FUNCTION_SIGNATURES)
            assert(!titanio.isCppEntitySignature(signature), `"${signature}" is detected as an entity`);
    });

    Deno.test("titanio: entities can't have a constructor/destructor variant", () => {
        assertThrows(() => titanio.mangleAs("entities::Holder::s_count", "C1"), Error, "not a constructor/destructor");
        assertThrows(() => titanio.mangleAs("vtable for entities::Polymorphic", "D0"), Error, "not a constructor/destructor");
    });
}
