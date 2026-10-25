import { archivo, titanio, utils } from "../deps.ts";

/** hook branches to symbol, call puts a BL to it, instr assembles one instruction, data writes raw bytes */
export type HookType = "hook" | "call" | "instr" | "data";

/** How a symbol was written in the .hks: a C++ signature, an already-mangled name or a plain C name */
export type SymbolType = "c" | "c++" | "mangled";

export type HookSymbol = {
    /** Mangled names in order, constructors and destructors have one per variant */
    readonly symbol: string[];
    readonly type: SymbolType;
    readonly source: string;
};

/** A single parsed hook, with the fields its `type` needs */
export type HookDefinition =
    | {
        readonly name: string;
        readonly type: "hook";
        readonly address: number;
        readonly symbol: HookSymbol;
        readonly trampoline?: HookSymbol;
    }
    | { readonly name: string; readonly type: "call"; readonly address: number; readonly symbol: HookSymbol }
    | { readonly name: string; readonly type: "instr"; readonly address: number; readonly instruction: string }
    | { readonly name: string; readonly type: "data"; readonly address: number; readonly data: Uint8Array };

type RawField = { readonly value: string; readonly line: number };

const HOOK_HEADER_PATTERN = /^(\S+):$/;
const FIELD_PATTERN = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/;

/** Which fields each hook type accepts */
const FIELDS_BY_TYPE: Record<HookType, { readonly required: readonly string[]; readonly optional: readonly string[] }> = {
    hook: { required: [ "type", "address", "symbol" ], optional: [ "trampoline" ] },
    call: { required: [ "type", "address", "symbol" ], optional: [] },
    instr: { required: [ "type", "address", "instruction" ], optional: [] },
    data: { required: [ "type", "address", "data" ], optional: [] },
};

/** Removes @ comments, they start a line or come after whitespace */
function stripComment(line: string): string {
    return line.replace(/(^|\s)@.*$/, "$1").trimEnd();
}

/** A parsed .hks file: name: headers, indented key: value fields and @ comments */
export class Hks {
    readonly file: archivo.Archivo;
    readonly hooks: readonly HookDefinition[];

    constructor(public readonly path: string) {
        // Read-only (works on read-only files) and always closed, even when parsing throws
        this.file = new archivo.Archivo(path, { readOnly: true });

        try {
            this.hooks = this.parse(this.file.readAsText());
        } finally {
            this.file.close();
        }
    }

    /** Returns the hook named `name`, if any */
    findHook(name: string): HookDefinition | undefined {
        return this.hooks.find((hook) => hook.name === name);
    }

    /** Groups the lines into hooks and their fields, then builds each hook */
    private parse(text: string): HookDefinition[] {
        const lines = text.split(/\r\n|\r|\n/);
        const hooks: HookDefinition[] = [];

        let name: string | null = null;
        let nameLine = 0;
        let fields = new Map<string, RawField>();

        // Builds the hook collected so far, called whenever a new header (or EOF) is reached
        const finalize = () => {
            if (name !== null)
                hooks.push(this.buildHook(name, nameLine, fields));
        };

        for (let i = 0; i < lines.length; i++) {
            const line = stripComment(lines[i]);

            if (line.trim().length === 0)
                continue;

            if (!/^\s/.test(line)) {
                finalize();

                const header = line.trim().match(HOOK_HEADER_PATTERN);

                if (!header)
                    throw new Error(`Invalid hook header at line ${i + 1} in "${this.path}": "${line}".`);

                if (hooks.some((hook) => hook.name === header[1]))
                    throw new Error(`Duplicate hook "${header[1]}" at line ${i + 1} in "${this.path}".`);

                name = header[1];
                nameLine = i + 1;
                fields = new Map();

                continue;
            }

            if (name === null)
                throw new Error(`Field defined before any hook header at line ${i + 1} in "${this.path}": "${line}".`);

            const field = line.match(FIELD_PATTERN);

            if (!field)
                throw new Error(`Invalid field at line ${i + 1} in "${this.path}": "${line}".`);

            const [, key, value] = field;

            if (fields.has(key))
                throw new Error(`Duplicate field "${key}" for hook "${name}" at line ${i + 1} in "${this.path}".`);

            fields.set(key, { value: value.trim(), line: i + 1 });
        }

        finalize();

        return hooks;
    }

