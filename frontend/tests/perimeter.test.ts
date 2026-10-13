import { describe, expect, it } from "vitest";
import {
  hasDotfileSegment,
  isSensitiveProbe,
  SENSITIVE_EXTENSIONS_REGEX,
  SENSITIVE_PROBES_REGEX,
} from "../server/perimeter";

describe("perimeter defense", () => {
  describe("hasDotfileSegment", () => {
    it("detects hidden dotfile paths and segments", () => {
      expect(hasDotfileSegment("/.env")).toBe(true);
      expect(hasDotfileSegment("/.git")).toBe(true);
      expect(hasDotfileSegment("/.git/config")).toBe(true);
      expect(hasDotfileSegment("/subdir/.secret")).toBe(true);
    });

    it("allows standard paths and .well-known", () => {
      expect(hasDotfileSegment("/")).toBe(false);
      expect(hasDotfileSegment("/index.html")).toBe(false);
      expect(hasDotfileSegment("/.well-known/acme-challenge/abc")).toBe(false);
      expect(hasDotfileSegment("/assets/index.js")).toBe(false);
    });
  });

  describe("SENSITIVE_EXTENSIONS_REGEX", () => {
    it("matches dangerous and sensitive extensions", () => {
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/app.php")).toBe(true);
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/db.sql")).toBe(true);
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/debug.log")).toBe(true);
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/backup.bak")).toBe(true);
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/cert.pem")).toBe(true);
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/script.sh")).toBe(true);
    });

    it("allows standard web asset extensions", () => {
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/index.html")).toBe(false);
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/assets/app.js")).toBe(false);
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/assets/style.css")).toBe(false);
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/flags/us.svg")).toBe(false);
      expect(SENSITIVE_EXTENSIONS_REGEX.test("/icon.png")).toBe(false);
    });
  });

  describe("SENSITIVE_PROBES_REGEX", () => {
    it("matches all probe targets observed in scanner traffic", () => {
      const scannerProbes = [
        "/Dockerfile",
        "/_profiler/phpinfo",
        "/app.config.js",
        "/appsettings.Development.json",
        "/appsettings.Production.json",
        "/appsettings.json",
        "/auth.json",
        "/aws-exports.js",
        "/composer.json",
        "/config.js",
        "/config.json",
        "/config/config.js",
        "/credentials",
        "/credentials.json",
        "/env",
        "/env-config.js",
        "/env.js",
        "/env.txt",
        "/phpinfo",
        "/runtime-config.js",
        "/secrets.json",
        "/settings.json",
        "/vendor/composer/installed.json",
        "/wp-content/debug.log",
        "/wp-admin",
        "/wp-config",
        "/actuator/health",
        "/server-status",
      ];

      for (const probe of scannerProbes) {
        expect(SENSITIVE_PROBES_REGEX.test(probe), `Failed for ${probe}`).toBe(true);
      }
    });

    it("does not false-positive on legitimate application assets", () => {
      const legitimateAssets = [
        "/",
        "/index.html",
        "/assets/index-BXEPrZFj.css",
        "/assets/index-BHk4qCQL.js",
        "/flags/us.svg",
        "/flags/de.svg",
        "/flags/es-ct.svg",
        "/manifest.json",
        "/sw.js",
        "/registerSW.js",
        "/workbox-e3490c72.js",
        "/favicon.ico",
        "/favicon.svg",
        "/wiki-logo.svg",
        "/apple-touch-icon.png",
        "/web-app-manifest-192x192.png",
        "/web-app-manifest-512x512.png",
        "/robots.txt",
      ];

      for (const asset of legitimateAssets) {
        expect(SENSITIVE_PROBES_REGEX.test(asset), `False positive on ${asset}`).toBe(false);
      }
    });
  });

  describe("isSensitiveProbe", () => {
    it("blocks both sensitive extensions and probe paths", () => {
      expect(isSensitiveProbe("/Dockerfile")).toBe(true);
      expect(isSensitiveProbe("/env")).toBe(true);
      expect(isSensitiveProbe("/credentials")).toBe(true);
      expect(isSensitiveProbe("/_profiler/phpinfo")).toBe(true);
      expect(isSensitiveProbe("/dump.sql")).toBe(true);
    });

    it("allows clean application assets", () => {
      expect(isSensitiveProbe("/")).toBe(false);
      expect(isSensitiveProbe("/index.html")).toBe(false);
      expect(isSensitiveProbe("/sw.js")).toBe(false);
      expect(isSensitiveProbe("/assets/index-123.js")).toBe(false);
      expect(isSensitiveProbe("/flags/us.svg")).toBe(false);
    });
  });
});
