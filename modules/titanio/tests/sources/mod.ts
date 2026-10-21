import { BUILTINS } from "./builtins.ts";
import { MEMBERS } from "./members.ts";
import { NAMES } from "./names.ts";
import { SPECIAL } from "./special.ts";
import { TEMPLATES } from "./templates.ts";
import { TYPEDEFS } from "./typedefs.ts";
import type { TestSource } from "./types.ts";

export type { TestSource } from "./types.ts";

export const SOURCES: readonly TestSource[] = [
    BUILTINS,
    NAMES,
    MEMBERS,
    SPECIAL,
    TEMPLATES,
    TYPEDEFS,
];
