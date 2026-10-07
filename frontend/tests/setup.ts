import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

const memory = new Map<string, string>();

const storage = {
  get length() {
    return memory.size;
  },
  clear: () => memory.clear(),
  getItem: (key: string) => (memory.has(key) ? memory.get(key)! : null),
  key: (index: number) => [...memory.keys()][index] ?? null,
  removeItem: (key: string) => {
    memory.delete(key);
  },
  setItem: (key: string, value: string) => {
    memory.set(key, String(value));
  },
};

vi.stubGlobal("localStorage", storage);

beforeEach(() => {
  memory.clear();
});

afterEach(() => {
  cleanup();
});
