import * as filetendo from "./filetendo.ts";
import * as titanio from "./titanio.ts";
import * as wisdom from "./wisdom.ts";
import { utils } from "../../deps.ts";
import * as lunar from "./lunar.ts";
import * as lazy4 from "./lazy4.ts";
import * as brazo from "./brazo.ts";
import * as elfo from "./elfo.ts";

// The temp dir is gone once the tests run, so every module does its file work before calling Deno.test
utils.withTempDir(dir => {
    lunar.test(dir);
    lazy4.test(dir);
    brazo.test(dir);
    elfo.test(dir);
    filetendo.test(dir);
    wisdom.test(dir);
    titanio.test(dir);
});
