import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../src/version";

describe("APP_VERSION", () => {
  it("matches package.json", () => {
    const pkg = JSON.parse(readFileSync(`${process.cwd()}/package.json`, "utf8")) as {
      version: string;
    };
    expect(APP_VERSION).toBe(pkg.version);
  });
});
