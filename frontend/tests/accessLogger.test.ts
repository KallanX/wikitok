import { describe, expect, it } from "vitest";
import {
  sanitizeForLogs,
  sanitizePathForLogs,
  resolveGeoLocation,
  formatLogLine,
  logAccess,
} from "../server/accessLogger";

describe("accessLogger", () => {
  describe("sanitizeForLogs", () => {
    it("strips control characters and ANSI escapes", () => {
      const dirty = "GET \x1b[31m/malicious\x1b[0m\r\nHeader";
      const cleaned = sanitizeForLogs(dirty);
      expect(cleaned).not.toContain("\x1b");
      expect(cleaned).not.toContain("\r");
      expect(cleaned).not.toContain("\n");
    });

    it("handles null or undefined safely", () => {
      expect(sanitizeForLogs(null)).toBe("-");
      expect(sanitizeForLogs(undefined)).toBe("-");
    });

    it("truncates strings exceeding maxLength", () => {
      const long = "A".repeat(300);
      expect(sanitizeForLogs(long, 50).length).toBe(50);
    });
  });

  describe("sanitizePathForLogs", () => {
    it("redacts sensitive query parameter values", () => {
      const pathWithSecret = "/api/test?token=secret123&user=alice&key=mykey";
      const sanitized = sanitizePathForLogs(pathWithSecret);
      expect(sanitized).toContain("token=%5BREDACTED%5D");
      expect(sanitized).toContain("key=%5BREDACTED%5D");
      expect(sanitized).toContain("user=alice");
    });

    it("preserves paths without sensitive query parameters", () => {
      expect(sanitizePathForLogs("/assets/index.js")).toBe("/assets/index.js");
      expect(sanitizePathForLogs("/")).toBe("/");
    });
  });

  describe("resolveGeoLocation", () => {
    it("identifies private LAN and loopback addresses", () => {
      expect(resolveGeoLocation("127.0.0.1")).toBe("LAN / Internal");
      expect(resolveGeoLocation("::1")).toBe("LAN / Internal");
      expect(resolveGeoLocation("192.168.1.50")).toBe("LAN / Internal");
      expect(resolveGeoLocation("10.0.0.1")).toBe("LAN / Internal");
      expect(resolveGeoLocation("172.28.0.1")).toBe("LAN / Internal");
    });

    it("resolves geographic details for public IP addresses", () => {
      const location = resolveGeoLocation("108.11.218.119");
      expect(location).toContain("Mechanicsburg");
      expect(location).toContain("US");
    });

    it("returns Unknown for unknown or unmapped public IPs", () => {
      expect(resolveGeoLocation("unknown")).toBe("Unknown");
      expect(resolveGeoLocation("")).toBe("Unknown");
    });
  });

  describe("formatLogLine", () => {
    it("formats successful status code with green color", () => {
      const line = formatLogLine({
        timestamp: "2026-10-12T14:47:51.121Z",
        method: "GET",
        path: "/",
        status: 200,
        durationMs: 1,
        ip: "108.11.218.119",
        location: "Mechanicsburg, PA, US",
      });
      expect(line).toBe(
        "[2026-10-12T14:47:51.121Z] GET / \x1b[32m200\x1b[0m 1ms - IP: 108.11.218.0 (Mechanicsburg, PA, US)"
      );
    });

    it("formats error status code with red color", () => {
      const line = formatLogLine({
        timestamp: "2026-10-12T14:47:51.121Z",
        method: "GET",
        path: "/.env",
        status: 404,
        durationMs: 0,
        ip: "192.168.1.1",
        location: "LAN / Internal",
      });
      expect(line).toBe(
        "[2026-10-12T14:47:51.121Z] GET /.env \x1b[31m404\x1b[0m 0ms - IP: 192.168.1.1 (LAN / Internal)"
      );
    });
  });

  describe("logAccess", () => {
    it("invokes logger callback with formatted string and returns log entry", () => {
      const loggedLines: string[] = [];
      const entry = logAccess({
        method: "GET",
        url: "http://localhost:3000/",
        status: 200,
        durationMs: 2,
        ip: "127.0.0.1",
        now: () => new Date("2026-10-12T15:00:00.000Z"),
        logger: (line) => loggedLines.push(line),
      });

      expect(loggedLines.length).toBe(1);
      expect(loggedLines[0]).toContain("GET /");
      expect(loggedLines[0]).toContain("127.0.0.1");
      expect(loggedLines[0]).toContain("LAN / Internal");
      expect(entry.status).toBe(200);
      expect(entry.location).toBe("LAN / Internal");
    });
  });
});
