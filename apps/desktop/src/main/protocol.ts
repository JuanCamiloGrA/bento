import { net, Protocol } from "electron";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BENTO_ORIGIN } from "../shared/contracts";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

interface ApiProxy {
  apiFetch(pathname: string, init?: RequestInit): Promise<Response>;
}

export function registerBentoProtocol(protocol: Protocol, rendererRoot: string, api: ApiProxy): void {
  protocol.handle("bento", async (request) => {
    const url = new URL(request.url);
    if (url.host !== "app") return new Response("Not found", { status: 404 });
    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      const headers = new Headers(request.headers);
      headers.delete("authorization");
      headers.delete("cookie");
      headers.delete("origin");
      return api.apiFetch(`${url.pathname}${url.search}`, {
        method: request.method,
        headers,
        body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
        // Chromium's ReadableStream request body requires this Node fetch extension.
        duplex: request.body ? "half" : undefined,
      } as RequestInit);
    }

    const decoded = safeDecode(url.pathname);
    const requested = decoded === "/" ? "index.html" : decoded.replace(/^\/+/, "");
    let filePath = resolve(rendererRoot, requested);
    if (!safeDescendant(rendererRoot, filePath)) return new Response("Bad request", { status: 400 });
    if (!extname(requested)) filePath = resolve(rendererRoot, "index.html");
    if (!safeDescendant(rendererRoot, filePath)) return new Response("Bad request", { status: 400 });
    const response = await net.fetch(pathToFileURL(filePath).toString());
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", CSP);
    headers.set("Cross-Origin-Opener-Policy", "same-origin");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "no-referrer");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  });
}

export function isAllowedNavigation(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "bento:" && url.host === "app" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return "/invalid";
  }
}

function safeDescendant(root: string, candidate: string): boolean {
  const child = relative(resolve(root), candidate);
  return child !== "" && !child.startsWith("..") && !isAbsolute(child);
}

export { BENTO_ORIGIN, CSP };
