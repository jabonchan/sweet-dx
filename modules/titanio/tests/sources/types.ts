export interface CaseOptions {
    /** A known limitation: the comparison is expected to fail (the reason is shown in the test name). */
    knownMismatch?: string;
}

export interface TestSource {
    /** Name of the .cpp file written to the temporary directory */
    name: string;
    /** Declarations shared by the definitions */
    prelude: string;
    /** [titanio signature, C++ definition that makes clang emit it, options] */
    cases: [signature: string, definition: string, options?: CaseOptions][];
}
