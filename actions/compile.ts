import {
    archivo,
    brazo,
    elfo,
    filetendo,
    lunar,
    principe,
    Recuerdo,
    titanio,
    utils,
    way,
    wisdom,
} from "../deps.ts";
import { generateTrampolineSourceCode } from "../lib/generate-trampoline-source-code.ts";
import type { ExtractedAssets } from "../lib/extract-assets.ts";
import { getSourceFiles } from "../lib/get-source-files.ts";

import * as c from "../lib/constants.ts";

export function compile(
    output: string,
    source: string,
    assets: ExtractedAssets,
): number {
    Recuerdo.log("Checking if the proper enviroment for compiling exists...");
    archivo.checkEnviroment({
        root: source,

        folders: ["./code", "./hooks", "./nso", "./symbols"],
        files: ["./nso/main"],

        available: {
            folders: [],
            files: [],
        },
    });
    Recuerdo.log("Found proper source code enviroment");

    Recuerdo.log("Clearing enviroment and checking required tools...");
    titanio.cleanEnv();
    try {
        titanio.checkClangVersion(false);
        titanio.checkClangVersion(true);
        principe.exec`c++filt -v`;
        principe.exec`arm-none-eabi-ld -v`;
    } catch {
        Recuerdo.error(
            "Missing the required toolchain. Make sure you have the right versions of arm-none-eabi-ld, clang, clang++ and c++filt available on PATH",
        );
        return 1;
    }
    Recuerdo.log("Found proper development enviroment");

    Recuerdo.log("Creating the output folders...");
    Deno.mkdirSync(way.join(output, c.NSMBUDX_EXEFS_PATCHES_PATH), {
        recursive: true,
    });
    Deno.mkdirSync(way.join(output, c.NSMBUDX_EXEFS_PATH), { recursive: true });
    Recuerdo.log("Created the output folders successfully");

    const nsmbudx = new filetendo.ParsedNSO(way.join(source, "./nso/main"));
    const files = getSourceFiles(source);
    const ips = new lunar.IPSPatch();

    Recuerdo.log("Loaded the following source files:", files);
    const symbols = files.symbols.map(({ entry }) => {
        Recuerdo.log(`Loading symbol file: ${entry.path.normal}`);
        return new wisdom.Sym(entry.path.normal);
    });
    const hooks = files.hooks.map(({ entry }) => {
        Recuerdo.log(`Loading hooks file: ${entry.path.normal}`);
        const hookFile = new wisdom.Hks(entry.path.normal);
        for (const hook of hookFile.hooks) {
            Recuerdo.log(`Loaded hook named: ${hook.name}`, hook);
        }
        return hookFile.hooks;
    }).flat();
    Recuerdo.log("Finished loading source files");

    return utils.withTempDir((temp) => {
        const trampolinesSourceCode = new archivo.Archivo(
            way.join(temp, "./trampolines.s"),
        );
        const backupCWD = way.cwd();
        const linkers = ["-T", assets.linker, "-T", assets.sdk] as string[];
        const outelf = way.join(temp, "./subsdk0.elf");
        const outnso = way.join(temp, "./subsdk0");

        let trampolineCount = 0;
        let linkerCount = 0;

        trampolinesSourceCode.appendText("\n");
        Recuerdo.log("Processing hooks...");
        for (const hook of hooks) {
            Recuerdo.info(
                `Processing hook "${hook.name}"  (type: ${hook.type}, address: ${
                    utils.hexify(hook.address)
                })`,
            );

            switch (hook.type) {
                case "call":
                    continue;
                case "instr":
                    Recuerdo.log("Compiling instruction for hook...");
                    ips.addPatch({
                        address: hook.address + c.NSO_HEADER_SIZE,
                        data: brazo.assembleInstruction(hook.instruction),
                    });
                    Recuerdo.log(`Successfully compiled ${hook.instruction}`);
                    Recuerdo.log("Added patch to IPS for hook");
                    continue;

                case "data":
                    ips.addPatch({
                        address: hook.address + c.NSO_HEADER_SIZE,
                        data: hook.data,
                    });
                    Recuerdo.log("Added patch to IPS for hook");
                    continue;
            }

            if (!hook.trampoline) continue;

            Recuerdo.log(`Generating source code for trampoline...`);
            trampolinesSourceCode.appendText(
                generateTrampolineSourceCode(hook, nsmbudx),
            );
            trampolineCount++;
            Recuerdo.log(`Successfully generated source code for trampoline!`);
        }
        trampolinesSourceCode.close();
        Recuerdo.log(
            `Wrote all trampolines' (${trampolineCount}) source code to "${trampolinesSourceCode.path}"`,
        );

        for (const symbol of symbols) {
            const path = way.join(temp, `symbol-map-${linkerCount++}.ld`);

            Recuerdo.log(
                `Generating .ld file for "${symbol.path}" at "${path}"`,
            );

            symbol.toLinker(path, c.NSMBUDX_NSO_MEMORY_SIZE);
            linkers.push("-T", path);

            Recuerdo.log("Successfully generated .ld file!");
        }

        Recuerdo.log(
            "Starting C++ compilation process... Switching to temporary directory...",
        );
        Deno.chdir(temp);

        const clangCppOutput = principe.exec`clang++
            --no-default-config
            --target=armv7l-none-eabihf
            -mcpu=cortex-a57
            -mfpu=crypto-neon-fp-armv8
            -mfloat-abi=hard
            -mabi=aapcs-linux
            -fPIC
            -nostdlib
            -fno-rtti
            -fno-exceptions
            -fpermissive
            -c

            ${assets.crt0}
            ${trampolinesSourceCode.path}
            ${files.code.map((file) => file.entry.path.normal)}
        `;
        Recuerdo.log(utils.decode(clangCppOutput.stdout).trim());
        Recuerdo.error(utils.decode(clangCppOutput.stderr).trim());

        const objects = archivo.listFiles(temp).filter((file) =>
            file.entry.extension === ".o"
        ).map((file) => file.entry.path.normal);

        Recuerdo.log("Compilation process finished");

        if (!objects.length) {
            Deno.chdir(backupCWD);
            Recuerdo.error(
                "Compilation failed! Compiler didn't produce any shared objects!",
            );
            return 1;
        }

        Recuerdo.log("Started linking process...");
        const linkOutput = principe.exec`arm-none-eabi-ld
            -pie
            ${linkers}
            --unresolved-symbols=ignore-all
            ${objects}
            -o
            ${outelf}
        `;
        Recuerdo.log(utils.decode(linkOutput.stdout).trim());
        Recuerdo.error(utils.decode(linkOutput.stderr).trim());
        Recuerdo.log(
            "Linking process finished. Switching back to original current working directory",
        );
        Deno.chdir(backupCWD);

        if (linkOutput.error || linkOutput.status) {
            Recuerdo.error("Linking process failed!");
            return 1;
        }

        Recuerdo.log(`Linked elf saved to "${outelf}"`);

        const elf = new elfo.Elf(outelf);
        const dynsym = elf.findSection(".dynsym");
        const dynstr = elf.findSection(".dynstr");
        const bss = elf.findSection(".bss");

        if (!dynstr || !dynsym || !bss) {
            Recuerdo.error(
                "ELF is missing either one ore more of the following sections: .dynsym, .dynstr and/or .bss",
            );
            return 1;
        }

        if (elf.loadableSegments.length !== 3) {
            Recuerdo.error(
                `Need exactly 3 loadable segments inside the ELF, found ${elf.loadableSegments.length} instead!`,
            );
            return 1;
        }

        const nso = new filetendo.NSO(outnso);
        const text = elf.loadableSegments[0];
        const ro = elf.loadableSegments[1];
        const data = elf.loadableSegments[2];

        nso.setProperty("textMemoryOffset", Number(text.vaddr));
        nso.setProperty("roMemoryOffset", Number(ro.vaddr));
        nso.setProperty("dataMemoryOffset", Number(data.vaddr));

        nso.setProperty("dynstrOffset", Number(dynstr.offset - ro.offset));
        nso.setProperty("dynstrSize", Number(dynstr.size));
        nso.setProperty("dynsymOffset", Number(dynsym.offset - ro.offset));
        nso.setProperty("dynsymSize", Number(dynsym.size));
        nso.setProperty("bssSize", Number(data.memsz - data.filesz));

        nso.setProperty("embeddedOffset", 0);
        nso.setProperty("embeddedSize", 0);

        const trampolines: { offset: number; chunk: Uint8Array }[] = [];
        for (const hook of hooks) {
            if (hook.type !== "call" && hook.type !== "hook") continue;

            const hookSymbol = elf.findSymbol(hook.symbol.symbol);
            const trampoline = hook.type === "hook" ? hook.trampoline : null;
            const teSymbol = trampoline
                ? elf.findSymbol(trampoline.symbol)
                : null;

            if (!hookSymbol) {
                Recuerdo.error(
                    `Could not find symbol "${hook.symbol.symbol}" (${hook.symbol.source}) inside ELF!`,
                );
                return 1;
            }

            if (trampoline && !teSymbol) {
                Recuerdo.error(
                    `Could not find symbol "${trampoline.symbol}" (${trampoline.source}) inside ELF!`,
                );
                return 1;
            }

            Recuerdo.info(
                `Resolved hook symbol "${hook.symbol.symbol}" (${hook.symbol.source})`,
            );
            if (trampoline) {
                Recuerdo.info(
                    `Resolved trampoline symbol "${trampoline.symbol}" (${trampoline.source})`,
                );
            }

            const origin = hook.address;
            const destiny = c.NSMBUDX_NSO_MEMORY_SIZE +
                Number(hookSymbol.value);
            const link = hook.type === "call";

            ips.addPatch({
                address: hook.address + c.NSO_HEADER_SIZE,
                data: brazo.assembleBranchInstruction(origin, destiny, link),
            });
            Recuerdo.log(
                `Added patch for hook "${hook.name}" (Link?: ${link}). Source: ${
                    utils.hexify(origin)
                }, Destiny: ${utils.hexify(destiny)}`,
            );

            if (!trampoline) continue;

            const offset = Number(teSymbol!.value + text.offset + 4n);
            const teOrigin = c.NSMBUDX_NSO_MEMORY_SIZE +
                Number(teSymbol!.value + 4n);
            const teDestiny = hook.address + 4;
            const chunk = brazo.assembleBranchInstruction(teOrigin, teDestiny);

            Recuerdo.log(
                `Trampoline "${trampoline.source}" branch-back will be written at .text file offset ${
                    utils.hexify(offset)
                }, returning from ${utils.hexify(teOrigin)} to ${
                    utils.hexify(teDestiny)
                }`,
            );
            trampolines.push({ offset, chunk });
        }
        Recuerdo.log(`Resolved ${trampolines.length} trampoline patch(es)`);

        nso.writeSection(
            ".text",
            utils.interceptReadStream(text.read(4), ([chunk, offset]) => {
                const trampoline = trampolines.find((trampoline) =>
                    trampoline.offset === offset
                );

                if (!trampoline) return [chunk, offset];

                Recuerdo.log(
                    `Intercepted .text chunk at offset ${
                        utils.hexify(offset)
                    } and replaced it with the trampoline branch-back instruction`,
                );
                return [trampoline.chunk, trampoline.offset];
            }),
        );

        nso.writeSection(".ro", ro.read());
        nso.writeSection(".data", data.read());
        nso.digest();

        Deno.copyFileSync(outnso, way.join(output, c.NSMBUDX_SUBSDK0_PATH));
        ips.saveAndClose(way.join(output, c.NSMBUDX_IPS_PATH));

        return 0;
    });
}
