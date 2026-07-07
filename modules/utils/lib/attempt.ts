export function attempt(tryCallback: () => void, finallyCallback: () => void, message: string): void {
    try {
        tryCallback();
    } catch {
        finallyCallback();
        throw new Error(message);
    }
    
    finallyCallback();
}