import { describe, expect, it } from "vitest";
import { ambientThumb } from "../src/lib/thumb";

describe("ambientThumb", () => {
  it("asks Wikimedia for a tiny backdrop", () => {
    expect(
      ambientThumb(
        "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat.jpg/800px-Cat.jpg"
      )
    ).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat.jpg/40px-Cat.jpg");
  });

  it("keeps a query string", () => {
    expect(ambientThumb("https://example.test/800px-Cat.jpg?utm=1")).toBe(
      "https://example.test/40px-Cat.jpg?utm=1"
    );
  });
});
