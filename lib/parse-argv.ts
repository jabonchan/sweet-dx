export const BooleanFlags = {
    help: "--help",
    verbose: "--verbose",
    version: "--version",
} as const;

export const ValueFlags = {
    init: "--init",
    source: "--source",
    output: "--output",
    logFile: "--log-file",
} as const;

export type BooleanFlag = keyof typeof BooleanFlags;
export type ValueFlag = keyof typeof ValueFlags;
export type Flag = BooleanFlag | ValueFlag;
export type ArgvContext =
    & Record<BooleanFlag, boolean>
    & Record<ValueFlag, string>;

export const IncompatibleFlags: {
    flag: Flag;
    conflicts: Flag[];
    message: string;
}[] = [
    {
        flag: "help",
        conflicts: [
            "init",
            "logFile",
            "output",
            "source",
            "verbose",
            "version",
        ],
        message:
            "Error: --help flag isn't compatible with flags --init, --log-file, --output, --source, --verbose or --version. Run sweetdx --help for usage",
    },
    {
        flag: "init",
        conflicts: ["logFile", "output", "source", "verbose", "version"],
        message:
            "Error: --init flag isn't compatible with flags --help, --log-file, --output, --source, --verbose or --version. Run sweetdx --help for usage",
    },
    {
        flag: "version",
        conflicts: ["logFile", "output", "source", "verbose"],
        message:
            "Error: --version flag isn't compatible with flags --help, --init, --log-file, --output, --source or --verbose. Run sweetdx --help for usage",
    },
];

export function findFlag<K extends string>(
    flags: Record<K, string>,
    matches: (flag: string) => boolean,
): K | undefined {
    return (Object.keys(flags) as K[]).find((key) => matches(flags[key]));
}

export function duplicateFlag(flag: string): void {
    console.error(`Error: "${flag}" was provided multiple times`);
}

export function parseArgv(argv: string[]): ArgvContext | void {
    const context: ArgvContext = {
        help: false,
        verbose: false,
        version: false,
        init: "",
        source: "",
        output: "",
        logFile: "",
    };

    for (const arg of argv) {
        const booleanFlag = findFlag(BooleanFlags, (flag) => arg === flag);

        if (booleanFlag) {
            if (context[booleanFlag]) {
                return duplicateFlag(BooleanFlags[booleanFlag]);
            }
            context[booleanFlag] = true;
            continue;
        }

        const valueFlag = findFlag(
            ValueFlags,
            (flag) => arg.startsWith(`${flag}`),
        );

        if (valueFlag) {
            if (context[valueFlag]) return duplicateFlag(ValueFlags[valueFlag]);
            if (!arg.startsWith(`${ValueFlags[valueFlag]}=`)) {
                console.error(
                    `Error: No value passed to ${ValueFlags[valueFlag]}`,
                );
                return;
            }

            context[valueFlag] = arg.slice(ValueFlags[valueFlag].length + 1);
            if (!context[valueFlag]) {
                console.error(
                    `Error: No value passed to ${ValueFlags[valueFlag]}`,
                );
                return;
            }
            continue;
        }

        console.error(`Error: Unknown flag "${arg}"`);
        return;
    }

    return context;
}
