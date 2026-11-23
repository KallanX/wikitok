import { describe, expect, it } from "vitest";
import { LANGUAGES } from "../src/languages";
import { pagesFromPayload } from "../src/lib/wikiFeed";
import { looksSensitive, isDisambiguation } from "../src/lib/sensitive";
import { appArticleHref, readFeedLocation, withVariant } from "../src/lib/variantUrl";
import { languageFromNavigator } from "../src/lib/language";
import { redactIp } from "../server/clientIp";

const english = LANGUAGES[0];

describe("feed filters", () => {
  it("requires a photo and drops disambiguation pages", () => {
    const articles = pagesFromPayload(
      {
        query: {
          pages: {
            "1": {
              pageid: 1,
              title: "Ada Lovelace",
              extract: "Ada Lovelace was a mathematician and writer who worked on the Analytical Engine.",
              thumbnail: { source: "https://upload.wikimedia.org/ada.jpg", width: 80, height: 80 },
            },
            "2": {
              pageid: 2,
              title: "Space (disambiguation)",
              extract: "Space is a disambiguation page with several meanings listed for readers.",
              thumbnail: { source: "https://upload.wikimedia.org/space.jpg", width: 80, height: 80 },
              pageprops: { disambiguation: "" },
            },
            "3": {
              pageid: 3,
              title: "Example",
              extract: "This page is categorized with sexual content and should stay out of the default feed.",
              thumbnail: { source: "https://upload.wikimedia.org/example.jpg", width: 80, height: 80 },
              categories: [{ title: "Category:Sexual content" }],
            },
            "4": {
              pageid: 4,
              title: "Ahern",
              extract: "Ahern is a surname with many bearers and no illustration on its Wikipedia page.",
            },
          },
        },
      },
      english,
      true
    );
    expect(articles.map((article) => article.title)).toEqual(["Ada Lovelace"]);
  });

  it("recognizes sensitive titles and disambiguation flags", () => {
    expect(looksSensitive("History of pornography")).toBe(true);
    expect(looksSensitive("Sexual selection")).toBe(false);
    expect(isDisambiguation({ title: "Mercury", pageprops: { disambiguation: "" } })).toBe(true);
  });
});

describe("links", () => {
  it("adds the Wikipedia variant and builds an app link", () => {
    expect(withVariant("https://zh.wikipedia.org/wiki/Taiwan", "zh-tw")).toBe(
      "https://zh.wikipedia.org/wiki/Taiwan?variant=zh-tw"
    );
    expect(withVariant("https://en.wikipedia.org/wiki/Cat", "en")).toBe("https://en.wikipedia.org/wiki/Cat");
    const href = appArticleHref({
      origin: "https://wikitok.example",
      lang: "fr",
      topic: "space",
      pageid: 42,
    });
    expect(readFeedLocation(new URL(href).search)).toEqual({ lang: "fr", topic: "space", pageid: 42 });
  });

  it("matches the browser language list before falling back to English", () => {
    expect(languageFromNavigator(["pt-BR", "en"]).id).toBe("pt");
    expect(languageFromNavigator(["zh-TW"]).id).toBe("zh-tw");
    expect(languageFromNavigator(["xx"]).id).toBe("en");
  });
});

describe("privacy", () => {
  it("zeroes the public host portion and keeps loopback addresses", () => {
    expect(redactIp("108.11.218.119")).toBe("108.11.218.0");
    expect(redactIp("127.0.0.1")).toBe("127.0.0.1");
  });
});
