import { type filetendo, utils, type wisdom } from "../deps.ts";

/** Trampoline: the instruction the hook overwrites, then a placeholder for the branch back */
export function generateTrampolineSourceCode(hook: wisdom.HookDefinition, nsmbudx: filetendo.ParsedNSO): string {
    if (hook.type !== "hook" || !hook.trampoline)
        throw new Error("Can't generate a trampoline of a hook that doesn't contains one!");

    // Read the 4 bytes of the instruction that the hook overwrites
    const originalInstruction = nsmbudx.getSegment(".text").readAt(hook.address, 4);
    // Turn the little-endian bytes into a 32-bit word (>>> 0 keeps it unsigned)
    const originalWord =
        (originalInstruction[0] | (originalInstruction[1] << 8) | (originalInstruction[2] << 16) | (originalInstruction[3] << 24)) >>> 0;

    // Only the first name is defined, for constructors/destructors that's C1/D1 which is what clang calls
    const name = hook.trampoline.symbol[0];

    return `.arm

.global ${name}
.type ${name}, %function
${name}:
    .inst ${utils.hexify(originalWord)}
    .inst 0x00000000
.size ${name}, . - ${name}
`;
}
