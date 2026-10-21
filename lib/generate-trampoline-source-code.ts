import { type filetendo, utils, type wisdom } from "../deps.ts";

export function generateTrampolineSourceCode(
    hook: wisdom.HookDefinition,
    nsmbudx: filetendo.ParsedNSO,
): string {
    if (hook.type !== "hook" || !hook.trampoline) {
        throw new Error(
            "Can't generate a trampoline of a hook that doesn't contains one!",
        );
    }

    const originalInstruction = nsmbudx.getSegment(".text").readAt(
        hook.address,
        4,
    );
    const originalWord =
        (originalInstruction[0] | (originalInstruction[1] << 8) |
            (originalInstruction[2] << 16) | (originalInstruction[3] << 24)) >>>
        0;

    return `.arm

.global ${hook.trampoline}
.type ${hook.trampoline}, %function
${hook.trampoline}:
    .inst ${utils.hexify(originalWord)}
    .inst 0x00000000
.size ${hook.trampoline}, . - ${hook.trampoline}
`;
}
