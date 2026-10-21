// deno-lint-ignore-file no-this-alias

import { utils, way } from "../deps.ts";
import * as e from "./exists.ts";

// Largest string / typed array that can be read in one go; bigger files need streams.
export const MAXIMUM_STRING_SIZE = 2 ** 28;
export const MAXIMUM_ARRAY_SIZE = (2 ** 32) - 1;

export type ArchivoStream = ReturnType<
    typeof Archivo.prototype.createReadStream
>;
export type ArchivoCharacterStream = ReturnType<
    typeof Archivo.prototype.createReadCharacterStream
>;

type ByteStream = {
    [Symbol.iterator](): Generator<
        readonly [Uint8Array, number],
        void,
        unknown
    >;
};

type CharacterStream = {
    [Symbol.iterator](): Generator<readonly [string, number], void, unknown>;
};

/** A synchronous wrapper around an open file with bounds-checked reads, writes and streams. */
export class Archivo {
    public readonly info: way.ParsedPath;
    public readonly handle: Deno.FsFile;
    private closed = false;

    /**
     * Opens (or creates, unless `readOnly`) the file at `path`.
     * With `empty`, an existing file is truncated to zero bytes.
     */
    constructor(
        public readonly path: string,
        options: { readOnly?: boolean; empty?: boolean } = {},
    ) {
        this.path = way.isRelative(path)
            ? way.join(Deno.cwd(), path)
            : way.normalize(path);

        if (options.empty && options.readOnly) {
            throw new Error(
                `Can't open a file (${this.path}) as both empty and read-only`,
            );
        }

        if (e.exists(this.path) && !e.existsAsFile(this.path)) {
            throw new Error(
                `The path "${this.path}" exists but is not a file.`,
            );
        }

        if (!e.existsAsDirectory(way.dirpath(this.path))) {
            throw new Error(
                `The directory "${way.dirpath(this.path)}" does not exist.`,
            );
        }

        this.info = way.parse(this.path);

        try {
            this.handle = Deno.openSync(
                this.path,
                options.readOnly
                    ? { read: true }
                    : { read: true, write: true, create: true },
            );
        } catch (e) {
            throw new Error(
                `Failed to open file "${this.path}": ${(e as Error).message}`,
            );
        }

        if (!options.empty || !this.handle.statSync().size) return;

        try {
            this.handle.truncateSync(0);
        } catch (e) {
            this.handle.close();
            throw new Error(
                "Failed to empty file. Due to " + (e as Error).message,
            );
        }
    }

    /** Whether `close()` was already called. */
    isClosed(): boolean {
        return this.closed;
    }

    /** Whether the file is still open. */
    isOpen(): boolean {
        return !this.closed;
    }

    /** Returns the current file size in bytes. */
    getSize(): number {
        if (this.closed) {
            throw new Error(`The file "${this.path}" is already closed.`);
        }

        return this.handle.statSync().size;
    }

    /** Closes the file handle. Fails if it was already closed. */
    close(): void {
        if (this.closed) {
            throw new Error(`The file "${this.path}" is already closed.`);
        }

        this.closed = true;
        this.handle.close();
    }

    /** Reads the whole file as UTF-8 text. */
    readAsText(): string {
        if (this.getSize() > MAXIMUM_STRING_SIZE) {
            throw new Error(
                "The file size is too large to be read at once as a string, use stream based APIs. File size: " +
                    this.getSize(),
            );
        }

        return Deno.readTextFileSync(this.path);
    }

    /** Reads the whole file as bytes. */
    read(): Uint8Array {
        if (this.getSize() > MAXIMUM_ARRAY_SIZE) {
            throw new Error(
                "The file size is too large to be read at once, use stream based APIs. File size: " +
                    this.getSize(),
            );
        }

        return Deno.readFileSync(this.path);
    }

    /**
     * Reads `length` bytes starting at `offset`. Fails on a short read unless
     * `allowPartial` is set, in which case the returned buffer may be smaller.
     */
    readAt(
        offset: number,
        length: number,
        allowPartial: boolean = false,
    ): Uint8Array<ArrayBuffer> {
        if (length > MAXIMUM_ARRAY_SIZE) {
            throw new Error(
                "The chunk size is too large to be used, use a smaller chunk size instead. Chunk size: " +
                    length,
            );
        }

        this.goto(offset);

        const buffer = new Uint8Array(length);
        let read = 0;

        while (read < length) {
            const bytesRead = this.handle.readSync(buffer.subarray(read));
            if (bytesRead === null) break;
            read += bytesRead;
        }

        if (read < length && !allowPartial) {
            throw new Error(
                `Expected to read ${length} bytes, but only read ${read} bytes from file "${this.path}" at offset ${
                    utils.hexify(offset)
                }.`,
            );
        }

        return buffer.slice(0, read);
    }

    /** Writes `data` at `offset`, overwriting what's there. */
    writeAt(offset: number, data: Uint8Array): void {
        let written = 0;

        while (written < data.length) {
            this.goto(offset + written);
            written += this.handle.writeSync(data.subarray(written));
        }
    }

    /** Writes `data` as UTF-8 at `offset`. */
    writeTextAt(offset: number, data: string): void {
        return this.writeAt(offset, utils.encode(data));
    }

