import path from "node:path";
import fs from "node:fs";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DIST_DIR = path.resolve(process.env.DIST_DIR || "./dist");

// Security response headers applied to all responses
const BASE_SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

interface StaticEntry {
  file: ReturnType<typeof Bun.file>;
  headers: Headers;
}

// Pre-index dist files into memory at startup for O(1) lookups and zero disk I/O per request
const staticFiles = new Map<string, StaticEntry>();

function indexStaticDirectory(dir: string, urlPrefix = ""): void {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const relUrl = urlPrefix ? `${urlPrefix}/${entry.name}` : `/${entry.name}`;
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      indexStaticDirectory(fullPath, relUrl);
    } else {
      const file = Bun.file(fullPath);
      const headers = new Headers(BASE_SECURITY_HEADERS);

      if (relUrl.startsWith("/assets/")) {
        // Content-hashed bundle assets: cache for 1 year immutable
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
      } else if (
        relUrl === "/index.html" ||
        relUrl === "/sw.js" ||
        relUrl === "/registerSW.js" ||
        relUrl === "/manifest.webmanifest" ||
        relUrl === "/manifest.json"
      ) {
        // App shell and service worker assets must revalidate immediately
        headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
      } else {
        // Other static assets (favicons, static images): cache for 1 day
        headers.set("Cache-Control", "public, max-age=86400");
      }

      staticFiles.set(relUrl, { file, headers });
    }
  }
}

indexStaticDirectory(DIST_DIR);

const indexEntry = staticFiles.get("/index.html");
if (!indexEntry) {
  console.warn(`Warning: /index.html not found in ${DIST_DIR}`);
}

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch(req) {
    // Only allow GET and HEAD requests for static hosting
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: BASE_SECURITY_HEADERS,
      });
    }

    const url = new URL(req.url);

    // Health check endpoint for Docker and load balancers
    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return new Response("OK", {
        status: 200,
        headers: {
          ...BASE_SECURITY_HEADERS,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    let pathname: string;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad Request", {
        status: 400,
        headers: BASE_SECURITY_HEADERS,
      });
    }

    if (pathname === "/") {
      pathname = "/index.html";
    }

    // 1. Check if the exact requested file is in our pre-indexed static map
    const entry = staticFiles.get(pathname);
    if (entry) {
      return new Response(req.method === "HEAD" ? null : entry.file, {
        headers: entry.headers,
      });
    }

    // 2. If a specific file was requested (has extension) but doesn't exist -> 404
    const hasExtension = path.extname(pathname) !== "";
    if (hasExtension) {
      return new Response("Not Found", {
        status: 404,
        headers: BASE_SECURITY_HEADERS,
      });
    }

    // 3. SPA Fallback: serve index.html for navigation routes
    if (indexEntry) {
      return new Response(req.method === "HEAD" ? null : indexEntry.file, {
        headers: indexEntry.headers,
      });
    }

    return new Response("Not Found", {
      status: 404,
      headers: BASE_SECURITY_HEADERS,
    });
  },
});

console.log(
  `WikiTok server running on http://${HOST}:${PORT} (${staticFiles.size} static files indexed)`
);
