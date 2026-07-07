export class Declarator {
    private constructor(
        public readonly text: string,
        public readonly needsParens: boolean,
    ) {}

    static bare(name: string): Declarator {
        return new Declarator(name, false);
    }

    withPrefix(prefix: string): Declarator {
        return new Declarator(prefix + this.text, true);
    }

    withSuffix(suffix: string): Declarator {
        const text = this.needsParens ? `(${this.text})${suffix}` : `${this.text}${suffix}`;
        return new Declarator(text, false);
    }
}
