import { createServer } from "node:http";
import { httpServerHandler } from "cloudflare:node";

const API_PREFIX = "/api";
const API_HEALTH_PATHS = new Set(["/health", "/api/health"]);

let apiHandlerPromise = null;

function isApiRequest(pathname) {
  return (
    pathname === API_PREFIX ||
    pathname.startsWith(`${API_PREFIX}/`) ||
    API_HEALTH_PATHS.has(pathname)
  );
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

export default {
  async fetch(request, env, ctx) {
    const pathname = new URL(request.url).pathname;

    if (isApiRequest(pathname)) {
      const apiHandler = await getApiHandler(env);
      return apiHandler.fetch(request, env, ctx);
    }

    return env.ASSETS.fetch(request);
  },
};
