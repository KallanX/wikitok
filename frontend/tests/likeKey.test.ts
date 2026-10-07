import { describe, expect, it } from "vitest";
import { likeKey } from "../src/lib/likeKey";

describe("likeKey", () => {
  it("separates the same page id across languages", () => {
    expect(likeKey({ lang: "en", pageid: 42 })).not.toBe(likeKey({ lang: "fr", pageid: 42 }));
  });

  it("uses the article host for saves that predate the language field", () => {
    expect(
      likeKey({ pageid: 42, url: "https://fr.wikipedia.org/wiki/Paris" })
    ).toBe("fr.wikipedia.org:42");
    expect(
      likeKey({ pageid: 42, url: "https://en.wikipedia.org/wiki/Paris" })
    ).toBe("en.wikipedia.org:42");
  });
});
