/*!
 * Adapted from koa-send at https://github.com/koajs/send and which is licensed
 * with the MIT license.
 */
import { calculate, ifNoneMatch } from "./etag.ts";
import { createHttpError } from "./httpError.ts";
import { basename, extname, parse, readAll } from "./deps.ts";
import { decodeComponent, resolvePath } from "./util.ts";
const MAXBUFFER_DEFAULT = 1_048_576;
function isHidden(path) {
    const pathArr = path.split("/");
    for (const segment of pathArr) {
        if (segment[0] === "." && segment !== "." && segment !== "..") {
            return true;
        }
        return false;
    }
}
async function exists(path) {
    try {
        return (await Deno.stat(path)).isFile;
    }
    catch {
        return false;
    }
}
async function getEntity(path, mtime, stats, maxbuffer, response) {
    let body;
    let entity;
    const file = await Deno.open(path, { read: true });
    if (stats.size < maxbuffer) {
        const buffer = await readAll(file);
        file.close();
        body = entity = buffer;
    }
    else {
        response.addResource(file.rid);
        body = file;
        entity = {
            mtime: new Date(mtime),
            size: stats.size,
        };
    }
    return [body, entity];
}
export async function send({ request, response }, path, options = { root: "" }) {
    const { brotli = true, extensions, format = true, gzip = true, hidden = false, immutable = false, index, maxbuffer = MAXBUFFER_DEFAULT, maxage = 0, root, } = options;
    const trailingSlash = path[path.length - 1] === "/";
    path = decodeComponent(path.substr(parse(path).root.length));
    if (index && trailingSlash) {
        path += index;
    }
    if (!hidden && isHidden(path)) {
        throw createHttpError(403);
    }
    path = resolvePath(root, path);
    let encodingExt = "";
    if (brotli &&
        request.acceptsEncodings("br", "identity") === "br" &&
        (await exists(`${path}.br`))) {
        path = `${path}.br`;
        response.headers.set("Content-Encoding", "br");
        response.headers.delete("Content-Length");
        encodingExt = ".br";
    }
    else if (gzip &&
        request.acceptsEncodings("gzip", "identity") === "gzip" &&
        (await exists(`${path}.gz`))) {
        path = `${path}.gz`;
        response.headers.set("Content-Encoding", "gzip");
        response.headers.delete("Content-Length");
        encodingExt = ".gz";
    }
    if (extensions && !/\.[^/]*$/.exec(path)) {
        for (let ext of extensions) {
            if (!/^\./.exec(ext)) {
                ext = `.${ext}`;
            }
            if (await exists(`${path}${ext}`)) {
                path += ext;
                break;
            }
        }
    }
    let stats;
    try {
        stats = await Deno.stat(path);
        if (stats.isDirectory) {
            if (format && index) {
                path += `/${index}`;
                stats = await Deno.stat(path);
            }
            else {
                return;
            }
        }
    }
    catch (err) {
        if (err instanceof Deno.errors.NotFound) {
            throw createHttpError(404, err.message);
        }
        throw createHttpError(500, err.message);
    }
    let mtime = null;
    if (response.headers.has("Last-Modified")) {
        mtime = new Date(response.headers.get("Last-Modified")).getTime();
    }
    else if (stats.mtime) {
        mtime = stats.mtime.getTime();
        mtime -= mtime % 1000;
        response.headers.set("Last-Modified", new Date(mtime).toUTCString());
    }
    if (!response.headers.has("Cache-Control")) {
        const directives = [`max-age=${(maxage / 1000) | 0}`];
        if (immutable) {
            directives.push("immutable");
        }
        response.headers.set("Cache-Control", directives.join(","));
    }
    if (!response.type) {
        response.type = encodingExt !== ""
            ? extname(basename(path, encodingExt))
            : extname(path);
    }
    let entity = null;
    let body = null;
    if (request.headers.has("If-None-Match") && mtime) {
        [body, entity] = await getEntity(path, mtime, stats, maxbuffer, response);
        if (!ifNoneMatch(request.headers.get("If-None-Match"), entity)) {
            response.headers.set("ETag", calculate(entity));
            response.status = 304;
            return path;
        }
    }
    if (request.headers.has("If-Modified-Since") && mtime) {
        const ifModifiedSince = new Date(request.headers.get("If-Modified-Since"));
        if (ifModifiedSince.getTime() >= mtime) {
            response.status = 304;
            return path;
        }
    }
    response.headers.set("Content-Length", String(stats.size));
    if (!body || !entity) {
        [body, entity] = await getEntity(path, mtime ?? 0, stats, maxbuffer, response);
    }
    if (!response.headers.has("ETag")) {
        response.headers.set("ETag", calculate(entity));
    }
    response.body = body;
    return path;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VuZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInNlbmQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7OztHQUdHO0FBR0gsT0FBTyxFQUFFLFNBQVMsRUFBWSxXQUFXLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDN0QsT0FBTyxFQUFFLGVBQWUsRUFBRSxNQUFNLGdCQUFnQixDQUFDO0FBQ2pELE9BQU8sRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFOUQsT0FBTyxFQUFFLGVBQWUsRUFBRSxXQUFXLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFFekQsTUFBTSxpQkFBaUIsR0FBRyxTQUFTLENBQUM7QUFpRHBDLFNBQVMsUUFBUSxDQUFDLElBQVk7SUFDNUIsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUNoQyxLQUFLLE1BQU0sT0FBTyxJQUFJLE9BQU8sRUFBRTtRQUM3QixJQUFJLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxHQUFHLElBQUksT0FBTyxLQUFLLEdBQUcsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1lBQzdELE9BQU8sSUFBSSxDQUFDO1NBQ2I7UUFDRCxPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQztBQUVELEtBQUssVUFBVSxNQUFNLENBQUMsSUFBWTtJQUNoQyxJQUFJO1FBQ0YsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztLQUN2QztJQUFDLE1BQU07UUFDTixPQUFPLEtBQUssQ0FBQztLQUNkO0FBQ0gsQ0FBQztBQUVELEtBQUssVUFBVSxTQUFTLENBQ3RCLElBQVksRUFDWixLQUFhLEVBQ2IsS0FBb0IsRUFDcEIsU0FBaUIsRUFDakIsUUFBa0I7SUFFbEIsSUFBSSxJQUE0QixDQUFDO0lBQ2pDLElBQUksTUFBNkIsQ0FBQztJ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