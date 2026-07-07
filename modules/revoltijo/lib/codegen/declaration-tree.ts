export class DeclarationTree {
    private readonly namespaces = new Map<string, DeclarationTree>();
    private readonly stubs = new Map<string, number | null>();
    private readonly values = new Set<string>();

    getOrCreateNamespace(name: string): DeclarationTree {
        let child = this.namespaces.get(name);

        if (!child) {
            child = new DeclarationTree();
            this.namespaces.set(name, child);
        }

        return child;
    }

    addStub(name: string, arity: number | null): void {
        if (this.values.has(name)) {
            throw new Error(
                `"${name}" is used both as a type and as a value (e.g. an array bound) elsewhere in the signature — ` +
                    `it can't be stubbed consistently as both.`,
            );
        }

        const existing = this.stubs.get(name);

        if (existing !== undefined && existing !== arity) {
            throw new Error(
                `"${name}" is used inconsistently (once with ${existing === null ? "no" : existing} template argument(s), ` +
                    `once with ${arity === null ? "no" : arity}) — this usually means a template-template-parameter, which isn't supported.`,
            );
        }

        this.stubs.set(name, arity);
    }

    hasValue(name: string): boolean {
        return this.values.has(name);
    }

    addValue(name: string): void {
        if (this.stubs.has(name)) {
            throw new Error(
                `"${name}" is used both as a type and as a value (e.g. an array bound) elsewhere in the signature — ` +
                    `it can't be stubbed consistently as both.`,
            );
        }

        this.values.add(name);
    }

    render(indent: string): string {
        const lines: string[] = [];

        for (const [name, arity] of this.stubs) {
            if (arity === null) {
                lines.push(`${indent}struct ${name} {};`);
            } else {
                const params = Array.from({ length: arity }, (_, i) => `typename RevoltijoParam${i}`).join(", ");
                lines.push(`${indent}template<${params}> struct ${name} {};`);
            }
        }

        for (const name of this.values) {
            lines.push(`${indent}constexpr long ${name} = 1;`);
        }

        for (const [name, child] of this.namespaces) {
            lines.push(`${indent}namespace ${name} {`);
            lines.push(child.render(indent + "    "));
            lines.push(`${indent}}`);
        }

        return lines.join("\n");
    }
}
