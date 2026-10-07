import { describe, expect, it } from "vitest";
import { resolveClientIp } from "../server/clientIp";
import { createRateLimiter } from "../server/rateLimit";

describe("resolveClientIp", () => {
  it("ignores a forged forwarding header from a public client", () => {
    expect(
      resolveClientIp({
        peer: "203.0.113.8",
        forwardedFor: "1.2.3.4",
        trustProxy: "loopback, linklocal, uniquelocal",
      })
    ).toBe("203.0.113.8");
  });

  it("uses the nearest untrusted hop when the peer is a trusted proxy", () => {
    expect(
      resolveClientIp({
        peer: "127.0.0.1",
        forwardedFor: "1.2.3.4, 203.0.113.8",
        trustProxy: "loopback",
      })
    ).toBe("203.0.113.8");
  });

  it("rejects oversized non-ip keys", () => {
    expect(
      resolveClientIp({
        peer: "127.0.0.1",
        forwardedFor: `${"A".repeat(5000)}, 198.51.100.20`,
        trustProxy: "loopback",
      })
    ).toBe("198.51.100.20");
  });
});

describe("createRateLimiter", () => {
  it("blocks once the fixed window is full and caps stored keys", () => {
    let time = 1_000;
    const limiter = createRateLimiter(2, { now: () => time, maxEntries: 3 });
    expect(limiter.check("203.0.113.1")).toBe(true);
    expect(limiter.check("203.0.113.1")).toBe(true);
    expect(limiter.check("203.0.113.1")).toBe(false);

    limiter.check("203.0.113.2");
    limiter.check("203.0.113.3");
    limiter.check("203.0.113.4");
    expect(limiter.size()).toBeLessThanOrEqual(3);

    time += 61_000;
    expect(limiter.check("203.0.113.1")).toBe(true);
  });
});
