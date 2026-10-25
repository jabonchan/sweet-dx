import { archivo, brazo, elfo, filetendo, lunar, principe, Recuerdo, titanio, utils, way, wisdom } from "../deps.ts";
import { generateTrampolineSourceCode } from "../lib/generate-trampoline-source-code.ts";
import type { ExtractedAssets } from "../lib/extract-assets.ts";
import { getSourceFiles } from "../lib/get-source-files.ts";
import * as c from "../lib/constants.ts";

/** Compiles the project into subsdk0 and the .ips patch for the main NSO, returns 0 on success */
export function compile(output: string, source: string, assets: ExtractedAssets): number {
    // Step 1: check the project has every folder --init creates and the main NSO
    Recuerdo.log("Checking if the proper enviroment for compiling exists...");
    archivo.checkEnviroment({
        root: source,

        folders: [ "./code", "./hooks", "./nso", "./symbols", "./include" ],
        files: [ "./nso/main" ],

        available: { folders: [], files: [] },
    });
    Recuerdo.log("Found proper source code enviroment");

    // Step 2: check the toolchain, throws if something is missing
    Recuerdo.log("Clearing enviroment and checking required tools...");
    titanio.cleanEnv();
    try {
        titanio.checkClangVersion(false); // clang
        titanio.checkClangVersion(true); // clang++
        principe.exec`c++filt -v`;
        principe.exec`arm-none-eabi-ld -v`;
    } catch {
        Recuerdo.error(
            "Missing the required toolchain. Make sure you have the right versions of arm-none-eabi-ld, clang, clang++ and c++filt available on PATH",
        );
        return 1;
    }
    Recuerdo.log("Found proper development enviroment");

    // Step 3: create exefs_patches/<title id>/ (the .ips) and contents/<title id>/exefs/ (subsdk0)
    Recuerdo.log("Creating the output folders...");
    Deno.mkdirSync(way.join(output, c.NSMBUDX_EXEFS_PATCHES_PATH), { recursive: true });
    Deno.mkdirSync(way.join(output, c.NSMBUDX_EXEFS_PATH), { recursive: true });
    Recuerdo.log("Created the output folders successfully");

    // Step 4: load the main NSO, the source files and an empty IPS patch
    const nsmbudx = new filetendo.ParsedNSO(way.join(source, "./nso/main"));
    const files = getSourceFiles(source);
    const ips = new lunar.IPSPatch();

    // Parse every .sym file (symbol name -> address in the main NSO)
    Recuerdo.log("Loaded the following source files:", files);
    const symbols = files.symbols.map(({ entry }) => {
        Recuerdo.log(`Loading symbol file: ${entry.path.normal}`);
        return new wisdom.Sym(entry.path.normal);
    });
    // Parse every .hks file and merge all of their hooks into a single list
    const hooks = files.hooks.map(({ entry }) => {
        Recuerdo.log(`Loading hooks file: ${entry.path.normal}`);
        const hookFile = new wisdom.Hks(entry.path.normal);
        for (const hook of hookFile.hooks) {
            Recuerdo.log(`Loaded hook named: ${hook.name}`, hook);
        }
        return hookFile.hooks;
    }).flat();
    Recuerdo.log("Finished loading source files");

    // Everything from here runs inside a temp dir
    const backupCWD = way.cwd();
    return utils.withTempDir((temp) => {
        Recuerdo.log(`Switching CWD to "${temp}"`);
        Deno.chdir(temp);

        try {
            // Paths and state used across the remaining steps
            const trampolinesSourceCode = new archivo.Archivo(way.join(temp, "./trampolines.s"));
            // The symbol maps get appended in step 6
            const linkers = [ "-T", assets.linker, "-T", assets.sdk ] as string[];
            const outelf = way.join(temp, "./subsdk0.elf");
            const outnso = way.join(temp, "./subsdk0");
            const seenHookNames = new Set<string>();
            const seenAddresses = new Set<number>();
            const seenTrampolines = new Set<string>();

            let trampolineCount = 0;
            let linkerCount = 0;

            // Step 5: instr and data go straight to the IPS, call and hook wait for step 10 (trampolines are generated now)
            trampolinesSourceCode.appendText("\n");
            Recuerdo.log("Processing hooks...");
            for (const hook of hooks) {
                Recuerdo.info(`Processing hook "${hook.name}"  (type: ${hook.type}, address: ${utils.hexify(hook.address)})`);

                if (seenHookNames.has(hook.name)) {
                    Recuerdo.error(
                        `Two or more hooks use the same name! Duplicated hooks aren't allowed. (Duplicated hook name: ${hook.name})`,
                    );
                    return 1;
                }

                if (seenAddresses.has(hook.address)) {
                    Recuerdo.error(
                        `Two or more hooks target the same address! Duplicated addresses for hooks aren't allowed. (Duplicated hook address: ${
                            utils.hexify(hook.address)
                        })`,
                    );
                    return 1;
                }

                seenHookNames.add(hook.name);
                seenAddresses.add(hook.address);

                switch (hook.type) {
                    case "call":
                        continue;
                    case "instr":
                        // IPS offsets are file offsets, so the NSO header size is added
                        Recuerdo.log("Compiling instruction for hook...");
                        ips.addPatch({ address: hook.address + c.NSO_HEADER_SIZE, data: brazo.assembleInstruction(hook.instruction) });
                        Recuerdo.log(`Successfully compiled ${hook.instruction}`);
                        Recuerdo.log("Added patch to IPS for hook");
                        continue;

                    case "data":
                        // Raw bytes are patched in place as-is
                        ips.addPatch({ address: hook.address + c.NSO_HEADER_SIZE, data: hook.data });
                        Recuerdo.log("Added patch to IPS for hook");
                        continue;
                }

                // Only "hook" hooks reach this point
                if (!hook.trampoline) continue;

                // Only the first name of a trampoline is defined (C1/D1 for constructors and destructors)
                if (seenTrampolines.has(hook.trampoline.symbol[0])) {
                    Recuerdo.error(`Can't have two or more trampolines with the same name; "${hook.trampoline.source}"`);
                    return 1;
                }
                seenTrampolines.add(hook.trampoline.symbol[0]);

                // Original instruction plus a placeholder that becomes the branch back in step 11
                Recuerdo.log(`Generating source code for trampoline...`);
                trampolinesSourceCode.appendText(generateTrampolineSourceCode(hook, nsmbudx));
                trampolineCount++;
                Recuerdo.log(`Successfully generated source code for trampoline!`);
            }
            trampolinesSourceCode.close();
            Recuerdo.log(`Wrote all trampolines' (${trampolineCount}) source code to "${trampolinesSourceCode.path}"`);

            // Step 6: every .sym becomes a .ld, with addresses relative to where subsdk0 is loaded
            for (const symbol of symbols) {
                const path = way.join(temp, `symbol-map-${linkerCount++}.ld`);

                Recuerdo.log(`Generating .ld file for "${symbol.path}" at "${path}"`);

                symbol.toLinker(path, c.NSMBUDX_NSO_MEMORY_SIZE);
                linkers.push("-T", path);

                Recuerdo.log("Successfully generated .ld file!");
            }

            // Step 7: .c files go to clang, .cpp and .s go to clang++ with crt0 and the trampolines
            const cFiles = files.code.filter((file) => file.entry.extension === ".c").map((file) => file.entry.path.normal);
            const cppFiles = files.code.filter((file) => file.entry.extension !== ".c").map((file) => file.entry.path.normal);
            // Cortex-A57 hard-float, PIC, no stdlib, compile only (ld links later)
            const flags = [
                "-I",
                files.include,
                "--no-default-config",
                "--target=armv7l-none-eabihf",
                "-mcpu=cortex-a57",
                "-mfpu=crypto-neon-fp-armv8",
                "-mfloat-abi=hard",
                "-mabi=aapcs-linux",
                "-fPIC",
                "-nostdlib",
                "-c",
            ];

            // Compile inside the temp directory so the .o files are written there
            Recuerdo.log("Starting C++ and ASM compilation process...");
            const clangCppOutput = principe.exec`clang++
                ${flags}
                -fno-rtti
                -fno-exceptions
                -fpermissive

                ${assets.crt0}
                ${trampolinesSourceCode.path}
                ${cppFiles}
            `;
            const stdout = utils.decode(clangCppOutput.stdout).trim();
            const stderr = utils.decode(clangCppOutput.stderr).trim();
            if (stdout.length)
                Recuerdo.log(stdout);
            if (stderr.length)
                Recuerdo.error(stderr);

            if (clangCppOutput.error || clangCppOutput.status) {
                Recuerdo.error(`C++ and ASM compilation failed! Check the log for more details`);
                return 1;
            }

            if (cFiles.length) {
                Recuerdo.log("Starting C compilation process...");
                const clangCOutput = principe.exec`clang
                    ${flags}

                    ${cFiles}
                `;
                const stdout = utils.decode(clangCOutput.stdout).trim();
                const stderr = utils.decode(clangCOutput.stderr).trim();
                if (stdout.length)
                    Recuerdo.log(stdout);
                if (stderr.length)
                    Recuerdo.error(stderr);

                if (clangCOutput.error || clangCOutput.status) {
                    Recuerdo.error(`C compilation failed! Check the log for more details`);
                    return 1;
                }
            }

            // Collect the object files produced by both compilers
            const objects = archivo.listFiles(temp).filter((file) => file.entry.extension === ".o").map((file) => file.entry.path.normal);
            Recuerdo.log("Compilation process finished");

            if (!objects.length) {
                Recuerdo.error("Compilation failed! Compiler didn't produce any shared objects!");
                return 1;
            }

            // Step 8: link into a PIE, unresolved symbols are fine since they live in the main NSO or the SDK
            Recuerdo.log("Started linking process...");
            const linkOutput = principe.exec`arm-none-eabi-ld
                -pie
                ${linkers}
                --unresolved-symbols=ignore-all
                ${objects}
                -o
                ${outelf}
            `;
            const linkerStdout = utils.decode(linkOutput.stdout).trim();
            const linkerStderr = utils.decode(linkOutput.stderr).trim();
            if (linkerStdout.length)
                Recuerdo.log(linkerStdout);
            if (linkerStderr.length)
                Recuerdo.error(linkerStderr);
            Recuerdo.log("Linking process finished");

            if (linkOutput.error || linkOutput.status) {
                Recuerdo.error("Linking process failed!");
                return 1;
            }

            Recuerdo.log(`Linked elf saved to "${outelf}"`);

            // Step 9: the NSO needs .dynstr, .dynsym, the .bss size and 3 loadable segments
            const elf = new elfo.Elf(outelf);
            const dynsym = elf.findSection(".dynsym");
            const dynstr = elf.findSection(".dynstr");
            const bss = elf.findSection(".bss");

            if (!dynstr || !dynsym || !bss) {
                Recuerdo.error("ELF is missing either one ore more of the following sections: .dynsym, .dynstr and/or .bss");
                return 1;
            }

            if (elf.loadableSegments.length !== 3) {
                Recuerdo.error(`Need exactly 3 loadable segments inside the ELF, found ${elf.loadableSegments.length} instead!`);
                return 1;
            }

            const nso = new filetendo.NSO(outnso);
            const text = elf.loadableSegments[0];
            const ro = elf.loadableSegments[1];
            const data = elf.loadableSegments[2];

            // Where each segment is placed in memory
            nso.setProperty("textMemoryOffset", Number(text.vaddr));
            nso.setProperty("roMemoryOffset", Number(ro.vaddr));
            nso.setProperty("dataMemoryOffset", Number(data.vaddr));

            // .dynstr/.dynsym offsets are relative to .ro, .bss is the part of .data with no bytes in the file
            nso.setProperty("dynstrOffset", Number(dynstr.offset - ro.offset));
            nso.setProperty("dynstrSize", Number(dynstr.size));
            nso.setProperty("dynsymOffset", Number(dynsym.offset - ro.offset));
            nso.setProperty("dynsymSize", Number(dynsym.size));
            nso.setProperty("bssSize", Number(data.memsz - data.filesz));

            // No embedded section is used
            nso.setProperty("embeddedOffset", 0);
            nso.setProperty("embeddedSize", 0);

            // Step 10: branch from every hooked address to its function, trampolines get their branch back queued
            const trampolines: { offset: number; chunk: Uint8Array }[] = [];
            // The first candidate the ELF defines (a constructor or destructor has one per variant)
            const findFirstSymbol = (names: readonly string[]) => {
                for (const name of names) {
                    const symbol = elf.findSymbol(name);
                    if (symbol) return symbol;
                }
                return null;
            };
            const quoteAll = (names: readonly string[]) => names.map((name) => `"${name}"`).join(", ");

            for (const hook of hooks) {
                if (hook.type !== "call" && hook.type !== "hook") continue;

                // Look up the hook's target function and, if any, its trampoline
                const hookSymbol = findFirstSymbol(hook.symbol.symbol);
                const trampoline = hook.type === "hook" ? hook.trampoline : null;
                const teSymbol = trampoline ? findFirstSymbol(trampoline.symbol) : null;

                if (!hookSymbol) {
                    Recuerdo.error(`Could not find symbol ${quoteAll(hook.symbol.symbol)} (${hook.symbol.source}) inside ELF!`);
                    return 1;
                }

                if (trampoline && !teSymbol) {
                    Recuerdo.error(`Could not find symbol "${trampoline.symbol[0]}" (${trampoline.source}) inside ELF!`);
                    return 1;
                }

                Recuerdo.info(`Resolved hook symbol "${hookSymbol.name}" (${hook.symbol.source})`);
                if (trampoline)
                    Recuerdo.info(`Resolved trampoline symbol "${teSymbol!.name}" (${trampoline.source})`);

                // subsdk0 is loaded right after the main NSO. call uses BL so it returns to the game, hook uses B
                const origin = hook.address;
                const destiny = c.NSMBUDX_NSO_MEMORY_SIZE + Number(hookSymbol.value);
                const link = hook.type === "call";

                ips.addPatch({ address: hook.address + c.NSO_HEADER_SIZE, data: brazo.assembleBranchInstruction(origin, destiny, link) });
                Recuerdo.log(
                    `Added patch for hook "${hook.name}" (Link?: ${link}). Source: ${utils.hexify(origin)}, Destiny: ${
                        utils.hexify(destiny)
                    }`,
                );

                if (!trampoline) continue;

                // The placeholder is 4 bytes after the trampoline start, offset is its position in the ELF file
                const offset = Number(teSymbol!.value + text.offset + 4n);
                const teOrigin = c.NSMBUDX_NSO_MEMORY_SIZE + Number(teSymbol!.value + 4n);
                const teDestiny = hook.address + 4;
                const chunk = brazo.assembleBranchInstruction(teOrigin, teDestiny);

                Recuerdo.log(
                    `Trampoline "${trampoline.source}" branch-back will be written at .text file offset ${
                        utils.hexify(offset)
                    }, returning from ${utils.hexify(teOrigin)} to ${utils.hexify(teDestiny)}`,
                );
                trampolines.push({ offset, chunk });
            }
            Recuerdo.log(`Resolved ${trampolines.length} trampoline patch(es)`);

            // Step 11: stream .text 4 bytes at a time and swap the trampoline placeholders with their branch back
            nso.writeSection(
                ".text",
                utils.interceptReadStream(text.read(4), ([chunk, offset]) => {
                    const trampoline = trampolines.find((trampoline) => trampoline.offset === offset);

                    if (!trampoline) return [ chunk, offset ];

                    Recuerdo.log(
                        `Intercepted .text chunk at offset ${
                            utils.hexify(offset)
                        } and replaced it with the trampoline branch-back instruction`,
                    );
                    return [ trampoline.chunk, trampoline.offset ];
                }),
            );

            // .ro and .data are copied unchanged, then the NSO is finalized
            nso.writeSection(".ro", ro.read());
            nso.writeSection(".data", data.read());
            nso.digest();

            // Step 12: copy subsdk0 out of the temp dir and write the IPS patch
            Deno.copyFileSync(outnso, way.join(output, c.NSMBUDX_SUBSDK0_PATH));
            ips.saveAndClose(way.join(output, c.NSMBUDX_IPS_PATH));

            return 0;
        } finally {
            Recuerdo.log(`Switching back to previous CWD "${backupCWD}"`);
            Deno.chdir(backupCWD);
        }
    });
}
