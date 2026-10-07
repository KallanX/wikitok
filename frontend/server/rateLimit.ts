export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;

/**
 * Fixed-window counter. Keys are capped so a forged address list cannot grow memory.
 */
export function createRateLimiter(
  limit: number,
  options?: { now?: () => number; maxEntries?: number }
) {
  const now = options?.now ?? (() => Date.now());
  const maxEntries = options?.maxEntries ?? 10_000;
  const records = new Map<string, RateLimitRecord>();

  const prune = (time = now()) => {
    for (const [key, record] of records) {
      if (time > record.resetAt) records.delete(key);
    }
  };

  const evictOldest = () => {
    while (records.size >= maxEntries) {
      const oldest = records.keys().next().value;
      if (oldest === undefined) break;
      records.delete(oldest);
    }
  };

  return {
    check(ip: string): boolean {
      const time = now();
      const key = ip.slice(0, 128) || "unknown";
      const existing = records.get(key);
      if (!existing || time > existing.resetAt) {
        if (existing && time > existing.resetAt) records.delete(key);
        if (!records.has(key)) {
          prune(time);
          evictOldest();
        }
        records.set(key, { count: 1, resetAt: time + WINDOW_MS });
        return true;
      }
      if (existing.count >= limit) return false;
      existing.count += 1;
      return true;
    },
    prune,
    size: () => records.size,
  };
}