    /** Writes `data` at the end of the file. */
    append(data: Uint8Array): void {
        this.writeAt(this.getSize(), data);
    }

    /** Writes `data` as UTF-8 at the end of the file. */
    appendText(data: string): void {
        return this.append(utils.encode(data));
    }

    /**
     * Returns a lazy iterable of `[chunk, offset]` pairs from `offset` up to
     * `end` (or `offset + size`, or the end of the file).
     */
    createReadStream(
        opts: { offset: number; chunkSize?: number; end?: number } | {
            offset: number;
            chunkSize?: number;
            size?: number;
        },
    ): ByteStream {
        let currentOffset = opts.offset;
        let consumed = false;

        const self = this;
        const chunkSize = opts.chunkSize ?? 1024;
        const fileSize = self.getSize();
        const endOffset = ("end" in opts)
            ? (opts.end ?? fileSize)
            : ("size" in opts)
            ? (opts.size ?? (fileSize - currentOffset)) + currentOffset
            : fileSize;

        if (chunkSize <= 0 || opts.offset < 0 || endOffset < currentOffset) {
            throw new Error(
                `Invalid stream options. Received: ${JSON.stringify(opts)}`,
            );
        }

        if (fileSize < endOffset) {
            throw new Error(
                `End offset ${utils.hexify(endOffset)} exceeds file size of ${
                    utils.hexify(fileSize)
                }.`,
            );
        }

        return {
            *[Symbol.iterator]() {
                if (consumed) {
                    throw new Error(
                        `Attempted to consume already-consumed stream (${self.path})`,
                    );
                }

                consumed = true;
                while (currentOffset < endOffset) {
                    const remainingSize = endOffset - currentOffset;
                    const currentChunkSize = Math.min(chunkSize, remainingSize);
                    const chunk = self.readAt(currentOffset, currentChunkSize);

                    yield [chunk, currentOffset] as const;

                    currentOffset += currentChunkSize;
                }
            },
        };
    }

    /**
     * Like `createReadStream`, but decodes UTF-8 and yields one
     * `[character, byteOffset]` pair per character.
     */
    createReadCharacterStream(
        opts: { offset: number; chunkSize?: number; end?: number } | {
            offset: number;
            chunkSize?: number;
            size?: number;
        },
    ): CharacterStream {
        const byteStream = this.createReadStream(opts);

        return {
            *[Symbol.iterator]() {
                const decoder = new TextDecoder("utf8", { fatal: true });
                let charOffset = opts.offset;

                for (const [chunk] of byteStream) {
                    // `stream: true` keeps multi-byte characters split across chunks intact.
                    const text = decoder.decode(chunk, { stream: true });

                    for (const char of text) {
                        yield [char, charOffset] as const;
                        charOffset += utils.encode(char).length;
                    }
                }

                // Flush whatever bytes the decoder was still holding back.
                const tail = decoder.decode();

                for (const char of tail) {
                    yield [char, charOffset] as const;
                    charOffset += utils.encode(char).length;
                }
            },
        };
    }

    /** Seeks to `offset`, checking the file is open and the offset is in range. */
    private goto(offset: number): void {
        if (this.closed) {
            throw new Error(`The file "${this.path}" is already closed.`);
        }

        if (offset < 0) {
            throw new Error(
                `Offset cannot be negative. Received: ${utils.hexify(offset)}`,
            );
        }

        if (this.getSize() < offset) {
            throw new Error(
                `Offset ${utils.hexify(offset)} exceeds file size of ${
                    utils.hexify(this.getSize())
                }.`,
            );
        }

        this.handle.seekSync(offset, Deno.SeekMode.Start);
    }

    /** Same as `createReadStream`, but over an in-memory buffer instead of the file. */
    static bufferToReadStream(
        buffer: Uint8Array,
        opts: { offset: number; chunkSize?: number; end?: number } | {
            offset: number;
            chunkSize?: number;
            size?: number;
        },
    ): ByteStream {
        let currentOffset = opts.offset;
        let consumed = false;

        const chunkSize = opts.chunkSize ?? 1024;
        const fileSize = buffer.byteLength;
        const endOffset = ("end" in opts)
            ? (opts.end ?? fileSize)
            : ("size" in opts)
            ? (opts.size ?? (fileSize - currentOffset)) + currentOffset
            : fileSize;

        if (chunkSize <= 0 || opts.offset < 0 || endOffset < currentOffset) {
            throw new Error(
                `Invalid stream options. Received: ${JSON.stringify(opts)}`,
            );
        }

        if (fileSize < endOffset) {
            throw new Error(
                `End offset ${utils.hexify(endOffset)} exceeds file size of ${
                    utils.hexify(fileSize)
                }.`,
            );
        }

        return {
            *[Symbol.iterator]() {
                if (consumed) {
                    throw new Error(
                        `Attempted to consume already-consumed buffer-stream`,
                    );
                }

                consumed = true;
                while (currentOffset < endOffset) {
                    const remainingSize = endOffset - currentOffset;
                    const currentChunkSize = Math.min(chunkSize, remainingSize);
                    const chunk = buffer.slice(
                        currentOffset,
                        currentOffset + currentChunkSize,
                    );

                    yield [chunk, currentOffset] as const;

                    currentOffset += currentChunkSize;
                }
            },
        };
    }
}
