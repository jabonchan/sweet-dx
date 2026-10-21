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

type GetStreamValueType<T extends ByteStream | CharacterStream> = T extends {
    [Symbol.iterator](): Generator<
        readonly [infer Type, number],
        void,
        unknown
    >;
} ? Type
    : never;

type CallbackInterceptorType<T extends ByteStream | CharacterStream> = (
    result: readonly [GetStreamValueType<T>, number],
) => readonly [GetStreamValueType<T>, number];

type InterceptedStream<T extends ByteStream | CharacterStream> = {
    [Symbol.iterator](): Generator<
        readonly [GetStreamValueType<T>, number],
        void,
        unknown
    >;
};

/**
 * Wraps an iterable `[value, offset]` stream so every yielded entry goes
 * through `callback` first, letting the caller inspect or replace it.
 */
export function interceptReadStream<T extends ByteStream | CharacterStream>(
    stream: T,
    callback: CallbackInterceptorType<T>,
): InterceptedStream<T> {
    return {
        *[Symbol.iterator]() {
            for (const [value, number] of stream) {
                yield callback([value as GetStreamValueType<T>, number]);
            }
        },
    };
}
