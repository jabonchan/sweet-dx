/**
 * Formats a number as uppercase hex, zero-padded to `length` digits.
 * Negative numbers keep their sign in front of the prefix (`-0x...`).
 */
export function hexify(
    number: number,
    length: number = 8,
    prefix: boolean = true,
): string {
    let hexString = number.toString(16).toUpperCase();

    if (hexString.startsWith("-")) {
        hexString = hexString.slice(1);
    }

    const paddedHexString = hexString.padStart(length, "0");
    const finalHexString = prefix
        ? `${number < 0 ? "-" : ""}0x${paddedHexString}`
        : paddedHexString;

    return finalHexString;
}

/** Formats every byte of a buffer as two hex digits, optionally space-separated. */
export function hexifyBuffer(buffer: Uint8Array, spaces: boolean = false) {
    let bytes = "";

    for (const byte of buffer) {
        if (spaces) bytes += " ";
        bytes += hexify(byte, 2, false);
    }

    return bytes.trim();
}

/**
 * Parses a hex string (optional sign, optional `0x`, whitespace ignored) into
 * a number. Throws on invalid digits.
 */
export function dehexify(hex: string): number {
    const original = hex.trim();
    let digits = hex.replace(/\s+/g, "").toLowerCase();
    let sign = 1;

    if (digits.startsWith("-")) {
        sign = -1;
        digits = digits.slice(1);
    }

    if (digits.startsWith("0x")) digits = digits.slice(2);
    if (!/^[0-9a-f]+$/.test(digits)) {
        throw new Error(`Invalid hexadecimal number: "${original}"`);
    }

    // `+ 0` turns `-0` into `0`.
    return sign * parseInt(digits, 16) + 0;
}

/** Parses a whitespace-separated list of hex bytes (`"DE AD BE EF"`) into a buffer. */
export function parseBytes(bytes: string): Uint8Array {
    const array = bytes.trim().split(/\s+/);

    return new Uint8Array(array.map((byte) => {
        const number = dehexify(byte);

        if (number > 255 || number < 0) {
            throw new Error(`Invalid hexadecimal sequence: ${bytes}`);
        }

        return number;
    }));
}