    /** Validates a hook's fields against its type and turns them into a `HookDefinition` */
    private buildHook(name: string, nameLine: number, fields: Map<string, RawField>): HookDefinition {
        const type = fields.get("type")?.value;

        // Not "in": type comes from the .hks file, and "constructor" or "toString" are in every object through its prototype
        if (!type || !Object.hasOwn(FIELDS_BY_TYPE, type)) {
            throw new Error(
                `Hook "${name}" at line ${nameLine} in "${this.path}" has a missing or invalid "type" (expected "hook", "call", "instr" or "data").`,
            );
        }

        const spec = FIELDS_BY_TYPE[type as HookType];

        for (const required of spec.required) {
            if (!fields.has(required))
                throw new Error(`Hook "${name}" at line ${nameLine} in "${this.path}" is missing required field "${required}".`);
        }

        for (const key of fields.keys()) {
            if (!spec.required.includes(key) && !spec.optional.includes(key))
                throw new Error(`Hook "${name}" at line ${nameLine} in "${this.path}" has an unknown field "${key}" for type "${type}".`);
        }

        const addressField = fields.get("address")!;
        let address: number;

        try {
            address = utils.dehexify(addressField.value);
        } catch {
            throw new Error(
                `Hook "${name}" at line ${addressField.line} in "${this.path}" has an invalid address "${addressField.value}" (expected hexadecimal such as 0x00123456; comments start with "@").`,
            );
        }

        if (address < 0) {
            throw new Error(
                `Hook "${name}" at line ${addressField.line} in "${this.path}" has an invalid address "${addressField.value}" (expected positive address).`,
            );
        }

        if ((type === "hook" || type === "call" || type === "instr") && address % 4)
            throw new Error(`Hook "${name}" at line ${addressField.line} in "${this.path}" specifies an address that is not aligned to 4`);

        switch (type as HookType) {
            case "hook": {
                const trampoline = fields.get("trampoline")?.value;

                return {
                    name,
                    type: "hook",
                    address,
                    symbol: this.resolveField(name, fields.get("symbol")!),
                    ...(trampoline !== undefined ? { trampoline: this.resolveField(name, fields.get("trampoline")!) } : {}),
                };
            }

            case "call":
                return { name, type: "call", address, symbol: this.resolveField(name, fields.get("symbol")!) };

            case "instr":
                return { name, type: "instr", address, instruction: fields.get("instruction")!.value };

            case "data": {
                const data = fields.get("data")!;

                return { name, type: "data", address, data: this.parseDataBytes(data.value, data.line) };
            }
        }
    }

    /** resolveSymbol with the hook name and line attached, so a mangling failure says WHICH hook */
    private resolveField(hookName: string, field: RawField): HookSymbol {
        try {
            return this.resolveSymbol(field.value);
        } catch (error) {
            throw new Error(
                `Hook "${hookName}" at line ${field.line} in "${this.path}" has a symbol that could not be resolved (Invalid Syntax) ("${field.value}"):\n${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }

    /** Mangled goes first since _ZN3FooC1Ev is also a valid C name */
    private resolveSymbol(value: string): HookSymbol {
        if (titanio.isMangledCppSignature(value))
            return { symbol: [ value ], type: "mangled", source: value };

        if (titanio.isCFunctionName(value))
            return { symbol: [ value ], type: "c", source: value };

        if (titanio.isCppFunctionSignature(value))
            return { symbol: titanio.mangle(value), type: "c++", source: value };

        throw new Error(`"${value}" is not a C function name, a mangled C++ symbol or a C++ function signature.`);
    }

    /** Hex tokens joined together, "DEAD BEEF" and "0xDE 0xAD 0xBE 0xEF" are the same */
    private parseDataBytes(value: string, line: number): Uint8Array {
        const combined = value.split(/\s+/).filter((token) => token.length > 0).map((token) => token.replace(/^0x/i, "")).join("");

        if (combined.length === 0 || !/^[0-9a-fA-F]*$/.test(combined))
            throw new Error(`Invalid data bytes at line ${line} in "${this.path}": "${value}".`);

        if (combined.length % 2 !== 0) {
            throw new Error(
                `Data bytes at line ${line} in "${this.path}" must combine into a whole number of bytes (even hex digit count): "${value}".`,
            );
        }

        const bytes = new Uint8Array(combined.length / 2);

        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(combined.slice(i * 2, i * 2 + 2), 16);
        }

        return bytes;
    }
}
