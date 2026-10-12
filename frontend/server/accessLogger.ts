import geoip from "geoip-lite";
import { isPrivateIp } from "./clientIp.ts";

export interface LogEntry {
  timestamp: string;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string;
  location: string;
  userAgent?: string;
}

/**
 * Strips ASCII control characters and ANSI escape sequences to prevent log injection.
 */
export function sanitizeForLogs(str: string | null | undefined, maxLength = 255): string {
  if (!str || typeof str !== "string") return "-";
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1F\x7F-\x9F]/g, "").slice(0, maxLength);
}

/**
 * Sanitizes URL paths for logging, stripping sensitive query parameter values
 * like admin secrets, authentication tokens, or passwords.
 */
export function sanitizePathForLogs(rawUrl: string): string {
  if (!rawUrl || typeof rawUrl !== "string") return "-";
  try {
    const urlObj = new URL(rawUrl, "http://localhost");
    const sensitiveKeys = [
      "key",
      "token",
      "secret",
      "password",
      "adminkey",
      "admin_key",
      "admin-key",
    ];
    for (const k of Array.from(urlObj.searchParams.keys())) {
      if (sensitiveKeys.includes(k.toLowerCase())) {
        urlObj.searchParams.set(k, "[REDACTED]");
      }
    }
    const cleanPath = urlObj.pathname + (urlObj.search ? urlObj.search : "");
    return sanitizeForLogs(cleanPath, 200);
  } catch {
    return sanitizeForLogs(rawUrl.split("?")[0], 200);
  }
}

/**
 * Resolves geographical location for an IP address.
 */
export function resolveGeoLocation(ip: string): string {
  if (!ip || ip === "unknown") return "Unknown";
  if (isPrivateIp(ip)) {
    return "LAN / Internal";
  }

  try {
    const geo = geoip.lookup(ip);
    if (geo) {
      const parts = [geo.city, geo.region, geo.country].filter(Boolean);
      return parts.join(", ") || "Unknown Location";
    }
    return "Unknown";
  } catch {
    return "Lookup Failed";
  }
}

/**
 * Formats a log entry into the standard colored terminal string.
 * Example: [2026-10-12T14:47:51.121Z] GET / 200 1ms - IP: 108.11.218.119 (Mechanicsburg, PA, US)
 */
export function formatLogLine(entry: LogEntry): string {
  const statusColor = entry.status >= 400 ? "\x1b[31m" : "\x1b[32m";
  const reset = "\x1b[0m";
  return `[${entry.timestamp}] ${entry.method} ${entry.path} ${statusColor}${entry.status}${reset} ${entry.durationMs}ms - IP: ${entry.ip} (${entry.location})`;
}

/**
 * Logs an HTTP request to stdout with IP and GeoIP information.
 */
export function logAccess(params: {
  method: string;
  url: string;
  status: number;
  durationMs: number;
  ip: string;
  userAgent?: string | null;
  location?: string;
  now?: () => Date;
  logger?: (line: string) => void;
}): LogEntry {
  const sanitizedMethod = sanitizeForLogs(params.method, 10);
  const sanitizedPath = sanitizePathForLogs(params.url);
  const sanitizedUserAgent = sanitizeForLogs(params.userAgent || "-", 250);
  const location = params.location ?? resolveGeoLocation(params.ip);
  const sanitizedLocation = sanitizeForLogs(location, 100);
  const timestamp = (params.now ? params.now() : new Date()).toISOString();

  const entry: LogEntry = {
    timestamp,
    method: sanitizedMethod,
    path: sanitizedPath,
    status: params.status,
    durationMs: Math.max(0, params.durationMs),
    ip: params.ip,
    location: sanitizedLocation,
    userAgent: sanitizedUserAgent,
  };

  const line = formatLogLine(entry);
  (params.logger ?? console.log)(line);
  return entry;
}
