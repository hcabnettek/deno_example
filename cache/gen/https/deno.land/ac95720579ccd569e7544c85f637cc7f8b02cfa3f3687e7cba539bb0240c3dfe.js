import { assert, Buffer, readAll, readerFromStreamReader } from "./deps.ts";
import { httpErrors } from "./httpError.ts";
import { isMediaType } from "./isMediaType.ts";
import { FormDataReader } from "./multipart.ts";
import { readableStreamFromReader } from "./util.ts";
const defaultBodyContentTypes = {
    json: ["json", "application/*+json", "application/csp-report"],
    form: ["urlencoded"],
    formData: ["multipart"],
    text: ["text"],
};
function resolveType(contentType, contentTypes) {
    const contentTypesJson = [
        ...defaultBodyContentTypes.json,
        ...(contentTypes.json ?? []),
    ];
    const contentTypesForm = [
        ...defaultBodyContentTypes.form,
        ...(contentTypes.form ?? []),
    ];
    const contentTypesFormData = [
        ...defaultBodyContentTypes.formData,
        ...(contentTypes.formData ?? []),
    ];
    const contentTypesText = [
        ...defaultBodyContentTypes.text,
        ...(contentTypes.text ?? []),
    ];
    if (contentTypes.bytes && isMediaType(contentType, contentTypes.bytes)) {
        return "bytes";
    }
    else if (isMediaType(contentType, contentTypesJson)) {
        return "json";
    }
    else if (isMediaType(contentType, contentTypesForm)) {
        return "form";
    }
    else if (isMediaType(contentType, contentTypesFormData)) {
        return "form-data";
    }
    else if (isMediaType(contentType, contentTypesText)) {
        return "text";
    }
    return "bytes";
}
const decoder = new TextDecoder();
function bodyAsReader(body) {
    return body instanceof ReadableStream
        ? readerFromStreamReader(body.getReader())
        : body ?? new Buffer();
}
function bodyAsStream(body) {
    return body instanceof ReadableStream ? body : readableStreamFromReader(body);
}
export class RequestBody {
    #formDataReader;
    #has;
    #readAllBody;
    #request;
    #type;
    #parse = (type) => {
        switch (type) {
            case "form":
                this.#type = "bytes";
                return async () => new URLSearchParams(decoder.decode(await this.#valuePromise()).replace(/\+/g, " "));
            case "form-data":
                this.#type = "form-data";
                return () => {
                    const contentType = this.#request.headers.get("content-type");
                    assert(contentType);
                    return this.#formDataReader ??
                        (this.#formDataReader = new FormDataReader(contentType, bodyAsReader(this.#request.body)));
                };
            case "json":
                this.#type = "bytes";
                return async () => JSON.parse(decoder.decode(await this.#valuePromise()));
            case "bytes":
                this.#type = "bytes";
                return () => this.#valuePromise();
            case "text":
                this.#type = "bytes";
                return async () => decoder.decode(await this.#valuePromise());
            default:
                throw new TypeError(`Invalid body type: "${type}"`);
        }
    };
    #validateGetArgs = (type, contentTypes) => {
        if (type === "reader" && this.#type && this.#type !== "reader") {
            throw new TypeError(`Body already consumed as "${this.#type}" and cannot be returned as a reader.`);
        }
        if (type === "stream" && this.#type && this.#type !== "stream") {
            throw new TypeError(`Body already consumed as "${this.#type}" and cannot be returned as a stream.`);
        }
        if (type === "form-data" && this.#type && this.#type !== "form-data") {
            throw new TypeError(`Body already consumed as "${this.#type}" and cannot be returned as a stream.`);
        }
        if (this.#type === "reader" && type !== "reader") {
            throw new TypeError("Body already consumed as a reader and can only be returned as a reader.");
        }
        if (this.#type === "stream" && type !== "stream") {
            throw new TypeError("Body already consumed as a stream and can only be returned as a stream.");
        }
        if (this.#type === "form-data" && type !== "form-data") {
            throw new TypeError("Body already consumed as form data and can only be returned as form data.");
        }
        if (type && Object.keys(contentTypes).length) {
            throw new TypeError(`"type" and "contentTypes" cannot be specified at the same time`);
        }
    };
    #valuePromise = () => {
        return this.#readAllBody ??
            (this.#readAllBody = this.#request instanceof Request
                ? this.#request.arrayBuffer().then((ab) => new Uint8Array(ab))
                : readAll(this.#request.body));
    };
    constructor(request) {
        this.#request = request;
    }
    get({ type, contentTypes = {} }) {
        this.#validateGetArgs(type, contentTypes);
        if (type === "reader") {
            this.#type = "reader";
            return { type, value: bodyAsReader(this.#request.body) };
        }
        if (type === "stream") {
            if (!this.#request.body) {
                this.#type = "undefined";
                throw new TypeError(`Body is undefined and cannot be returned as "stream".`);
            }
            this.#type = "stream";
            return { type, value: bodyAsStream(this.#request.body) };
        }
        if (!this.has()) {
            this.#type = "undefined";
        }
        else if (!this.#type) {
            const encoding = this.#request.headers.get("content-encoding") ??
                "identity";
            if (encoding !== "identity") {
                throw new httpErrors.UnsupportedMediaType(`Unsupported content-encoding: ${encoding}`);
            }
        }
        if (this.#type === "undefined") {
            if (type && type !== "undefined") {
                throw new TypeError(`Body is undefined and cannot be returned as "${type}".`);
            }
            return { type: "undefined", value: undefined };
        }
        if (!type) {
            const contentType = this.#request.headers.get("content-type");
            assert(contentType, "The Content-Type header is missing from the request");
            type = resolveType(contentType, contentTypes);
        }
        assert(type);
        const body = Object.create(null);
        Object.defineProperties(body, {
            type: {
                value: type,
                configurable: true,
                enumerable: true,
            },
            value: {
                get: this.#parse(type),
                configurable: true,
                enumerable: true,
            },
        });
        return body;
    }
    has() {
        return this.#has !== undefined
            ? this.#has
            : (this.#has = this.#request.body != null &&
                (this.#request.headers.has("transfer-encoding") ||
                    !!parseInt(this.#request.headers.get("content-length") ?? "", 10)) || this.#request.body instanceof ReadableStream);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYm9keS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImJvZHkudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBRUEsT0FBTyxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRTVFLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUM1QyxPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFDL0MsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ2hELE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQW1GckQsTUFBTSx1QkFBdUIsR0FBRztJQUM5QixJQUFJLEVBQUUsQ0FBQyxNQUFNLEVBQUUsb0JBQW9CLEVBQUUsd0JBQXdCLENBQUM7SUFDOUQsSUFBSSxFQUFFLENBQUMsWUFBWSxDQUFDO0lBQ3BCLFFBQVEsRUFBRSxDQUFDLFdBQVcsQ0FBQztJQUN2QixJQUFJLEVBQUUsQ0FBQyxNQUFNLENBQUM7Q0FDZixDQUFDO0FBRUYsU0FBUyxXQUFXLENBQ2xCLFdBQW1CLEVBQ25CLFlBQXFDO0lBRXJDLE1BQU0sZ0JBQWdCLEdBQUc7UUFDdkIsR0FBRyx1QkFBdUIsQ0FBQyxJQUFJO1FBQy9CLEdBQUcsQ0FBQyxZQUFZLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztLQUM3QixDQUFDO0lBQ0YsTUFBTSxnQkFBZ0IsR0FBRztRQUN2QixHQUFHLHVCQUF1QixDQUFDLElBQUk7UUFDL0IsR0FBRyxDQUFDLFlBQVksQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO0tBQzdCLENBQUM7SUFDRixNQUFNLG9CQUFvQixHQUFHO1FBQzNCLEdBQUcsdUJBQXVCLENBQUMsUUFBUTtRQUNuQyxHQUFHLENBQUMsWUFBWSxDQUFDLFFBQVEsSUFBSSxFQUFFLENBQUM7S0FDakMsQ0FBQztJQUNGLE1BQU0sZ0JBQWdCLEdBQUc7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