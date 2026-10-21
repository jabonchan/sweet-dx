import { Recuerdo } from "../deps.ts";

/**
 * Runs `tryCallback` and then `finallyCallback`. If `tryCallback` throws, the
 * error is logged and `finallyCallback`'s result is returned
 * instead, so it doubles as the fallback value.
 */
export function attempt<T extends unknown, J extends unknown>(
    tryCallback: () => T,
    finallyCallback: () => J,
    message: string,
): T | J {
    let result: T;

    try {
        result = tryCallback();
    } catch {
        Recuerdo.error("An attempt failed. Ignoring error", message);
        return finallyCallback();
    }

    finallyCallback();
    return result;
}
