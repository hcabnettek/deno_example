import { serve, serveTLS } from "./deps.ts";
import { isListenTlsOptions } from "./util.ts";
export class HttpServerStd {
    #server;
    constructor(_app, options) {
        this.#server = isListenTlsOptions(options)
            ? serveTLS(options)
            : serve(options);
    }
    close() {
        this.#server.close();
    }
    [Symbol.asyncIterator]() {
        return this.#server[Symbol.asyncIterator]();
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaHR0cF9zZXJ2ZXJfc3RkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiaHR0cF9zZXJ2ZXJfc3RkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUdBLE9BQU8sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sV0FBVyxDQUFDO0FBRzVDLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQTZCL0MsTUFBTSxPQUFPLGFBQWE7SUFFeEIsT0FBTyxDQUFZO0lBRW5CLFlBQ0UsSUFBcUIsRUFDckIsT0FBbUQ7UUFFbkQsSUFBSSxDQUFDLE9BQU8sR0FBRyxrQkFBa0IsQ0FBQyxPQUFPLENBQUM7WUFDeEMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7WUFDbkIsQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBRUQsS0FBSztRQUNILElBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUM7SUFDdkIsQ0FBQztJQUVELENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQztRQUNwQixPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUM7SUFDOUMsQ0FBQztDQUNGIn0=