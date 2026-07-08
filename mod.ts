import { compile } from "./lib/compile.ts"

try {
    compile();
} catch(e) {
    Deno.removeSync("./atmosphere", { recursive: true });
    
    console.error((e as Error).message);
    Deno.exit(1);
}