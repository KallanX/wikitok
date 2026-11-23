const SEEN_KEY = "wikitok.seen";
const HIDDEN_KEY = "wikitok.hidden";
const HISTORY_KEY = "wikitok.history";
export const HIDE_SENSITIVE_KEY = "wikitok.hideSensitive";

function readList(key: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]") as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

function writeList(key: string, values: string[], limit: number): void {
  try {
    localStorage.setItem(key, JSON.stringify(values.slice(-limit)));
  } catch {
    // Quota failures are surfaced by the likes store. Seen/hidden can drop quietly.
  }
}

export function loadSeen(): string[] {
  return readList(SEEN_KEY);
}

export function loadHidden(): string[] {
  return readList(HIDDEN_KEY);
}

export function rememberSeen(key: string): void {
  const next = readList(SEEN_KEY).filter((item) => item !== key);
  next.push(key);
  writeList(SEEN_KEY, next, 400);
}

export function rememberHidden(key: string): void {
  const next = readList(HIDDEN_KEY).filter((item) => item !== key);
  next.push(key);
  writeList(HIDDEN_KEY, next, 400);
}

export function loadHistory<T>(): T[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory<T>(items: T[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 40)));
  } catch {
    // History is a convenience. A full disk should not break the feed.
  }
}

export function loadHideSensitive(): boolean {
  try {
    const saved = localStorage.getItem(HIDE_SENSITIVE_KEY);
    if (saved == null) return true;
    return saved !== "false";
  } catch {
    return true;
  }
}

export function saveHideSensitive(value: boolean): void {
  try {
    localStorage.setItem(HIDE_SENSITIVE_KEY, value ? "true" : "false");
  } catch {
    // The in-memory toggle still applies for this session.
  }
}
