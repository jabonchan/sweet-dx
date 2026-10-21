import { type filetendo, utils, type wisdom } from "../deps.ts";

/**
 * Generates the ARM assembly for a hook's trampoline.
 *
 * Since a hook overwrites one instruction of the game with a branch, the
 * trampoline lets the user's code still run that original instruction and
 * then return to the game. It consists of two instructions:
 *  1. The original instruction found at the hooked address.
 *  2. A placeholder (0x00000000) that the compiler later replaces with a
 *     branch back to the instruction right after the hook.
 *
 * @param hook A hook of type "hook" that defines a trampoline.
 * @param nsmbudx The game's main NSO, used to read the original instruction.
 * @returns The assembly source for the trampoline function.
 * @throws If the hook isn't of type "hook" or has no trampoline.
 */
export function generateTrampolineSourceCode(
    hook: wisdom.HookDefinition,
    nsmbudx: filetendo.ParsedNSO,
): string {
    if (hook.type !== "hook" || !hook.trampoline) {
        throw new Error(
            "Can't generate a trampoline of a hook that doesn't contains one!",
        );
    }

    // Read the 4 bytes of the instruction that the hook overwrites.
    const originalInstruction = nsmbudx.getSegment(".text").readAt(
        hook.address,
        4,
    );
    // Turn the little-endian bytes into a 32-bit word (>>> 0 keeps it unsigned).
    const originalWord =
        (originalInstruction[0] | (originalInstruction[1] << 8) |
            (originalInstruction[2] << 16) | (originalInstruction[3] << 24)) >>>
        0;

    // Global ARM function so the linker exports it and the user's code can
    // call it by name.
    return `.arm

.global ${hook.trampoline.symbol}
.type ${hook.trampoline.symbol}, %function
${hook.trampoline.symbol}:
    .inst ${utils.hexify(originalWord)}
    .inst 0x00000000
.size ${hook.trampoline.symbol}, . - ${hook.trampoline.symbol}
`;
}
