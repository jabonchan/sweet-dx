import { ensureMangled } from "../../revoltijo/mod.ts";
import { archivo, utils } from "../deps.ts";

export type HookType = "hook" | "call" | "instr" | "data";

export type HookDefinition =
    | { readonly name: string; readonly type: "hook"; readonly address: number; readonly symbol: string; readonly trampoline?: string }
    | { readonly name: string; readonly type: "call"; readonly address: number; readonly symbol: string }
    | { readonly name: string; readonly type: "instr"; readonly address: number; readonly instruction: string }
    | { readonly name: string; readonly type: "data"; readonly address: number; readonly data: Uint8Array };

type RawField = { readonly value: string; readonly line: number };

const HOOK_HEADER_PATTERN = /^(\S+):$/;
const FIELD_PATTERN = /^\s+([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/;

const NOMANGLE_DIRECTIVE = ".NOMANGLE";
const CONSTRUCTOR_DIRECTIVE = ".CONSTRUCTOR";

const FIELDS_BY_TYPE: Record<HookType, { readonly required: readonly string[]; readonly optional: readonly string[] }> = {
    hook: { required: ["type", "address", "symbol"], optional: ["trampoline"] },
    call: { required: ["type", "address", "symbol"], optional: [] },
    instr: { required: ["type", "address", "instruction"], optional: [] },
    data: { required: ["type", "address", "data"], optional: [] },
};

/** "0x1234 @ explanation" -> "0x1234". Only an @ preceded by whitespace starts a comment. */
function stripInlineComment(value: string): string {
    return value.replace(/\s@.*$/, "").trim();
}

export class Hks {
    readonly file: archivo.Archivo;
    readonly hooks: readonly HookDefinition[];

    constructor(public readonly path: string) {
        // Read-only (works on read-only files) and always closed, even when parsing throws.
        this.file = new archivo.Archivo(path, { readOnly: true });

        try {
            this.hooks = this.parse(this.file.readAsText());
        } finally {
            this.file.close();
        }
    }

    findHook(name: string): HookDefinition | undefined {
        return this.hooks.find((hook) => hook.name === name);
    }

    private parse(text: string): HookDefinition[] {
        const lines = text.split(/\r\n|\r|\n/);
        const hooks: HookDefinition[] = [];

        let name: string | null = null;
        let nameLine = 0;
        let fields = new Map<string, RawField>();

        const finalize = () => {
            if (name !== null) hooks.push(this.buildHook(name, nameLine, fields));
        };

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            if (line.trim().length === 0 || line.trim().startsWith("@")) continue;

            if (!/^\s/.test(line)) {
                finalize();

                const header = line.trim().match(HOOK_HEADER_PATTERN);

                if (!header) {
                    throw new Error(`Invalid hook header at line ${i + 1} in "${this.path}": "${line}".`);
                }

                if (hooks.some((hook) => hook.name === header[1])) {
                    throw new Error(`Duplicate hook "${header[1]}" at line ${i + 1} in "${this.path}".`);
                }

                name = header[1];
                nameLine = i + 1;
                fields = new Map();

                continue;
            }

            if (name === null) {
                throw new Error(`Field defined before any hook header at line ${i + 1} in "${this.path}": "${line}".`);
            }

            const field = line.match(FIELD_PATTERN);

            if (!field) {
                throw new Error(`Invalid field at line ${i + 1} in "${this.path}": "${line}".`);
            }

            const [, key, value] = field;

            if (fields.has(key)) {
                throw new Error(`Duplicate field "${key}" for hook "${name}" at line ${i + 1} in "${this.path}".`);
            }

            fields.set(key, { value: stripInlineComment(value), line: i + 1 });
        }

        finalize();

        return hooks;
    }

    private buildHook(name: string, nameLine: number, fields: Map<string, RawField>): HookDefinition {
        const type = fields.get("type")?.value;

        // Object.hasOwn: plain "in" also matched inherited names such as "constructor" and then crashed.
        if (!type || !Object.hasOwn(FIELDS_BY_TYPE, type)) {
            throw new Error(`Hook "${name}" at line ${nameLine} in "${this.path}" has a missing or invalid "type" (expected "hook", "call", "instr" or "data").`);
        }

        const spec = FIELDS_BY_TYPE[type as HookType];

        for (const required of spec.required) {
            if (!fields.has(required)) {
                throw new Error(`Hook "${name}" at line ${nameLine} in "${this.path}" is missing required field "${required}".`);
            }
        }

        for (const key of fields.keys()) {
            if (!spec.required.includes(key) && !spec.optional.includes(key)) {
                throw new Error(`Hook "${name}" at line ${nameLine} in "${this.path}" has an unknown field "${key}" for type "${type}".`);
            }
        }

        const addressField = fields.get("address")!;
        let address: number;

        try {
            address = utils.dehexify(addressField.value);
        } catch {
            throw new Error(`Hook "${name}" at line ${addressField.line} in "${this.path}" has an invalid address "${addressField.value}" (expected hexadecimal such as 0x00123456; comments start with "@").`);
        }

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

    /** resolveSymbol with the hook name and line attached, so a mangling failure says WHICH hook. */
    private resolveField(hookName: string, field: RawField): string {
        try {
            return this.resolveSymbol(field.value);
        } catch (error) {
            throw new Error(`Hook "${hookName}" at line ${field.line} in "${this.path}" has a symbol that could not be resolved ("${field.value}"):\n${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private resolveSymbol(value: string): string {
        for (const directive of [NOMANGLE_DIRECTIVE, CONSTRUCTOR_DIRECTIVE]) {
            if (!value.startsWith(directive)) continue;

            const rest = value.slice(directive.length).trim();

            if (!rest) {
                throw new Error(`Expected a symbol name after "${directive}" in "${this.path}": "${value}".`);
            }

            return directive === NOMANGLE_DIRECTIVE ? rest : ensureMangled(rest, true);
        }

        return ensureMangled(value);
    }

    private parseDataBytes(value: string, line: number): Uint8Array {
        const combined = value
            .split(/\s+/)
            .filter((token) => token.length > 0)
            .map((token) => token.replace(/^0x/i, ""))
            .join("");

        if (combined.length === 0 || !/^[0-9a-fA-F]*$/.test(combined)) {
            throw new Error(`Invalid data bytes at line ${line} in "${this.path}": "${value}".`);
        }

        if (combined.length % 2 !== 0) {
            throw new Error(`Data bytes at line ${line} in "${this.path}" must combine into a whole number of bytes (even hex digit count): "${value}".`);
        }

        const bytes = new Uint8Array(combined.length / 2);

        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(combined.slice(i * 2, i * 2 + 2), 16);
        }

        return bytes;
    }
}
