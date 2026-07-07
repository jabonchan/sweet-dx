// deno-lint-ignore-file no-this-alias

import { way, utils } from "../deps.ts";
import * as e from "./exists.ts";

export const MAXIMUM_STRING_SIZE = 2 ** 28;
export const MAXIMUM_ARRAY_SIZE = (2 ** 32) - 1;

export type ArchivoStream = ReturnType<typeof Archivo.prototype.createReadStream>;
export type ArchivoCharacterStream = ReturnType<typeof Archivo.prototype.createReadCharacterStream>;

type ByteStream = {
    [Symbol.iterator](): Generator<readonly [Uint8Array, number], void, unknown>;
};

type CharacterStream = {
    [Symbol.iterator](): Generator<readonly [string, number], void, unknown>;
};

export class Archivo {
    public readonly info: way.ParsedPath;
    public readonly handle: Deno.FsFile;
    private closed = false;

    constructor(public readonly path: string) {
        this.path = way.isRelative(path) ? way.join(Deno.cwd(), path) : way.normalize(path);

        if (e.exists(this.path) && !e.existsAsFile(this.path)) {
            throw new Error(`The path "${this.path}" exists but is not a file.`);
        }

        if (!e.existsAsDirectory(way.dirpath(this.path))) {
            throw new Error(`The directory "${way.dirpath(this.path)}" does not exist.`);
        }

        this.info = way.parse(this.path);

        try {
            this.handle = Deno.openSync(this.path, { read: true, write: true, create: true });
        } catch (error) {
            throw new Error(`Failed to open file "${this.path}": ${(error as Error).message}`);
        }
    }
    
    getSize(): number {
        if (this.closed) {
            throw new Error(`The file "${this.path}" is already closed.`);
        }

        return this.handle.statSync().size;
    }

    close(): void {
        if (this.closed) {
            throw new Error(`The file "${this.path}" is already closed.`);
        }

        this.closed = true;
        this.handle.close();
    }

    readAsText(): string {
        if (this.getSize() > MAXIMUM_STRING_SIZE)
            throw new Error("The file size is too large to be read at once as a string, use stream based APIs. File size: " + this.getSize());

        return Deno.readTextFileSync(this.path);
    }
    
    read(): Uint8Array {
        if (this.getSize() > MAXIMUM_ARRAY_SIZE)
            throw new Error("The file size is too large to be read at once, use stream based APIs. File size: " + this.getSize());

        return Deno.readFileSync(this.path);
    }

    readAt(offset: number, length: number, allowPartial: boolean = false): Uint8Array<ArrayBuffer> {
        if (length > MAXIMUM_ARRAY_SIZE)
            throw new Error("The chunk size is too large to be used, use a smaller chunk size instead. Chunk size: " + length);
        
        this.goto(offset);

        const buffer = new Uint8Array(length);
        const bytesRead = this.handle.readSync(buffer);

        if (bytesRead === null) {
            throw new Error(`Failed to read from file "${this.path}" at offset ${utils.hexify(offset)}.`);
        }

        if (bytesRead < length && !allowPartial) {
            throw new Error(`Expected to read ${length} bytes, but only read ${bytesRead} bytes from file "${this.path}" at offset ${utils.hexify(offset)}.`);
        }

        return buffer.slice(0, bytesRead);
    }

    writeAt(offset: number, data: Uint8Array): void {
        this.goto(offset);

        const bytesWritten = this.handle.writeSync(data);

        if (bytesWritten !== data.length) {
            throw new Error(`Expected to write ${data.length} bytes, but only wrote ${bytesWritten} bytes to file "${this.path}" at offset ${utils.hexify(offset)}.`);
        }
    }

    writeTextAt(offset: number, data: string): void {
        return this.writeAt(offset, utils.encode(data));
    }

    append(data: Uint8Array): void {
        this.writeAt(this.getSize(), data);
    }

    appendText(data: string): void {
        return this.append(utils.encode(data));
    }

