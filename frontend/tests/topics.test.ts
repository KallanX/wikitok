import { describe, expect, it } from "vitest";
import { LANGUAGES } from "../src/languages";
import { hasOwnTopicTerms, topicSearchTerm } from "../src/lib/topics";

describe("topicSearchTerm", () => {
  it("uses the language's own word instead of the English label", () => {
    expect(topicSearchTerm("science", "ja")).toBe("科学");
    expect(topicSearchTerm("history", "de")).toBe("Geschichte");
    expect(topicSearchTerm("art", "zh-tw")).toBe("藝術");
    expect(topicSearchTerm("science", "zh-cn")).toBe("科学");
  });

  it("has a term for every selectable language", () => {
    expect(LANGUAGES).toHaveLength(48);
    for (const language of LANGUAGES) {
      expect(hasOwnTopicTerms(language.id), language.id).toBe(true);
    }
  });
});
