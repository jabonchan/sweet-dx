# ✨ SweetDX 🧁

_A sweeter way to mod Deluxe._

SweetDX is a toolchain for modding **New Super Mario Bros. U Deluxe v1.0.0**,
written in Deno/TypeScript. It's a port of
[LibHakkun](https://github.com/fruityloops1/LibHakkun) and
[codedx](https://github.com/RicBent/codedx). You give it your C++ code, a symbol
file with the addresses you know, and a hook file that says where to patch. It
spits out a `subsdk0` and an IPS patch you can drop into the game.

A lot of the code and assets here come from LibHakkun and codedx, so big thanks
to both of them. SweetDX wouldn't exist without their work. Everything else I
used is listed in the credits at the bottom.

I made SweetDX while working on Steam's Super Mario Bros. Deluxe, so it's built
around NSMBU Deluxe specifically. If you want to check out the mod, here's the
[Discord server](https://discord.gg/aXcz6wbKWk).

## 🤔 Why not just use LibHakkun or codedx?

You totally can! But SweetDX adds a few things:

- **Trampolines are generated for you.** If a hook needs to call the original
  function, SweetDX writes the trampoline stub itself. No hand-written assembly.
- **It runs on Windows.** LibHakkun and codedx need Linux (or WSL, or a VM).
  SweetDX runs on Deno, so it works on Windows directly. macOS and Linux should
  work too, I just haven't tested them yet.
- **Less setup than codedx.** You only need a few programs in your `PATH` (see
  below). No Python environment, no extra build scripts.

## ⚠️ Disclaimer

SweetDX is just a dev tool. It doesn't include any game code, assets or
executables from Nintendo. You need your own legally obtained copy of the game
(`main`, etc.).

All third-party stuff is credited below. If you own something used here and
think the credit is wrong or missing, open an issue and I'll fix it.

## 🗃️ Requirements

SweetDX needs the following binaries in your `PATH`:

| Binary             | Used                                                                                                                | Version                                         | Windows                                                                                                                                                                  | Linux                                                                                                                                                   | macOS                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `clang++`          | Compiling the C++ and ASM sources, assembling the instructions of patches and reading the target's predefined types | 16 or newer                                     | devkitPro's MSYS2 (`pacman -S clang`, from MSYS2's own `msys` repository, not devkitPro's), MSYS2 (package `mingw-w64-ucrt-x86_64-clang`) or the official LLVM installer | Your distribution's `clang` package. If it is older than 16, use the LLVM APT repository (Debian/Ubuntu) and make sure `clang++` points to that version | Homebrew `llvm` (`Xcode's clang` won't work!). Homebrew doesn't put it in your `PATH`, so you have to do it manually |
| `clang`            | Compiling the C sources                                                                                             | 16 or newer, the same installation as `clang++` | Installed with `clang++`                                                                                                                                                 | Installed with `clang++`                                                                                                                                | Installed with `clang++`                                                                                             |
| `c++filt`          | Demangling: recognizing hook symbols that are already mangled C++ names                                             | Any                                             | devkitPro's MSYS2 (package `binutils`) or MSYS2 (package `mingw-w64-ucrt-x86_64-binutils`). The official LLVM installer doesn't include it                               | Your distribution's `binutils` package                                                                                                                  | Xcode Command Line Tools                                                                                             |
| `arm-none-eabi-ld` | Linking the compiled objects into the final ELF                                                                     | Any                                             | devkitPro's devkitARM (`pacman -S devkitARM`). devkitPro doesn't put `devkitARM\bin` in your `PATH`, so you have to do it manually                                       | Your distribution's `binutils-arm-none-eabi` (Debian/Ubuntu) or `arm-none-eabi-binutils` (Arch/Fedora) package                                          | Homebrew `arm-none-eabi-binutils`                                                                                    |

A couple of notes:

- When compiling, SweetDX unsets `CPATH`, `C_INCLUDE_PATH`, `CPLUS_INCLUDE_PATH`
  and `CCC_OVERRIDE_OPTIONS` for its own process before calling `c++filt`,
  `clang++`, `clang` and `arm-none-eabi-ld`. This keeps builds the same across
  machines. Your actual environment isn't touched, and you probably won't notice
  any difference.
- `c++filt` is run with `-n` so it doesn't strip the leading underscore from
  mangled names. Some macOS versions do that by default.

## 📄 File Formats

SweetDX reads two kinds of files: `.sym` files, which tell it where things are
in the game, and `.hks` files, which tell it what to patch. Put your `.sym`
files in `symbols/` and your `.hks` files in `hooks/`. You can have as many of
each as you want, SweetDX loads all of them.

Addresses in both formats are hexadecimal (like `0x0025CF50`).

### `.sym` files

A `.sym` file is a list of symbols that already exist in the game, so your code
can use them. It looks like this:

```
# Math
_Z3sinf = 0x009AD484;
_Z3cosf = 0x009AD478;

# new/delete/malloc/free
_Znwj = 0x008DE044;
malloc = 0x00835108;
```

- Each line is `name = address;`. The `;` at the end is optional.
- The name is exactly what the linker sees. C++ functions and variables have to
  be written mangled (`_Z3sinf`, not `sin(float)`), while C ones are just their
  name.
- `#` starts a comment that goes until the end of the line. Empty lines are
  ignored.
- A name can only be defined once per file.

When compiling, every `.sym` file is turned into a linker script. That means you
just declare the function or variable in your headers like you normally would,
and the linker points it to the right address.

### `.hks` files

A `.hks` file is a list of hooks. Each hook has a name followed by a few fields:

```
@ Disables the game from setting original sprite -> profile ids
SpriteToProfileTableNoSInit:
    type:         instr
    instruction:  bx lr
    address:      0x00014724

Profile_get:
    type:     hook
    address:  0x000182A0
    symbol:   Profile::get(unsigned int)
```

- A hook starts with its name and a `:`, with no indentation and no spaces in
  the name. Names have to be unique across **all** your `.hks` files.
- The fields go below it, indented, as `key: value`. The order doesn't matter,
  and you can add spaces to line the values up.
- `@` starts a comment, either at the start of a line or after a space.
- Every hook needs a `type` and an `address`. Two hooks can't target the same
  address.

These are the types you can use:

### Type: `hook`

Replaces the instruction at `address` with a branch (`B`) to your function. Hook
the first instruction of a function and your function runs instead of it,
returning straight to the caller.

```
Profile_get:
    type:     hook
    address:  0x000182A0
    symbol:   Profile::get(unsigned int)
```

- `type`: `hook`.
- `address`: the instruction that gets replaced with the branch. It has to be
  aligned to 4.
- `symbol`: the function the game branches to. It can be written in three
  different ways:
  - **A C name**, like `misc_init`. Use this for functions written in C or ASM,
    or declared as `extern "C"` in C++.
  - **A mangled C++ name**, like `_ZN17SumoBrosLightning9setYSpeedEv`. It's used
    as-is.
  - **A C++ signature**, like `Profile::get(unsigned int)`. SweetDX mangles it
    for you, so it has to match your declaration exactly. Constructors are
    mangled as complete object constructors (`C1`).
- `trampoline` (optional): a function SweetDX generates for you. It runs the
  original instruction your hook overwrote and then jumps back to the game,
  right after `address`. Calling it from your hook is how you run the original
  function. It can be written in the same three ways as `symbol`.

```
Foo_hook:
    type:       hook
    address:    0x00123456
    symbol:     Foo_hook(int value)
    trampoline: Foo_original(int value)
```

```cpp
int Foo_original(int value);

int Foo_hook(int value) {
    // Do your thing here
    return Foo_original(value);
}
```

You only declare the trampoline, SweetDX writes it for you. Trampoline
names/signature have to be unique too. As stated above, they can also be C++
signatures or mangled C++ signatures. Keep in mind the original instruction is
copied as-is, so don't hook instructions that depend on where they are (like
PC-relative loads or branches) if you want to use a trampoline.

### Type: `call`

Replaces the instruction at `address` with a branch with link (`BL`) to your
function. The game calls your function and keeps going right after it.

```
misc_init:
    type:    call
    address: 0x00562998
    symbol:  misc_init
```

- `type`: `call`.
- `address`: the instruction that gets replaced with the branch. It has to be
  aligned to 4.
- `symbol`: the function the game calls. It can be written in the same three
  ways as a `hook`'s `symbol`.

### Type: `instr`

Replaces the instruction at `address` with one you write.

```
BobOmb_noTypeCountCheck:
    type:        instr
    instruction: mov r1, r0,LSR#28
    address:     0x0025CF50
```

- `type`: `instr`.
- `address`: the instruction that gets replaced. It has to be aligned to 4.
- `instruction`: a single 32-bit ARM instruction (not Thumb), written the same
  way you'd write it in a `.s` file.
  - SweetDX assembles it with `clang++` for the same CPU it compiles your code.
  - Only one instruction at a time. If you need more, use a `hook` or a `call`
    to your own code instead.
  - The instruction is assembled on its own, without knowing where it's going to
    end up, so branches and PC-relative loads won't point where you expect. Use
    `hook` or `call` for branching to your code.
  - `#` works just fine (`cmp r1, #0x10000`), as comments in `.hks` use `@`.

### Type: `data`

Writes raw bytes at `address`.

```
Foo_data:
    type:    data
    address: 0x00123456
    data:    DE AD BE EF
```

- `type`: `data`.
- `address`: where the first byte goes. Unlike the other types, it doesn't have
  to be aligned.
- `data`: the bytes to write, in hex. Spaces and `0x` prefixes are optional, so
  `DE AD BE EF`, `0xDE 0xAD 0xBE 0xEF` and `DEADBEEF` all mean the same thing.
  It has to add up to whole bytes, and they're written in the exact order you
  give them, so endianness is on you.

## 📦 static_init

**SweetDX** uses the same `crt0` as **codedx**, and that `crt0` doesn't run any
static initialization by itself (its `_init` just returns). Instead, it ships a
small stub called `static_init_hook` that calls a `static_init` function **you**
have to provide. Your project won't link without it.

Your `static_init` is in charge of two things:

- **Pointing the game to your profile list**: it writes the address of your
  `Profile::spriteToProfileList` into the game's GOT entry for it
  (`got_spriteToProfileList`, defined in your `.sym` files), so the game reads
  your table instead of its own.
- **Running your static constructors**: it calls every function in
  `.init_array`, between `__init_array_start` and `__init_array_end` (both
  provided by SweetDX's linker script). These are the constructors of your
  global C++ objects, and nothing else will run them for you.

Since there's no standard library, you also need to provide `__cxa_atexit` and
`__dso_handle`. The compiler uses them to register the destructors of global
objects. The stub below just ignores them, which is fine because those
destructors would never run anyway.

_Create a `.c` file inside your `source/code/` directory with the following
contents:_

```c
extern unsigned int** got_spriteToProfileList;
extern unsigned int* _ZN7Profile19spriteToProfileListE;

typedef void (*InitFunc)(void);
extern InitFunc __init_array_start;
extern InitFunc __init_array_end;

void static_init()
{
    got_spriteToProfileList = &_ZN7Profile19spriteToProfileListE;

    for (InitFunc* p = &__init_array_start; p < &__init_array_end; p++)
        (*p)();
}

int __cxa_atexit(void (*func)(void*), void* arg, void* d)
{
    return 0;
}

void* __dso_handle = 0;
```

> **NOTE:**
> It has to be a `.c` file, because `crt0` calls `static_init` by its
> plain, unmangled name. If you'd rather use a `.cpp` file, wrap everything in
> `extern "C" { ... }`.

Lastly, the game has to actually run `static_init_hook`, so you need a hook for
it. It replaces the end of a game function that runs during startup, after the
game's own static constructors, so yours always run after the game's. The stub
calls your `static_init`, then executes the overwritten code and returns to the
game as normal.

_Create a hook file inside your `source/hooks/` directory with the following
contents:_

```
static_init:
    type:      hook
    address:   0x0000019C
    symbol:    static_init_hook
```

## 🤖 AI Usage Disclaimer

SweetDX uses AI to help speed up development, document code, and avoid writing
the same boilerplate over and over. That said, most of the project is still
written by humans. AI-generated code is reviewed, tested, and changed when
needed instead of being blindly accepted.

When AI is used more heavily in a particular part of the project, we also try to
add automated tests to catch potential bugs.

The idea is to use AI where it makes sense without losing track of how the code
works or compromising its quality and maintainability. **AI is here to help us
develop SweetDX, not to replace the people behind it.**

## 🪙 Credits

SweetDX depends on these projects. Go give them a star!

| Project                                                                                                  | License      | Used for                                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| [LibHakkun](https://github.com/fruityloops1/LibHakkun) by fruityloops1                                   | BSD-2-Clause | Original inspiration, and where a lot of the hooking, trampoline and symbol code was ported from |
| [codedx](https://github.com/RicBent/codedx) by RicBent                                                   | GPL-3.0      | The NSMBUDX build pipeline this project ports to Deno                                            |
| [@jabonchan/way-ts](https://jsr.io/@jabonchan/way-ts) by me                                              | MIT          | Small path utility library (`join`, `normalize`, `parse`, etc.)                                  |
| [@jabonchan/deeplevel](https://jsr.io/@jabonchan/deeplevel) by me                                        | MIT          | Struct/binary layout library, used to parse ELF and NSO headers                                  |
| [fast-sha256](https://github.com/dchest/fast-sha256-js) by Dmitry Chestnykh                              | Unlicensed   | SHA-256 hashing for NSO sections                                                                 |
| [lz4js](https://github.com/Benzinga/lz4js) (originally by John Chadwick)                                 | ISC          | Decompressing LZ4 NSO segments                                                                   |
| [deno_tree_sitter](https://github.com/jeff-hykin/deno-tree-sitter) by Jeff Hykin                         | Unlicensed   | Running tree-sitter to read C++ function signatures                                              |
| [common_tree_sitter_languages](https://github.com/jeff-hykin/common_tree_sitter_languages) by Jeff Hykin | Unlicensed   | The precompiled C++ tree-sitter grammar                                                          |
| [Deno](https://github.com/denoland/deno)                                                                 | MIT          | The runtime SweetDX runs on                                                                      |

If you maintain any of these and want your credit changed or removed, just let
me know or open an issue.

## 📜 License

SweetDX is licensed under GPL-3.0-or-later. By using it you agree to all terms
and conditions stated in the license.
