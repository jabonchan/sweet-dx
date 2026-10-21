// The logger the static methods forward to. Defaults to the console (see bottom of file).
let GLOBAL_RECUERDO: Recuerdo;

const USE_COLORS = Deno.env.get("NO_COLOR") === undefined
    ? Deno.stdout.isTerminal() && Deno.stderr.isTerminal()
    : false;
const isConsole = (val: unknown): val is Console => val === console;
const RECUERDO_FORMAT_OPTS = {
    depth: Infinity,
    compact: true,
    breakLength: 80,
    escapeSequences: true,
    getters: false,
    sorted: false,
    iterableLimit: 100,
    showHidden: false,
    showProxy: false,
    strAbbreviateSize: 100_000,
    trailingComma: false,
};

/**
 * Logger that writes prefixed, timestamped lines either to the console or to a
 * file (optionally mirrored to the console). The static methods log through the
 * global instance set with `registerAsGlobal()`.
 */
export class Recuerdo {
    #backend: Console | string;
    #mirror: boolean;

    /**
     * `backend` is either `console` or a file path. If the file can't be
     * written, it falls back to the console.
     */
    constructor(backend: Console | string, mirror: boolean = false) {
        this.#mirror = mirror;
        this.#backend = backend;

        if (typeof backend === "string") {
            try {
                // Appending zero bytes checks the file is writable without touching it.
                Deno.writeFileSync(backend, new Uint8Array(0), {
                    append: true,
                });
                return;
            } catch (e) {
                this.#triggerFallbackOnError(e);
            }
        }
    }

    /** Returns the current global logger. */
    static getGlobalRecuerdo() {
        return GLOBAL_RECUERDO;
    }

    /** Static shortcuts for the same methods on the global logger. */
    static error(...values: unknown[]) {
        GLOBAL_RECUERDO.error(...values);
    }

    static warn(...values: unknown[]) {
        GLOBAL_RECUERDO.warn(...values);
    }

    static info(...values: unknown[]) {
        GLOBAL_RECUERDO.info(...values);
    }

    static log(...values: unknown[]) {
        GLOBAL_RECUERDO.log(...values);
    }

    /** Reports why the file backend failed and switches to the console. */
    #triggerFallbackOnError(err: unknown) {
        console.error("");
        console.error(
            this.#getColorForPrefix(USE_COLORS, "error") +
                " - [RECUERDO]: falling back to Console backend. Failed to access specified file. Reason: " +
                (err as Error).message +
                this.#getColorForPrefix(USE_COLORS, "reset"),
        );
        console.error("");

        this.#backend = console;
    }

    /** Returns the ANSI color code for a prefix part, or nothing when colors are off. */
    #getColorForPrefix(
        useColors: boolean,
        type: "error" | "warn" | "info" | "log" | "reset" | "date",
    ) {
        if (!useColors) return "";

        switch (type) {
            case "error":
                return "\x1b[91m";

            case "warn":
                return "\x1b[33m";

            case "info":
                return "\x1b[94m";

            case "date":
                return "\x1b[95m";

            case "log":
                return "\x1b[32m";

            case "reset":
                return "\x1b[0m";
        }
    }

    /**
     * Turns the values into text with a `[TYPE, DATE]: ` prefix on every line.
     * Multi-line output is padded with blank lines so it stands out.
     */
    #format(
        type: "error" | "warn" | "info" | "log",
        target: "tty" | "file",
        values: unknown[],
    ) {
        const useColors = !!(target === "tty" && USE_COLORS);
        const textValues = values.map((value) =>
            typeof value === "string" ? value : Deno.inspect(value, {
                colors: useColors,
                ...RECUERDO_FORMAT_OPTS,
            })
        ).join(" ");
        const prefix = `[${
            this.#getColorForPrefix(useColors, type)
        }${type.toUpperCase()}${this.#getColorForPrefix(useColors, "reset")}, ${
            this.#getColorForPrefix(useColors, "date")
        }${new Date().toISOString()}${
            this.#getColorForPrefix(useColors, "reset")
        }]: `;
        const lines = textValues.split("\n").map((line) => prefix + line);
        const text = lines.join("\n");

        if (lines.length === 1) return `${text === prefix ? "" : text}\n`;
        return `\n${text}\n\n`;
    }

    /** Writes a message to the backend (and to the console when mirroring). */
    #write(type: "error" | "warn" | "info" | "log", values: unknown[]) {
        if (!isConsole(this.#backend)) {
            try {
                Deno.writeTextFileSync(
                    this.#backend,
                    this.#format(type, "file", values),
                    { append: true },
                );
                if (!this.#mirror) return;
            } catch (e) {
                this.#triggerFallbackOnError(e);
            }
        }

        // Drops the trailing newline, `console` adds its own.
        const text = this.#format(type, "tty", values).slice(0, -1);

        switch (type) {
            case "error":
            case "warn":
                console.error(text);
                break;

            default:
                console.log(text);
                break;
        }
    }

    /** Makes this instance the one the static methods log through. */
    registerAsGlobal(): this {
        return GLOBAL_RECUERDO = this;
    }

    /** Log on each channel. Non-string values are pretty-printed with `Deno.inspect`. */
    error(...values: unknown[]) {
        this.#write("error", values);
    }

    warn(...values: unknown[]) {
        this.#write("warn", values);
    }

    info(...values: unknown[]) {
        this.#write("info", values);
    }

    log(...values: unknown[]) {
        this.#write("log", values);
    }
}

GLOBAL_RECUERDO = new Recuerdo(console);
