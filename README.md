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

## Why not just use LibHakkun or codedx?

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
