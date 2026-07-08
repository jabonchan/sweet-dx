# ✨ SweetDX 🧁
### <i>A sweeter way to mod Deluxe</i>
<hr />

### What is this?

SweetDX is a Deno/TypeScript toolchain for modding **New Super Mario Bros. U Deluxe v1.0.0**, ported from [LibHakkun](https://github.com/fruityloops1/LibHakkun) and [codedx](https://github.com/RicBent/codedx). Feed it your C++ source, a symbol file for the addresses you already know about, and a hook file describing where to patch — it hands you back a ready-to-install `subsdk0` and an IPS patch for the game.

Before anything else: a good chunk of SweetDX's code and assets came straight from [LibHakkun](https://github.com/fruityloops1/LibHakkun) and [codedx](https://github.com/RicBent/codedx). Huge thanks to both — this project simply wouldn't exist without the groundwork they laid, so it felt right to say that up front rather than bury it at the bottom. The rest of the third-party dependencies are credited further down.

SweetDX was built for the development of Steam's Super Mario Bros. Deluxe, which is why it is optimized for New Super Mario Bros. U Deluxe. [Join the mod's Discord server](https://discord.gg/aXcz6wbKWk).

### What makes it different?

SweetDX isn't just a straight port — a few things here you won't find in either LibHakkun or codedx:

- **Automatic trampoline generation.** Need a hook to call back into the original function? The trampoline stub gets generated and wired up for you, no hand-written assembly needed.

- **Runs natively on Windows.** LibHakkun and codedx want Linux (or at least WSL/a VM). SweetDX is built on Deno, so it runs directly on Windows, and should also work on macOS and Linux (untested on both, but no reason it wouldn't).

- **Fewer moving parts than codedx.** You just need a handful of executables on your `PATH` (see [Requirements](#requirements-)) — no Python environment or extra build scripts to wrangle.

### ⚠️ Disclaimer

- SweetDX is a **development tool**. It doesn't contain or distribute any game code, assets, or executables from Nintendo — you'll need to supply your own **legally obtained** copy of the game (`main`, etc.).
  
- Every third-party dependency used is credited in this README. If you're a rights holder and think something here is missing or wrong, please open an issue and I'll sort it out.

### 📋 Requirements

SweetDX itself should run anywhere Deno does, but the compilation pipeline shells out to a small ARM toolchain. Make sure these are available on your `PATH`:

| Executable | Used for | Provided by |
|---|---|---|
| `deno` | Compiling SweetDX or running it directly from source | [Deno](https://deno.com/) |
| `clang++` | Compiling your `.cpp` sources and the auto-generated assembly (`armv7l-none-eabihf` target) | An [LLVM](https://llvm.org/) install with the ARM backend enabled (default in most distributions) |
| `arm-none-eabi-ld` | Linking the final ELF | An ARM GNU/LLVM binutils toolchain (e.g. [Arm GNU Toolchain](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads) or [devkitARM](https://devkitpro.org/)) |
| `c++filt` | Demangling C++ symbols | Same binutils distribution as above |

No Python, WSL, or Linux VM needed — everything above ships native Windows builds.

### 📁 Expected source folder structure

Run SweetDX from the root of your mod project. It expects (and checks, on every build) this layout:

```
your-project/
├── source/
│   ├── code/          # your .cpp source files (nesting supported)
│   ├── hooks/         # your .hks hook-definition files
│   ├── symbols/       # your .sym known-address files
│   └── nso/
│       └── main       # the stock, unmodified "main" NSO extracted from the game
```

- `./source/code`, `./source/hooks`, `./source/symbols` and `./source/nso` need to already exist (they can be empty, except `nso`, which needs `main` in it).

- `./atmosphere` **must not already exist**. SweetDX creates `./atmosphere/contents/<title-id>/exefs` and `./atmosphere/exefs_patches/<title-id>` fresh on every build, so it'll refuse to run if that folder's already there — better safe than accidentally clobbering something you meant to keep.

- A `debug.log` gets written to the project root on every build with a timestamped log of what the pipeline did — handy when you need to figure out why a build failed.

- **`static_init` and why it needs `extern "C"`.** `crt0.s` exposes a small trampoline named `static_init_hook` whose only job is to call out to a function you provide, named `static_init`, meant for whatever early setup your code needs (running static constructors, etc). Two things to know about it:

  - `static_init_hook` isn't called automatically on boot — nothing runs it unless you point a hook at it yourself, with a `.hks` entry like:

    ```hks
    static_init:
        type:     hook
        address:  0x0000019C
        symbol:   .NOMANGLE static_init_hook
    ```

    Pick an `address` early enough in the game's boot sequence that your init logic runs before anything else depends on it — but any valid instruction address works.

  - `static_init_hook` calls `static_init` expecting plain C linkage (an unmangled symbol), since that's how it's referenced from assembly. Since SweetDX always compiles every source file — `.c` included — through `clang++`, any plain definition like `void static_init()` gets silently C++ name-mangled instead of staying as `static_init`. So you must always use `extern "C"` to avoid this problem. Regardless if you install a hook for this function or not you must still declare it like this:

    ```cpp
    extern "C" void static_init() {
        // your early init logic here — or leave it empty
    }
    ```

    You need this declaration even if you never wire up the hook above.

### ⚙️ How a build works

Running `mod.ts` (or the compiled executable from `compile.bat`) roughly goes like this:

1. **Validate** the folder structure above.

2. **Collect sources** — every `.cpp` under `./source`, every `.sym` file (known symbol addresses), every `.hks` file (hook definitions).

3. **Generate trampolines** — for each `hook`-type entry that declares a `trampoline`, emit a small assembly stub that replays the original instruction at the hook address, so your hook can call back into stock code.

4. **Compile** everything (`crt0.s`, the generated trampoline stubs, and your `.cpp` files) with `clang++` into object files.

5. **Link** it all with `arm-none-eabi-ld` into one position-independent ELF, against a linker script built from the game's own memory layout (`sdk.ld`, an auto-generated map of the base game's exported symbols) plus one generated linker script per `.sym` file you provided.

6. **Repack** — read the resulting ELF's loadable segments (`.text`, `.ro`, `.data`) and write them into a brand-new `subsdk0` NSO, patching the branch instructions for every hook (and their trampoline branch-backs) directly into the `.text` stream as it's written out.

7. **Emit patches** — every `instr`/`data` hook, plus the branch redirect for every `hook`-type entry, becomes an IPS patch record targeting the stock `main` NSO.

8. **Output** — an Atmosphère-ready `./atmosphere/contents/<title-id>/exefs/subsdk0` and `./atmosphere/exefs_patches/<title-id>/<build-id>.ips`, ready to drop onto an SD card (real hardware or emulated).

### 🧩 Modules (non-exhaustive tour)

SweetDX's code is split into small, single-purpose modules under `modules/`. This is a map of what lives there, not a full API reference:

| Module | What it does |
|---|---|
| **archivo** | Low-level filesystem primitives: a small `Archivo` file wrapper (streamed reads/writes, append, text I/O), recursive directory listing, existence checks, and the source-folder validator mentioned above. |
| **brazo** | A tiny bridge to `clang` for assembling a single raw AArch32 instruction, plus a pure-TS helper that computes `B`/branch-instruction opcodes for hook redirects and trampoline branch-backs. |
| **elfo** | A dependency-free ELF32/64 reader: header, program headers/segments, sections, symbol table and relocation parsing. Used both to inspect the final linked ELF and the tiny throwaway object files `revoltijo` compiles while mangling names. |
| **filetendo** | Reader/writer for the Nintendo Switch `NSO0` format: parses the stock `main` NSO (segments, compression, hashes) and writes the freshly patched `subsdk0`, LZ4 decompression and SHA-256 section hashing included. |
| **lazy4** | Minimal LZ4 compress/decompress wrapper around the `lz4js` dependency, used by `filetendo` for compressed NSO segments. |
| **lunar** | Builds `.ips` patch files: validates addresses/sizes and writes the IPS binary format Atmosphère's `exefs_patches` expects. |
| **revoltijo** | The auto-mangling engine, and the biggest module by far. Parses a human-written (demangled-looking) C++ function signature with a real C++ grammar (tree-sitter), regenerates a minimal equivalent translation unit, compiles it with `clang++`, and reads the real Itanium-mangled symbol back out of the resulting object file with `elfo`. This is what lets you write `MyClass::DoThing(int, float const&)` in a `.hks` file instead of hand-mangling it or writing raw ASM. |
| **utils** | A small grab-bag of helpers shared by everything else: hex formatting/parsing, buffer comparison, temp-directory handling, text encode/decode, and a stream-interception helper used to splice patched bytes into a read stream on the fly. |
| **wisdom** | Parses the two custom source formats described below: `.hks` (hook definitions) and `.sym` (known symbol addresses). |

### 📝 The `.hks` hook file format

A `.hks` file is a plain-text list of named hook definitions. Each one starts at column 0 with a `name:` header, followed by indented `field: value` lines. Lines starting with `@` and blank lines are just comments and get ignored.

There are four hook types:

```hks
@ a "hook" redirects a location to your function, optionally trampolining back
MyEnemyOnUpdateHook:
    type: hook
    address: 0x001A2B30
    symbol: nsmbu::EnemyBase::onUpdate()
    trampoline: nsmbu::EnemyBase::onUpdateTrampoline()

@ a "call" hook is like "hook" but branches with link (bl) and never trampolines back
MyEnemyOnUpdateCall:
    type: call
    address: 0x001A2B30
    symbol: nsmbu::EnemyBase::onUpdate()

@ an "instr" hook overwrites a single instruction at an address
DisableSomeCheck:
    type: instr
    address: 0x001A2C10
    instruction: nop

@ a "data" hook overwrites raw bytes at an address
PatchSomeConstant:
    type: data
    address: 0x001A2D40
    data: 00 00 80 3F
```

Field reference:

| Type | Required fields | Optional fields | Notes |
|---|---|---|---|
| `hook` | `type`, `address`, `symbol` | `trampoline` | `symbol` (and `trampoline`, if given) can be a plain mangled name **or** a full C++ signature — `revoltijo` mangles it for you if it isn't mangled already. Leave out `trampoline` and it'll just branch to `symbol` without preserving the original instruction. |
| `call` | `type`, `address`, `symbol` | — | Same as `hook`, but has no `trampoline` field and patches a `bl` (branch-with-link) instead of a `b`, so the original code resumes right after the call returns. |
| `instr` | `type`, `address`, `instruction` | — | `instruction` is a single line of real ARM assembly (e.g. `nop`, `mov r0, #1`), assembled through `clang` and inserted as an IPS patch. |
| `data` | `type`, `address`, `data` | — | `data` is a sequence of hex byte pairs, space-separated, with or without a `0x` prefix. |

`symbol` and `trampoline` also accept two directive prefixes for cases the auto-mangler can't (or shouldn't) handle on its own:

- **`.NOMANGLE <name>`** — skips mangling entirely and uses `<name>` exactly as written, looked up as-is in the symbol table. Use this for names that aren't a C++ signature at all (raw SDK exports, already-mangled names `revoltijo` can't round-trip, etc).
- **`.CONSTRUCTOR <ClassName>::<ClassName>(...)`** — mangles the signature as a constructor instead of a plain member function. Plain `symbol: Profile::Profile(int)` would mangle `Profile` as a namespace containing a function also named `Profile`, which is a different (wrong) symbol. `.CONSTRUCTOR` tells `revoltijo` to instead generate `struct Profile { Profile(int); };` and resolves to the complete-object constructor (`...C1E...`).

```hks
@ hooking a raw, already-known symbol without going through the mangler
PatchSdkExport:
    type: call
    address: 0x001A2E00
    symbol: .NOMANGLE nnMain

@ hooking a constructor
PatchProfileCtor:
    type: call
    address: 0x001A2F10
    symbol: .CONSTRUCTOR Profile::Profile(int)
```

`address` is always a hexadecimal offset into `main`'s `.text` section (the same kind of address most NSMBUDX reverse-engineering notes and decompiler dumps use), not a full runtime memory address.

### 🔖 The `.sym` symbol file format

A `.sym` file is a flat list of addresses you already know about and want to call/reference from your C++ code. There's no automatic mangling here, so if a symbol is mangled you'll need to give SweetDX the mangled name yourself. One definition per line:

```sym
# comments start with '#'
_SomeMangledSymbol = 0x0071A2F0;
SomeUnmangledSymbol = 0x00D3B118;
```

Each line follows `name = 0xADDRESS;`. At build time, every `.sym` file turns into a small linker script so those names become linkable extern symbols your `.cpp` files can call directly — no need to declare their addresses by hand in code.

### 🙏 Credits & third-party dependencies

SweetDX works thanks to the projects listed below. If you want to help the creators, go star their projects:

| Dependency | License | Source | Notes |
|---|---|---|---|
| [LibHakkun](https://github.com/fruityloops1/LibHakkun) by fruityloops1 | BSD-2-Clause | github.com/fruityloops1/LibHakkun | Original inspiration and source of ported code/concepts (hooking, trampolines, symbol handling). |
| [codedx](https://github.com/RicBent/codedx) by RicBent | GPL-3.0 | github.com/RicBent/codedx | The original NSMBUDX build-pipeline concept this project ports to Deno/TypeScript. |
| [@jabonchan/way-ts](https://jsr.io/@jabonchan/way-ts) | by me (jabonchan) | jsr.io/@jabonchan/way-ts | My own lightweight path-manipulation utility package (`join`, `normalize`, `parse`, relative-path checks, etc.), published separately on JSR. |
| [@jabonchan/deeplevel](https://jsr.io/@jabonchan/deeplevel) | by me (jabonchan) | jsr.io/@jabonchan/deeplevel | My own zero-dependency, ABI-accurate struct/union/array layout & binary serialization library, published separately on JSR. Used here to parse ELF and NSO binary headers. |
| [fast-sha256](https://github.com/dchest/fast-sha256-js) by Dmitry Chestnykh (dchest) | Unlicensed | github.com/dchest/fast-sha256-js (npm: `fast-sha256`) | SHA-256 hashing of NSO sections. |
| [lz4js](https://github.com/Benzinga/lz4js) (originally by John Chadwick) | ISC | github.com/Benzinga/lz4js (npm: `lz4js`) | LZ4 decompression of compressed NSO segments. |
| [deno_tree_sitter](https://github.com/jeff-hykin/deno-tree-sitter) by Jeff Hykin | Unlicensed | deno.land/x/deno_tree_sitter | Runs the tree-sitter parser used to read C++ function signatures. |
| [common_tree_sitter_languages](https://github.com/jeff-hykin/common_tree_sitter_languages) by Jeff Hykin | Unlicensed | esm.sh/gh/jeff-hykin/common_tree_sitter_languages | Provides the precompiled C++ tree-sitter grammar consumed above. |
| [Deno](https://deno.com/) | MIT | github.com/denoland/deno | The JavaScript/TypeScript runtime SweetDX itself is built on. |

If you maintain one of these projects and want the credit line adjusted (or removed), just reach out or open an issue.

### 📜 License

SweetDX is licensed under **GPL-3.0-or-later**. By using it, you accept its terms.
