import { isListenTlsOptions } from "./util.ts";
export const DomResponse = Response;
const serveHttp = "serveHttp" in Deno
    ?
        Deno.serveHttp.bind(Deno)
    : undefined;
export function hasNativeHttp() {
    return !!serveHttp;
}
export class NativeRequest {
    #conn;
    #reject;
    #request;
    #requestPromise;
    #resolve;
    #resolved = false;
    constructor(requestEvent, conn) {
        this.#conn = conn;
        this.#request = requestEvent.request;
        const p = new Promise((resolve, reject) => {
            this.#resolve = resolve;
            this.#reject = reject;
        });
        this.#requestPromise = requestEvent.respondWith(p);
    }
    get body() {
        return this.#request.body;
    }
    get donePromise() {
        return this.#requestPromise;
    }
    get headers() {
        return this.#request.headers;
    }
    get method() {
        return this.#request.method;
    }
    get remoteAddr() {
        return this.#conn?.remoteAddr.hostname;
    }
    get request() {
        return this.#request;
    }
    get url() {
        try {
            const url = new URL(this.#request.url);
            return this.#request.url.replace(url.origin, "");
        }
        catch {
        }
        return this.#request.url;
    }
    get rawUrl() {
        return this.#request.url;
    }
    error(reason) {
        if (this.#resolved) {
            throw new Error("Request already responded to.");
        }
        this.#reject(reason);
        this.#resolved = true;
    }
    respond(response) {
        if (this.#resolved) {
            throw new Error("Request already responded to.");
        }
        this.#resolve(response);
        this.#resolved = true;
        return this.#requestPromise;
    }
}
export class HttpServerNative {
    #app;
    #closed = false;
    #options;
    constructor(app, options) {
        if (!("serveHttp" in Deno)) {
            throw new Error("The native bindings for serving HTTP are not available.");
        }
        this.#app = app;
        this.#options = options;
    }
    get app() {
        return this.#app;
    }
    get closed() {
        return this.#closed;
    }
    close() {
        this.#closed = true;
    }
    [Symbol.asyncIterator]() {
        const server = this;
        const options = this.#options;
        const stream = new ReadableStream({
            start(controller) {
                const listener = isListenTlsOptions(options)
                    ? Deno.listenTls(options)
                    : Deno.listen(options);
                async function serve(conn) {
                    const httpConn = serveHttp(conn);
                    for await (const requestEvent of httpConn) {
                        const nativeRequest = new NativeRequest(requestEvent, conn);
                        controller.enqueue(nativeRequest);
                        try {
                            await nativeRequest.donePromise;
                        }
                        catch (error) {
                            server.app.dispatchEvent(new ErrorEvent("error", { error }));
                        }
                        if (server.closed) {
                            httpConn.close();
                            listener.close();
                            controller.close();
                            return;
                        }
                    }
                }
                async function accept() {
                    while (true) {
                        try {
                            const conn = await listener.accept();
                            serve(conn);
                        }
                        catch (error) {
                            server.app.dispatchEvent(new ErrorEvent("error", { error }));
                        }
                        if (server.closed) {
                            listener.close();
                            controller.close();
                            return;
                        }
                    }
                }
                accept();
            },
        });
        return stream[Symbol.asyncIterator]();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cF9zZXJ2ZXJfbmF0aXZlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaHR0cF9zZXJ2ZXJfbmF0aXZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUlBLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUcvQyxNQUFNLENBQUMsTUFBTSxXQUFXLEdBQW9CLFFBQVEsQ0FBQztBQWlCckQsTUFBTSxTQUFTLEdBQWtDLFdBQVcsSUFBSSxJQUFJO0lBQ2xFLENBQUM7UUFDRSxJQUFZLENBQUMsU0FBUyxDQUFDLElBQUksQ0FDMUIsSUFBSSxDQUNMO0lBQ0gsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQU1kLE1BQU0sVUFBVSxhQUFhO0lBQzNCLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUNyQixDQUFDO0FBRUQsTUFBTSxPQUFPLGFBQWE7SUFDeEIsS0FBSyxDQUFhO0lBRWxCLE9BQU8sQ0FBMEI7SUFDakMsUUFBUSxDQUFVO0lBQ2xCLGVBQWUsQ0FBZ0I7SUFDL0IsUUFBUSxDQUE2QjtJQUNyQyxTQUFTLEdBQUcsS0FBSyxDQUFDO0lBRWxCLFlBQVksWUFBMEIsRUFBRSxJQUFnQjtRQUN0RCxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztRQUNsQixJQUFJLENBQUMsUUFBUSxHQUFHLFlBQVksQ0FBQyxPQUFPLENBQUM7UUFDckMsTUFBTSxDQUFDLEdBQUcsSUFBSSxPQUFPLENBQVcsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7WUFDbEQsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7WUFDeEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUM7UUFDSCxJQUFJLENBQUMsZUFBZSxHQUFHLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDckQsQ0FBQztJQUVELElBQUksSUFBSTtRQUNOLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJ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