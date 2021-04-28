import { isAbsolute, join, normalize, sep, Sha1, Status } from "./deps.ts";
import { createHttpError } from "./httpError.ts";
const ENCODE_CHARS_REGEXP = /(?:[^\x21\x25\x26-\x3B\x3D\x3F-\x5B\x5D\x5F\x61-\x7A\x7E]|%(?:[^0-9A-Fa-f]|[0-9A-Fa-f][^0-9A-Fa-f]|$))+/g;
const HTAB = "\t".charCodeAt(0);
const SPACE = " ".charCodeAt(0);
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
const UNMATCHED_SURROGATE_PAIR_REGEXP = /(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]|[\uD800-\uDBFF]([^\uDC00-\uDFFF]|$)/g;
const UNMATCHED_SURROGATE_PAIR_REPLACE = "$1\uFFFD$2";
const DEFAULT_CHUNK_SIZE = 16_640;
export const BODY_TYPES = ["string", "number", "bigint", "boolean", "symbol"];
export function decodeComponent(text) {
    try {
        return decodeURIComponent(text);
    }
    catch {
        return text;
    }
}
export function encodeUrl(url) {
    return String(url)
        .replace(UNMATCHED_SURROGATE_PAIR_REGEXP, UNMATCHED_SURROGATE_PAIR_REPLACE)
        .replace(ENCODE_CHARS_REGEXP, encodeURI);
}
export function getRandomFilename(prefix = "", extension = "") {
    return `${prefix}${new Sha1().update(crypto.getRandomValues(new Uint8Array(256))).hex()}${extension ? `.${extension}` : ""}`;
}
export function isAsyncIterable(value) {
    return typeof value === "object" && value !== null &&
        Symbol.asyncIterator in value &&
        typeof value[Symbol.asyncIterator] === "function";
}
export function isReader(value) {
    return typeof value === "object" && value !== null && "read" in value &&
        typeof value.read === "function";
}
function isCloser(value) {
    return typeof value === "object" && value != null && "close" in value &&
        typeof value["close"] === "function";
}
export function isConn(value) {
    return typeof value === "object" && value != null && "rid" in value &&
        typeof value.rid === "number" && "localAddr" in value &&
        "remoteAddr" in value;
}
export function isListenTlsOptions(value) {
    return typeof value === "object" && value !== null && "certFile" in value &&
        "keyFile" in value && "port" in value;
}
export function readableStreamFromReader(reader, options = {}) {
    const { autoClose = true, chunkSize = DEFAULT_CHUNK_SIZE, strategy, } = options;
    return new ReadableStream({
        async pull(controller) {
            const chunk = new Uint8Array(chunkSize);
            try {
                const read = await reader.read(chunk);
                if (read === null) {
                    if (isCloser(reader) && autoClose) {
                        reader.close();
                    }
                    controller.close();
                    return;
                }
                controller.enqueue(chunk.subarray(0, read));
            }
            catch (e) {
                controller.error(e);
                if (isCloser(reader)) {
                    reader.close();
                }
            }
        },
        cancel() {
            if (isCloser(reader) && autoClose) {
                reader.close();
            }
        },
        type: "bytes",
    }, strategy);
}
export function isErrorStatus(value) {
    return [
        Status.BadRequest,
        Status.Unauthorized,
        Status.PaymentRequired,
        Status.Forbidden,
        Status.NotFound,
        Status.MethodNotAllowed,
        Status.NotAcceptable,
        Status.ProxyAuthRequired,
        Status.RequestTimeout,
        Status.Conflict,
        Status.Gone,
        Status.LengthRequired,
        Status.PreconditionFailed,
        Status.RequestEntityTooLarge,
        Status.RequestURITooLong,
        Status.UnsupportedMediaType,
        Status.RequestedRangeNotSatisfiable,
        Status.ExpectationFailed,
        Status.Teapot,
        Status.MisdirectedRequest,
        Status.UnprocessableEntity,
        Status.Locked,
        Status.FailedDependency,
        Status.UpgradeRequired,
        Status.PreconditionRequired,
        Status.TooManyRequests,
        Status.RequestHeaderFieldsTooLarge,
        Status.UnavailableForLegalReasons,
        Status.InternalServerError,
        Status.NotImplemented,
        Status.BadGateway,
        Status.ServiceUnavailable,
        Status.GatewayTimeout,
        Status.HTTPVersionNotSupported,
        Status.VariantAlsoNegotiates,
        Status.InsufficientStorage,
        Status.LoopDetected,
        Status.NotExtended,
        Status.NetworkAuthenticationRequired,
    ].includes(value);
}
export function isRedirectStatus(value) {
    return [
        Status.MultipleChoices,
        Status.MovedPermanently,
        Status.Found,
        Status.SeeOther,
        Status.UseProxy,
        Status.TemporaryRedirect,
        Status.PermanentRedirect,
    ].includes(value);
}
export function isHtml(value) {
    return /^\s*<(?:!DOCTYPE|html|body)/i.test(value);
}
export function skipLWSPChar(u8) {
    const result = new Uint8Array(u8.length);
    let j = 0;
    for (let i = 0; i < u8.length; i++) {
        if (u8[i] === SPACE || u8[i] === HTAB)
            continue;
        result[j++] = u8[i];
    }
    return result.slice(0, j);
}
export function stripEol(value) {
    if (value[value.byteLength - 1] == LF) {
        let drop = 1;
        if (value.byteLength > 1 && value[value.byteLength - 2] === CR) {
            drop = 2;
        }
        return value.subarray(0, value.byteLength - drop);
    }
    return value;
}
const UP_PATH_REGEXP = /(?:^|[\\/])\.\.(?:[\\/]|$)/;
export function resolvePath(rootPath, relativePath) {
    let path = relativePath;
    let root = rootPath;
    if (relativePath === undefined) {
        path = rootPath;
        root = ".";
    }
    if (path == null) {
        throw new TypeError("Argument relativePath is required.");
    }
    if (path.includes("\0")) {
        throw createHttpError(400, "Malicious Path");
    }
    if (isAbsolute(path)) {
        throw createHttpError(400, "Malicious Path");
    }
    if (UP_PATH_REGEXP.test(normalize("." + sep + path))) {
        throw createHttpError(403);
    }
    return normalize(join(root, path));
}
export class Uint8ArrayTransformStream extends TransformStream {
    constructor() {
        const init = {
            async transform(chunk, controller) {
                chunk = await chunk;
                switch (typeof chunk) {
                    case "object":
                        if (chunk === null) {
                            controller.terminate();
                        }
                        else if (ArrayBuffer.isView(chunk)) {
                            controller.enqueue(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
                        }
                        else if (Array.isArray(chunk) &&
                            chunk.every((value) => typeof value === "number")) {
                            controller.enqueue(new Uint8Array(chunk));
                        }
                        else if (typeof chunk.valueOf === "function" && chunk.valueOf() !== chunk) {
                            this.transform(chunk.valueOf(), controller);
                        }
                        else if ("toJSON" in chunk) {
                            this.transform(JSON.stringify(chunk), controller);
                        }
                        break;
                    case "symbol":
                        controller.error(new TypeError("Cannot transform a symbol to a Uint8Array"));
                        break;
                    case "undefined":
                        controller.error(new TypeError("Cannot transform undefined to a Uint8Array"));
                        break;
                    default:
                        controller.enqueue(this.encoder.encode(String(chunk)));
                }
            },
            encoder: new TextEncoder(),
        };
        super(init);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInV0aWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxJQUFJLEVBQUUsTUFBTSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQzNFLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUdqRCxNQUFNLG1CQUFtQixHQUN2QiwwR0FBMEcsQ0FBQztBQUM3RyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ2hDLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDaEMsTUFBTSxFQUFFLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUM5QixNQUFNLEVBQUUsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQzlCLE1BQU0sK0JBQStCLEdBQ25DLDBFQUEwRSxDQUFDO0FBQzdFLE1BQU0sZ0NBQWdDLEdBQUcsWUFBWSxDQUFDO0FBQ3RELE1BQU0sa0JBQWtCLEdBQUcsTUFBTSxDQUFDO0FBR2xDLE1BQU0sQ0FBQyxNQUFNLFVBQVUsR0FBRyxDQUFDLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFNBQVMsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUs5RSxNQUFNLFVBQVUsZUFBZSxDQUFDLElBQVk7SUFDMUMsSUFBSTtRQUNGLE9BQU8sa0JBQWtCLENBQUMsSUFBSSxDQUFDLENBQUM7S0FDakM7SUFBQyxNQUFNO1FBQ04sT0FBTyxJQUFJLENBQUM7S0FDYjtBQUNILENBQUM7QUFHRCxNQUFNLFVBQVUsU0FBUyxDQUFDLEdBQVc7SUFDbkMsT0FBTyxNQUFNLENBQUMsR0FBRyxDQUFDO1NBQ2YsT0FBTyxDQUFDLCtCQUErQixFQUFFLGdDQUFn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