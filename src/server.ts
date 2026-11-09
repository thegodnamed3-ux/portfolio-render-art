import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * One address for visitors and Google: pages opened on the old Lovable address (or the other
 * spelling of the domain) move permanently to the main domain, same path. API calls and
 * server functions (Telegram webhook, forms) are never redirected.
 */
const CANONICAL_HOST = "thegodnamed.ee";
// www ↔ root is left to Lovable's own domain settings (so the two can never bounce between each other).
const OLD_HOSTS = new Set(["thegodnamed.lovable.app"]);
function redirectToCanonical(request: Request): Response | null {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  if (!OLD_HOSTS.has(url.hostname.toLowerCase())) return null;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_serverFn")) return null;
  url.protocol = "https:";
  url.hostname = CANONICAL_HOST;
  url.port = "";
  return new Response(null, { status: 301, headers: { location: url.toString(), "cache-control": "public, max-age=3600" } });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const moved = redirectToCanonical(request);
    if (moved) return moved;
    // The usual address crawlers try first: /sitemap.xml serves the sitemap.
    const u = new URL(request.url);
    if (u.pathname === "/sitemap.xml") { u.pathname = "/api/sitemap"; request = new Request(u.toString(), request); }
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
