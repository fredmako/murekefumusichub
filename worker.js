import { createServer } from "node:http";
import { httpServerHandler } from "cloudflare:node";

const API_PREFIX = "/api";
const API_HEALTH_PATHS = new Set(["/health", "/api/health"]);
const HTML_METHODS = new Set(["GET", "HEAD"]);

let apiHandlerPromise = null;

function isApiRequest(pathname) {
  return (
    pathname === API_PREFIX ||
    pathname.startsWith(`${API_PREFIX}/`) ||
    API_HEALTH_PATHS.has(pathname)
  );
}

function isSpaNavigation(request, pathname) {
  if (!HTML_METHODS.has(request.method)) return false;
  if (pathname === "/") return true;

  const acceptsHtml = request.headers.get("accept")?.includes("text/html");
  const lastPathSegment = pathname.split("/").at(-1) || "";
  return acceptsHtml && !lastPathSegment.includes(".");
}

async function getApiHandler(env) {
  if (!apiHandlerPromise) {
    for (const [key, value] of Object.entries(env || {})) {
      if (typeof value === "string" && !(key in process.env)) {
        process.env[key] = value;
      }
    }

    apiHandlerPromise = import("./server/index.js").then(({ default: app }) => {
      const server = createServer(app);
      return httpServerHandler(server);
    });
  }

  return apiHandlerPromise;
}

async function serveFrontendAsset(request, env, pathname) {
  // Request the generated entry document explicitly for the root and browser
  // navigations. This keeps SPA fallback in Worker code and avoids returning
  // index.html for missing JS/CSS/image files.
  if (isSpaNavigation(request, pathname)) {
    const indexUrl = new URL(request.url);
    indexUrl.pathname = "/index.html";
    return env.ASSETS.fetch(new Request(indexUrl, request));
  }

  return env.ASSETS.fetch(request);
}

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;

    if (isApiRequest(pathname)) {
      const apiHandler = await getApiHandler(env);
      return apiHandler.fetch(request, env, ctx);
    }

    return serveFrontendAsset(request, env, pathname);
  },
};
