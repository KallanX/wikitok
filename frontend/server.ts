import path from "node:path";
import fs from "node:fs";
import { resolveClientIp } from "./server/clientIp.ts";
import { createRateLimiter } from "./server/rateLimit.ts";
import { logAccess } from "./server/accessLogger.ts";
import { hasDotfileSegment, isSensitiveProbe } from "./server/perimeter.ts";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const DIST_DIR = path.resolve(process.env.DIST_DIR || "./dist");
const RATE_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE) || 120;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const ENABLE_SPA_FALLBACK = process.env.ENABLE_SPA_FALLBACK === "true";

// Content Security Policy tailored for WikiTok SPA & Wikipedia media/data APIs
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.wikimedia.org https://*.wikipedia.org",
  "connect-src 'self' https://*.wikipedia.org https://*.wikimedia.org",
  "font-src 'self' data:",
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join("; ");

// Comprehensive modern security response headers applied to all responses
const BASE_SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP_DIRECTIVES,
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

// Fixed-window limiter. TRUST_PROXY decides when X-Forwarded-For is honored.
const TRUST_PROXY = process.env.TRUST_PROXY ?? "";
const rateLimiter = createRateLimiter(RATE_LIMIT_PER_MINUTE);

const cleanupTimer = setInterval(() => {
  rateLimiter.prune();
}, 5 * 60 * 1000);
cleanupTimer.unref?.();

interface BunServerLike {
  requestIP?: (req: Request) => { address?: string } | null;
}

function getClientIp(req: Request, serverInstance?: BunServerLike): string {
  let peer: string | undefined;
  try {
    peer = serverInstance?.requestIP?.(req)?.address;
  } catch {
    peer = undefined;
  }
  return resolveClientIp({
    peer,
    forwardedFor: req.headers.get("x-forwarded-for"),
    realIp: req.headers.get("x-real-ip"),
    trustProxy: TRUST_PROXY,
  });
}

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

function handleRequest(req: Request, url: URL, clientIp: string): Response {
  // 2. Allow CORS preflight if CORS_ORIGIN is explicitly configured
  if (req.method === "OPTIONS") {
    const headers = new Headers(BASE_SECURITY_HEADERS);
    if (CORS_ORIGIN) {
      headers.set("Access-Control-Allow-Origin", CORS_ORIGIN);
      headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      headers.set("Vary", "Origin");
    }
    return new Response(null, { status: 204, headers });
  }

  // 3. Only allow safe GET and HEAD requests for static hosting
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: {
        ...BASE_SECURITY_HEADERS,
        Allow: "GET, HEAD, OPTIONS",
      },
    });
  }

  // 4. URL length limit to prevent buffer/fuzzing overflow attempts
  if (req.url.length > 2048) {
    return new Response("URI Too Long", {
      status: 414,
      headers: BASE_SECURITY_HEADERS,
    });
  }

  // 5. Rate limiting perimeter
  if (!rateLimiter.check(clientIp)) {
    return new Response("Too Many Requests", {
      status: 429,
      headers: {
        ...BASE_SECURITY_HEADERS,
        "Retry-After": "60",
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

  // 6. Perimeter defense: Reject hidden dotfiles or directories (.env, .git, etc.)
  if (hasDotfileSegment(pathname)) {
    return new Response("Not Found", {
      status: 404,
      headers: BASE_SECURITY_HEADERS,
    });
  }

  // 7. Perimeter defense: Block probing for sensitive extensions and probe paths (.env, Dockerfile, phpinfo, credentials, etc.)
  if (isSensitiveProbe(pathname)) {
    return new Response("Not Found", {
      status: 404,
      headers: BASE_SECURITY_HEADERS,
    });
  }

  // 8. Canonical path traversal defense
  const normalized = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  if (normalized.includes("..")) {
    return new Response("Forbidden", {
      status: 403,
      headers: BASE_SECURITY_HEADERS,
    });
  }

  const lookupPath = pathname === "/" ? "/index.html" : pathname;

  // 9. Check if exact requested file is in our pre-indexed static map
  const entry = staticFiles.get(lookupPath);
  if (entry) {
    const responseHeaders = new Headers(entry.headers);
    if (entry.file.type) responseHeaders.set("Content-Type", entry.file.type);
    if (Number.isFinite(entry.file.size) && entry.file.size > 0) {
      responseHeaders.set("Content-Length", String(entry.file.size));
    }
    if (CORS_ORIGIN) {
      headersWithCors(responseHeaders);
    }
    return new Response(req.method === "HEAD" ? null : entry.file, {
      headers: responseHeaders,
    });
  }

  // 10. SPA Fallback: WikiTok is a single-route application where all client state lives at "/".
  // If SPA fallback is explicitly enabled via ENABLE_SPA_FALLBACK=true and the path has no extension,
  // serve index.html. Otherwise, return 404 for any unindexed path to eliminate false 200 responses.
  if (ENABLE_SPA_FALLBACK && path.extname(lookupPath) === "" && indexEntry) {
    const responseHeaders = new Headers(indexEntry.headers);
    if (CORS_ORIGIN) {
      headersWithCors(responseHeaders);
    }
    return new Response(req.method === "HEAD" ? null : indexEntry.file, {
      headers: responseHeaders,
    });
  }

  return new Response("Not Found", {
    status: 404,
    headers: BASE_SECURITY_HEADERS,
  });
}

function headersWithCors(headers: Headers): void {
  headers.set("Access-Control-Allow-Origin", CORS_ORIGIN);
  headers.set("Vary", "Origin");
}

const server = Bun.serve({
  port: PORT,
  hostname: HOST,
  fetch(req) {
    const start = performance.now();
    const url = new URL(req.url);

    // 1. Health check endpoint for Docker and load balancers (bypass access logging to prevent log flooding)
    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return new Response("OK", {
        status: 200,
        headers: {
          ...BASE_SECURITY_HEADERS,
          "Content-Type": "text/plain; charset=utf-8",
        },
      });
    }

    const clientIp = getClientIp(req, server);
    let response: Response;
    try {
      response = handleRequest(req, url, clientIp);
    } catch {
      response = new Response("Internal Server Error", {
        status: 500,
        headers: BASE_SECURITY_HEADERS,
      });
    }

    const durationMs = Math.round(performance.now() - start);

    logAccess({
      method: req.method,
      url: req.url,
      status: response.status,
      durationMs,
      ip: clientIp,
      userAgent: req.headers.get("user-agent"),
    });

    return response;
  },
});

console.log(
  `WikiTok hardened server running on http://${HOST}:${PORT} (${staticFiles.size} static files indexed, rate limit: ${RATE_LIMIT_PER_MINUTE} req/min)`
);
