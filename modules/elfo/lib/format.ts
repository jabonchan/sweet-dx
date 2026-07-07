import type { Elf } from "./elf.ts";

import { deeplevel } from "../deps.ts";

import * as defs from "./definitions.ts";
import * as helpers from "./helpers.ts";

export function format(elf: Elf): string {
    const addrWidth = elf.bits === 32 ? 8 : 16;
    const log = (str: string = ""): string => debugInfo += "\n" + str;
    let debugInfo = "";

    // -- Header ------------------------------------------------------------

    log("");
    log("=".repeat(150));
    log(
        `  ELF Header  [ELF${elf.bits} ${elf.endianness === deeplevel.types.Endianness.Little ? "little" : "big"}-endian]`,
    );
    log("=".repeat(150));
    log(`  Type:      ${defs.ET[elf.type] ?? helpers.hex(elf.type, 4)}`);
    log(`  Machine:   ${defs.EM[elf.machine] ?? helpers.hex(elf.machine, 4)}`);
    log(`  Version:   ${elf.version}`);
    log(`  Entry:     ${helpers.hex(elf.entry, addrWidth)}`);
    log(`  Flags:     ${helpers.hex(elf.flags, 8)}`);
    log(`  SH strtab: section[${elf.sectionHeaderStringTableIndex}]`);
    log("");

    // -- Segments (Program Headers) -----------------------------------------

    log("=".repeat(150));
    log(`  Segments (Program Headers) - ${elf.segments.length} entries`);
    log("=".repeat(150));
    log(
        "  #".padEnd(5) +
            "Type".padEnd(14) +
            "Offset".padEnd(addrWidth + 4) +
            "VirtAddr".padEnd(addrWidth + 4) +
            "PhysAddr".padEnd(addrWidth + 4) +
            "FileSiz".padEnd(12) +
            "MemSiz".padEnd(12) +
            "Flg".padEnd(6) +
            "Align",
    );
    log("  " + "-".repeat(148));

    for (const seg of elf.segments) {
        const type = defs.PT[seg.type] ?? helpers.hex(seg.type, 8);
        const offset = helpers.hex(seg.offset, addrWidth);
        const vaddr = helpers.hex(seg.vaddr, addrWidth);
        const paddr = helpers.hex(seg.paddr, addrWidth);
        const filesz = seg.filesz.toString().padStart(8);
        const memsz = seg.memsz.toString().padStart(8);
        const flags = helpers.segmentFlagLetters(seg.flags);
        const align = helpers.hex(seg.align, 4);

        log(
            `  ${seg.index.toString().padEnd(3)}` +
                `${type.padEnd(14)}` +
                `${offset.padEnd(addrWidth + 4)}` +
                `${vaddr.padEnd(addrWidth + 4)}` +
                `${paddr.padEnd(addrWidth + 4)}` +
                `${filesz.padEnd(12)}` +
                `${memsz.padEnd(12)}` +
                `${flags.padEnd(6)}` +
                `${align}`,
        );
    }
    log();

    // -- Sections ------------------------------------------------------------

    log("=".repeat(150));
    log("  Section Headers");
    log("=".repeat(150));
    log(
        "  #".padEnd(7) +
            "Type".padEnd(20) +
            "Offset".padEnd(12 + addrWidth - 8) +
            "Size".padEnd(12) +
            "Flags".padEnd(7) +
            "Name",
    );
    log("  " + "-".repeat(148));

    for (const s of elf.sections) {
        const type = defs.SHT[s.type] ?? helpers.hex(s.type, 8);
        const offset = helpers.hex(s.offset, addrWidth);
        const size = s.size.toString().padStart(8);
        const flags = helpers.sectionFlagLetters(s.flags);

        log(
            `  ${s.index.toString().padEnd(5)}${type.padEnd(20)}` +
                `${offset.padEnd(12 + addrWidth - 8)}${size.padEnd(12)}${flags.padEnd(7)}${s.name}`,
        );
    }
    log();

    // -- Symbols ---------------------------------------------------------------

    log("=".repeat(150));
    log(`  Symbol Table - ${elf.symbols.length} entries`);
    log("=".repeat(150));
    log(
        "  #".padEnd(8) + "Bind".padEnd(10) + "Ndx".padEnd(10) +
            "Type".padEnd(10) +
            "Vis".padEnd(12) + "Value".padEnd(addrWidth + 4) +
            "Size".padEnd(10) + "Name".padEnd(30) + "Target",
    );
    log("  " + "-".repeat(148));

    for (const sym of elf.symbols) {
        const bind = defs.STB[sym.binding] ?? `${sym.binding}`;
        const stype = defs.STT[sym.type] ?? `${sym.type}`;
        const vis = defs.STV[sym.visibility] ?? `${sym.visibility}`;
        const value = helpers.hex(sym.value, addrWidth);
        const size = sym.size.toString().padStart(6);

        let ndx: string;
        let target: string;

        switch (sym.sectionIndex) {
            case defs.SHN.UNDEF:
                ndx = "UND";
                target = "";
                break;

            case defs.SHN.ABS:
                ndx = "ABS";
                target = "";
                break;

            case defs.SHN.COMMON:
                ndx = "COM";
                target = "";
                break;

            default:
                ndx = sym.sectionIndex.toString();
                target = elf.sections[sym.sectionIndex]?.name ?? "?";
                break;
        }

        log(
            `  ${sym.index.toString().padEnd(6)}` +
                `${bind.padEnd(10)}` +
                `${ndx.padEnd(10)}` +
                `${stype.padEnd(10)}` +
                `${vis.padEnd(12)}` +
                `${value.padEnd(addrWidth + 4)}` +
                `${size.padEnd(10)}` +
                `${sym.name.padEnd(30)}` +
                `${target}`,
        );
    }
    log();

    // -- Relocations -------------------------------------------------------

    log(printRelocationSections(elf, "RELA", elf.relaSections, addrWidth));
    log(printRelocationSections(elf, "REL", elf.relSections, addrWidth));

    return debugInfo;
}

function printRelocationSections(
    elf: Elf,
    label: "RELA" | "REL",
    sections: Elf["relaSections"] | Elf["relSections"],
    addrWidth: number,
): string {
    const log = (str: string = ""): string => debugInfo += "\n" + str;
    let debugInfo = "";

    if (!sections.length) {
        log("=".repeat(150));
        log(`  No ${label} sections`);
        log("=".repeat(150));
        log("");
        return debugInfo;
    }

    for (const sec of sections) {
        log("=".repeat(150));
        log(`  ${sec.name} (${label}) - ${sec.entries.length} relocations:`);
        log("");
        log(
            `    Target : ${sec.section.info.toString().padEnd(5)} (${elf.sections[sec.section.info]?.name ?? "UND"})`,
        );
        log(
            `    Symbols: ${sec.section.link.toString().padEnd(5)} (${elf.sections[sec.section.link]?.name ?? "UND"})`,
        );
        log("=".repeat(150));
        log(
            "  Offset".padEnd(addrWidth + 6) + "RType".padEnd(8) + "Sym".padEnd(6) +
                (label === "RELA" ? "Addend".padEnd(14) : "") + "Symbol",
        );
        log("  " + "-".repeat(148));

        for (const e of sec.entries) {
            const addend = e.addend !== null ? `${e.addend.toString().padEnd(14)}` : "";

            log(
                `  ${helpers.hex(e.offset, addrWidth).padEnd(addrWidth + 4)}` +
                    `${e.type.toString().padEnd(8)}${e.symbolIndex.toString().padEnd(6)}` +
                    `${addend}${e.symbolName}`,
            );
        }
    }
    log();
    return debugInfo;
}
