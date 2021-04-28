import { Context } from "./context.ts";
import { assert, STATUS_TEXT } from "./deps.ts";
import { hasNativeHttp, HttpServerNative, NativeRequest, } from "./http_server_native.ts";
import { HttpServerStd } from "./http_server_std.ts";
import { KeyStack } from "./keyStack.ts";
import { compose } from "./middleware.ts";
import { isConn } from "./util.ts";
const ADDR_REGEXP = /^\[?([^\]]*)\]?:([0-9]{1,5})$/;
export class ApplicationErrorEvent extends ErrorEvent {
    context;
    constructor(eventInitDict) {
        super("error", eventInitDict);
        this.context = eventInitDict.context;
    }
}
export class ApplicationListenEvent extends Event {
    hostname;
    port;
    secure;
    serverType;
    constructor(eventInitDict) {
        super("listen", eventInitDict);
        this.hostname = eventInitDict.hostname;
        this.port = eventInitDict.port;
        this.secure = eventInitDict.secure;
        this.serverType = eventInitDict.serverType;
    }
}
export class Application extends EventTarget {
    #composedMiddleware;
    #eventHandler;
    #keys;
    #middleware = [];
    #serverConstructor;
    get keys() {
        return this.#keys;
    }
    set keys(keys) {
        if (!keys) {
            this.#keys = undefined;
            return;
        }
        else if (Array.isArray(keys)) {
            this.#keys = new KeyStack(keys);
        }
        else {
            this.#keys = keys;
        }
    }
    proxy;
    state;
    constructor(options = {}) {
        super();
        const { state, keys, proxy, serverConstructor = hasNativeHttp() ? HttpServerNative : HttpServerStd, } = options;
        this.proxy = proxy ?? false;
        this.keys = keys;
        this.state = state ?? {};
        this.#serverConstructor = serverConstructor;
    }
    #getComposed = () => {
        if (!this.#composedMiddleware) {
            this.#composedMiddleware = compose(this.#middleware);
        }
        return this.#composedMiddleware;
    };
    #handleError = (context, error) => {
        if (!(error instanceof Error)) {
            error = new Error(`non-error thrown: ${JSON.stringify(error)}`);
        }
        const { message } = error;
        this.dispatchEvent(new ApplicationErrorEvent({ context, message, error }));
        if (!context.response.writable) {
            return;
        }
        for (const key of context.response.headers.keys()) {
            context.response.headers.delete(key);
        }
        if (error.headers && error.headers instanceof Headers) {
            for (const [key, value] of error.headers) {
                context.response.headers.set(key, value);
            }
        }
        context.response.type = "text";
        const status = context.response.status =
            error instanceof Deno.errors.NotFound
                ? 404
                : error.status && typeof error.status === "number"
                    ? error.status
                    : 500;
        context.response.body = error.expose
            ? error.message
            : STATUS_TEXT.get(status);
    };
    #handleRequest = async (request, secure, state) => {
        const context = new Context(this, request, secure);
        let resolve;
        const handlingPromise = new Promise((res) => resolve = res);
        state.handling.add(handlingPromise);
        if (!state.closing && !state.closed) {
            try {
                await this.#getComposed()(context);
            }
            catch (err) {
                this.#handleError(context, err);
            }
        }
        if (context.respond === false) {
            context.response.destroy();
            resolve();
            state.handling.delete(handlingPromise);
            return;
        }
        let closeResources = true;
        try {
            if (request instanceof NativeRequest) {
                closeResources = false;
                await request.respond(await context.response.toDomResponse());
            }
            else {
                await request.respond(await context.response.toServerResponse());
            }
            if (state.closing) {
                state.server.close();
                state.closed = true;
            }
        }
        catch (err) {
            this.#handleError(context, err);
        }
        finally {
            context.response.destroy(closeResources);
            resolve();
            state.handling.delete(handlingPromise);
        }
    };
    addEventListener(type, listener, options) {
        super.addEventListener(type, listener, options);
    }
    fetchEventHandler() {
        if (this.#eventHandler) {
            return this.#eventHandler;
        }
        return this.#eventHandler = {
            handleEvent: async (requestEvent) => {
                let resolve;
                let reject;
                const responsePromise = new Promise((res, rej) => {
                    resolve = res;
                    reject = rej;
                });
                const respondedPromise = requestEvent.respondWith(responsePromise);
                const response = await this.handle(requestEvent.request);
                if (response) {
                    resolve(response);
                }
                else {
                    reject(new Error("No response returned from app handler."));
                }
                try {
                    await respondedPromise;
                }
                catch (error) {
                    this.dispatchEvent(new ApplicationErrorEvent({ error }));
                }
            },
        };
    }
    handle = (async (request, secureOrConn, secure = false) => {
        if (!this.#middleware.length) {
            throw new TypeError("There is no middleware to process requests.");
        }
        let contextRequest;
        if (request instanceof Request) {
            assert(isConn(secureOrConn) || typeof secureOrConn === "undefined");
            contextRequest = new NativeRequest({
                request,
                respondWith() {
                    return Promise.resolve(undefined);
                },
            }, secureOrConn);
        }
        else {
            assert(typeof secureOrConn === "boolean" ||
                typeof secureOrConn === "undefined");
            secure = secureOrConn ?? false;
            contextRequest = request;
        }
        const context = new Context(this, contextRequest, secure);
        try {
            await this.#getComposed()(context);
        }
        catch (err) {
            this.#handleError(context, err);
        }
        if (context.respond === false) {
            context.response.destroy();
            return;
        }
        try {
            const response = contextRequest instanceof NativeRequest
                ? await context.response.toDomResponse()
                : await context.response.toServerResponse();
            context.response.destroy(false);
            return response;
        }
        catch (err) {
            this.#handleError(context, err);
            throw err;
        }
    });
    async listen(options) {
        if (!this.#middleware.length) {
            throw new TypeError("There is no middleware to process requests.");
        }
        if (typeof options === "string") {
            const match = ADDR_REGEXP.exec(options);
            if (!match) {
                throw TypeError(`Invalid address passed: "${options}"`);
            }
            const [, hostname, portStr] = match;
            options = { hostname, port: parseInt(portStr, 10) };
        }
        const server = new this.#serverConstructor(this, options);
        const { signal } = options;
        const state = {
            closed: false,
            closing: false,
            handling: new Set(),
            server,
        };
        if (signal) {
            signal.addEventListener("abort", () => {
                if (!state.handling.size) {
                    server.close();
                    state.closed = true;
                }
                state.closing = true;
            });
        }
        const { hostname, port, secure = false } = options;
        const serverType = server instanceof HttpServerStd
            ? "std"
            : server instanceof HttpServerNative
                ? "native"
                : "custom";
        this.dispatchEvent(new ApplicationListenEvent({ hostname, port, secure, serverType }));
        try {
            for await (const request of server) {
                this.#handleRequest(request, secure, state);
            }
            await Promise.all(state.handling);
        }
        catch (error) {
            const message = error instanceof Error
                ? error.message
                : "Application Error";
            this.dispatchEvent(new ApplicationErrorEvent({ message, error }));
        }
    }
    use(...middleware) {
        this.#middleware.push(...middleware);
        this.#composedMiddleware = undefined;
        return this;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwbGljYXRpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhcHBsaWNhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFFQSxPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQ3ZDLE9BQU8sRUFBRSxNQUFNLEVBQVUsV0FBVyxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBQ3hELE9BQU8sRUFDTCxhQUFhLEVBQ2IsZ0JBQWdCLEVBQ2hCLGFBQWEsR0FDZCxNQUFNLHlCQUF5QixDQUFDO0FBQ2pDLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUVyRCxPQUFPLEVBQU8sUUFBUSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQzlDLE9BQU8sRUFBRSxPQUFPLEVBQWMsTUFBTSxpQkFBaUIsQ0FBQztBQU10RCxPQUFPLEVBQUUsTUFBTSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBaUhuQyxNQUFNLFdBQVcsR0FBRywrQkFBK0IsQ0FBQztBQUVwRCxNQUFNLE9BQU8scUJBQXVDLFNBQVEsVUFBVTtJQUNwRSxPQUFPLENBQWM7SUFFckIsWUFBWSxhQUEyQztRQUNyRCxLQUFLLENBQUMsT0FBTyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQzlCLElBQUksQ0FBQyxPQUFPLEdBQUcsYUFBYSxDQUFDLE9BQU8sQ0FBQztJQUN2QyxDQUFDO0NBQ0Y7QUFFRCxNQUFNLE9BQU8sc0JBQXVCLFNBQVEsS0FBSztJQUMvQyxRQUFRLENBQVU7SUFDbEIsSUFBSSxDQUFTO0lBQ2IsTUFBTSxDQUFVO0lBQ2hCLFVBQVUsQ0FBOEI7SUFFeEMsWUFBWSxhQUF5QztRQUNuRCxLQUFLLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQy9CLElBQUksQ0FBQyxRQUFRLEdBQUcsYUFBYSxDQUFDLFFBQVEsQ0FBQztRQUN2QyxJQUFJLENBQUMsSUFBSSxHQUFHLGFBQWEsQ0FBQyxJQUFJLENBQUM7UUFDL0IsSUFBSSxDQUFDLE1BQU0s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