import { deeplevel, Recuerdo } from "../deps.ts";
import type { Elf } from "./elf.ts";

import * as defs from "./definitions.ts";
import * as helpers from "./helpers.ts";

/** Logs a readelf-style dump: header, segments, sections, symbols and relocations. */
export function printElfDump(elf: Elf) {
    const addrWidth = elf.bits === 32 ? 8 : 16;

    // -- Header ------------------------------------------------------------

    Recuerdo.log("");
    Recuerdo.log("=".repeat(150));
    Recuerdo.log(
        `  ELF Header  [ELF${elf.bits} ${
            elf.endianness === deeplevel.types.Endianness.Little
                ? "little"
                : "big"
        }-endian]`,
    );
    Recuerdo.log("=".repeat(150));
    Recuerdo.log(
        `  Type:      ${defs.ET[elf.type] ?? helpers.hex(elf.type, 4)}`,
    );
    Recuerdo.log(
        `  Machine:   ${defs.EM[elf.machine] ?? helpers.hex(elf.machine, 4)}`,
    );
    Recuerdo.log(`  Version:   ${elf.version}`);
    Recuerdo.log(`  Entry:     ${helpers.hex(elf.entry, addrWidth)}`);
    Recuerdo.log(`  Flags:     ${helpers.hex(elf.flags, 8)}`);
    Recuerdo.log(`  SH strtab: section[${elf.sectionHeaderStringTableIndex}]`);
    Recuerdo.log("");

    // -- Segments (Program Headers) -----------------------------------------

    Recuerdo.log("=".repeat(150));
    Recuerdo.log(
        `  Segments (Program Headers) - ${elf.segments.length} entries`,
    );
    Recuerdo.log("=".repeat(150));
    Recuerdo.log(
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
    Recuerdo.log("  " + "-".repeat(148));

    for (const seg of elf.segments) {
        const type = defs.PT[seg.type] ?? helpers.hex(seg.type, 8);
        const offset = helpers.hex(seg.offset, addrWidth);
        const vaddr = helpers.hex(seg.vaddr, addrWidth);
        const paddr = helpers.hex(seg.paddr, addrWidth);
        const filesz = seg.filesz.toString().padStart(8);
        const memsz = seg.memsz.toString().padStart(8);
        const flags = helpers.segmentFlagLetters(seg.flags);
        const align = helpers.hex(seg.align, 4);

        Recuerdo.log(
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
    Recuerdo.log("");

    // -- Sections ------------------------------------------------------------

    Recuerdo.log("=".repeat(150));
    Recuerdo.log("  Section Headers");
    Recuerdo.log("=".repeat(150));
    Recuerdo.log(
        "  #".padEnd(7) +
            "Type".padEnd(20) +
            "Offset".padEnd(12 + addrWidth - 8) +
            "Size".padEnd(12) +
            "Flags".padEnd(7) +
            "Name",
    );
    Recuerdo.log("  " + "-".repeat(148));

    for (const s of elf.sections) {
        const type = defs.SHT[s.type] ?? helpers.hex(s.type, 8);
        const offset = helpers.hex(s.offset, addrWidth);
        const size = s.size.toString().padStart(8);
        const flags = helpers.sectionFlagLetters(s.flags);

        Recuerdo.log(
            `  ${s.index.toString().padEnd(5)}${type.padEnd(20)}` +
                `${offset.padEnd(12 + addrWidth - 8)}${size.padEnd(12)}${
                    flags.padEnd(7)
                }${s.name}`,
        );
    }
    Recuerdo.log("");

    // -- Symbols ---------------------------------------------------------------

    Recuerdo.log("=".repeat(150));
    Recuerdo.log(`  Symbol Table - ${elf.symbols.length} entries`);
    Recuerdo.log("=".repeat(150));
    Recuerdo.log(
        "  #".padEnd(8) + "Bind".padEnd(10) + "Ndx".padEnd(10) +
            "Type".padEnd(10) +
            "Vis".padEnd(12) + "Value".padEnd(addrWidth + 4) +
            "Size".padEnd(10) + "Name".padEnd(30) + "Target",
    );
    Recuerdo.log("  " + "-".repeat(148));

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

        Recuerdo.log(
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
    Recuerdo.log("");

    // -- Relocations -------------------------------------------------------

    printRelocationSections(elf, "RELA", elf.relaSections, addrWidth);
    printRelocationSections(elf, "REL", elf.relSections, addrWidth);
}

/** Logs every relocation section of one kind (`RELA` or `REL`) as a table. */
function printRelocationSections(
    elf: Elf,
    label: "RELA" | "REL",
    sections: Elf["relaSections"] | Elf["relSections"],
    addrWidth: number,
): void {
    if (!sections.length) {
        Recuerdo.log("=".repeat(150));
        Recuerdo.log(`  No ${label} sections`);
        Recuerdo.log("=".repeat(150));
        Recuerdo.log("");
        return;
    }

    for (const sec of sections) {
        Recuerdo.log("=".repeat(150));
        Recuerdo.log(
            `  ${sec.name} (${label}) - ${sec.entries.length} relocations:`,
        );
        Recuerdo.log("");
        Recuerdo.log(
            `    Target : ${sec.section.info.toString().padEnd(5)} (${
                elf.sections[sec.section.info]?.name ?? "UND"
            })`,
        );
        Recuerdo.log(
            `    Symbols: ${sec.section.link.toString().padEnd(5)} (${
                elf.sections[sec.section.link]?.name ?? "UND"
            })`,
        );
        Recuerdo.log("=".repeat(150));
        Recuerdo.log(
            "  Offset".padEnd(addrWidth + 6) + "RType".padEnd(8) +
                "Sym".padEnd(6) +
                (label === "RELA" ? "Addend".padEnd(14) : "") + "Symbol",
        );
        Recuerdo.log("  " + "-".repeat(148));

        for (const e of sec.entries) {
            const addend = e.addend !== null
                ? `${e.addend.toString().padEnd(14)}`
                : "";

            Recuerdo.log(
                `  ${helpers.hex(e.offset, addrWidth).padEnd(addrWidth + 4)}` +
                    `${e.type.toString().padEnd(8)}${
                        e.symbolIndex.toString().padEnd(6)
                    }` +
                    `${addend}${e.symbolName}`,
            );
        }
    }
    Recuerdo.log("");
}
