export function hexify(number: number, length: number = 8, prefix: boolean = true): string {
    let hexString = number.toString(16).toUpperCase();

    if (hexString.startsWith("-"))
        hexString = hexString.slice(1);
    
    const paddedHexString = hexString.padStart(length, '0');
    const finalHexString = prefix ? `${number < 0 ? "-" : ""}0x${paddedHexString}` : paddedHexString;

    return finalHexString;
}

export function dehexify(hex: string): number {
    hex = hex.replace(/\s+/g, "").toLowerCase();
    const sign = hex.startsWith("-") ? -1 : 1;
    hex = hex.startsWith("-0x") ? hex.slice(3) : hex.startsWith("0x") ? hex.slice(2) : hex;
    const number = sign * parseInt(hex, 16);

    if (isNaN(number)) throw new Error(`Invalid hexadecimal number: ${hex}`);
    
    return number;
}

export function parseBytes(bytes: string): Uint8Array {
    return new Uint8Array(bytes.replace(/\s+/g, " ").trim().split(" ").map(byte => dehexify(byte)));
}