export const decode = TextDecoder.prototype.decode.bind(new TextDecoder());
export const encode = TextEncoder.prototype.encode.bind(new TextEncoder());