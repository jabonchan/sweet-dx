export function hexify(number: number, length: number = 8, prefix: boolean = true): string {
    let hexString = number.toString(16).toUpperCase();

    if (hexString.startsWith("-"))
        hexString = hexString.slice(1);
    
    const paddedHexString = hexString.padStart(length, '0');
    const finalHexString = prefix ? `${number < 0 ? "-" : ""}0x${paddedHexString}` : paddedHexString;

    return finalHexString;
}

export function dehexify(hex: string): number {
    const original = hex.trim();
    let digits = hex.replace(/\s+/g, "").toLowerCase();
    let sign = 1;

    // The sign is stripped first. The old code only handled "-0x..." and turned "-ff" into +255.
    if (digits.startsWith("-")) {
        sign = -1;
        digits = digits.slice(1);
    }

    if (digits.startsWith("0x")) digits = digits.slice(2);

    // parseInt() silently stops at the first invalid character, so "0x1234zz" used to parse as 0x1234.
    if (!/^[0-9a-f]+$/.test(digits)) throw new Error(`Invalid hexadecimal number: "${original}"`);

    return sign * parseInt(digits, 16) + 0; // "+ 0" turns -0 into 0
}

export function parseBytes(bytes: string): Uint8Array {
    return new Uint8Array(bytes.replace(/\s+/g, " ").trim().split(" ").map(byte => dehexify(byte)));
}