    createReadStream(opts: { offset: number, chunkSize?: number, end?: number } | { offset: number, chunkSize?: number, size?: number }): ByteStream {
        let currentOffset = opts.offset;

        const chunkSize = opts.chunkSize ?? 1024;
        const fileSize = this.getSize();
        const self = this;
        const endOffset = ("end" in opts)
                            ? (opts.end ?? fileSize)
                            : ("size" in opts)
                                ? (opts.size ?? (fileSize - currentOffset)) + currentOffset
                                : fileSize; 


        if (chunkSize <= 0 || opts.offset < 0 || endOffset < currentOffset) {
            throw new Error(`Invalid stream options. Received: ${JSON.stringify(opts)}`);
        }

        if (fileSize < endOffset) {
            throw new Error(`End offset ${utils.hexify(endOffset)} exceeds file size of ${utils.hexify(fileSize)}.`);
        }

        return {
            *[Symbol.iterator]() {
                while (currentOffset < endOffset) {
                    const remainingSize = endOffset - currentOffset;
                    const currentChunkSize = Math.min(chunkSize, remainingSize);
                    const chunk = self.readAt(currentOffset, currentChunkSize);
                    
                    yield [chunk, currentOffset] as const;
                    
                    currentOffset += currentChunkSize;
                }
            }
        }
    }

    createReadCharacterStream(opts: { offset: number, chunkSize?: number, end?: number } | { offset: number, chunkSize?: number, size?: number }): CharacterStream {
        const byteStream = this.createReadStream(opts);
        const decoder = new TextDecoder();
        let charOffset = opts.offset;

        return {
            *[Symbol.iterator]() {
                for (const [chunk] of byteStream) {
                    const text = decoder.decode(chunk, { stream: true });

                    for (const char of text) {
                        yield [char, charOffset] as const;
                        charOffset += utils.encode(char).length;
                    }
                }

                const tail = decoder.decode();

                for (const char of tail) {
                    yield [char, charOffset] as const;
                    charOffset += utils.encode(char).length;
                }
            }
        }
    }

    private goto(offset: number): void {
        if (this.closed) {
            throw new Error(`The file "${this.path}" is already closed.`);
        }

        if (offset < 0) {
            throw new Error(`Offset cannot be negative. Received: ${utils.hexify(offset)}`);
        }

        if (this.getSize() < offset) {
            throw new Error(`Offset ${utils.hexify(offset)} exceeds file size of ${utils.hexify(this.getSize())}.`);
        }

        this.handle.seekSync(offset, Deno.SeekMode.Start);
    }

    static bufferToReadStream(buffer: Uint8Array, opts: { offset: number, chunkSize?: number, end?: number } | { offset: number, chunkSize?: number, size?: number }): ByteStream {
        let currentOffset = opts.offset;

        const chunkSize = opts.chunkSize ?? 1024;
        const fileSize = buffer.byteLength;
        const endOffset = ("end" in opts)
                            ? (opts.end ?? fileSize)
                            : ("size" in opts)
                                ? (opts.size ?? (fileSize - currentOffset)) + currentOffset
                                : fileSize; 


        if (chunkSize <= 0 || opts.offset < 0 || endOffset < currentOffset) {
            throw new Error(`Invalid stream options. Received: ${JSON.stringify(opts)}`);
        }

        if (fileSize < endOffset) {
            throw new Error(`End offset ${utils.hexify(endOffset)} exceeds file size of ${utils.hexify(fileSize)}.`);
        }

        return {
            *[Symbol.iterator]() {
                while (currentOffset < endOffset) {
                    const remainingSize = endOffset - currentOffset;
                    const currentChunkSize = Math.min(chunkSize, remainingSize);
                    const chunk = buffer.slice(currentOffset, currentOffset + currentChunkSize);
                    
                    yield [chunk, currentOffset] as const;
                    
                    currentOffset += currentChunkSize;
                }
            }
        }
    }
}