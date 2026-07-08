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

export class Hks {
    readonly file: archivo.Archivo;
    readonly hooks: readonly HookDefinition[];

    constructor(public readonly path: string) {
        this.file = new archivo.Archivo(path);
        this.hooks = this.parse(this.file.readAsText());

        this.file.close();
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

            fields.set(key, { value: value.trim(), line: i + 1 });
        }

        finalize();

        return hooks;
    }

    private buildHook(name: string, nameLine: number, fields: Map<string, RawField>): HookDefinition {
        const type = fields.get("type")?.value;

        if (!type || !(type in FIELDS_BY_TYPE)) {
            throw new Error(`Hook "${name}" at line ${nameLine} in "${this.path}" has a missing or invalid "type" (expected "hook", "instr" or "data").`);
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

        const address = utils.dehexify(fields.get("address")!.value);

        switch (type as HookType) {
            case "hook": {
                const trampoline = fields.get("trampoline")?.value;

                return {
                    name,
                    type: "hook",
                    address,
                    symbol: this.resolveSymbol(fields.get("symbol")!.value),
                    ...(trampoline !== undefined ? { trampoline: this.resolveSymbol(trampoline) } : {}),
                };
            }

            case "call":
                return { name, type: "call", address, symbol: this.resolveSymbol(fields.get("symbol")!.value) };

            case "instr":
                return { name, type: "instr", address, instruction: fields.get("instruction")!.value };

            case "data": {
                const data = fields.get("data")!;

                return { name, type: "data", address, data: this.parseDataBytes(data.value, data.line) };
            }
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
