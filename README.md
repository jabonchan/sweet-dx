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

# WIP
So uh, this is WIP currently, should work but expect bugs.

# YOU'RE A VIBE CODER
No. Only a minimal amount of code was made by AI (Around 5% or 10%) which was used for the module ``revoltijo`` which is just used for mangling and demangling C++ function signatures. And it was mainly to speed up development due to the need of having the app running as soon as possible, and I'll be rewriting the entire module as soon as I can to be human-made as the rest of the code in SweetDX,so no, it's not vibe coding.

# YOUR CODE SKILLS SUCK
Yeah I had limited time to properly develop SweetDX, but I'll be improving it as time goes by