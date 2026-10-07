import { describe, expect, it } from "vitest";
import { prepareWikipediaHtml } from "../src/lib/wikiHtml";

describe("prepareWikipediaHtml", () => {
  it("strips active content and inline styles, and rewrites media URLs", () => {
    const html = `
      <div class="mw-parser-output">
        <script>alert(1)</script>
        <p style="color:red" onclick="alert(1)">Hello</p>
        <a href="javascript:alert(1)">bad</a>
        <a href="/wiki/Cat">Cat</a>
        <a href="#cite_note-1">1</a>
        <img src="//upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat.jpg/20px-Cat.jpg" srcset="//upload.wikimedia.org/cat.jpg 2x" style="width:10px" />
        <table><tr><td>cell</td></tr></table>
      </div>
    `;

    const clean = prepareWikipediaHtml(html, "https://en.wikipedia.org/wiki/Cat");
    expect(clean.toLowerCase()).not.toContain("<script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("javascript:");
    expect(clean).not.toContain("style=");
    expect(clean).toContain("https://en.wikipedia.org/wiki/Cat");
    expect(clean).toContain('href="#cite_note-1"');
    expect(clean).toContain("https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Cat.jpg/20px-Cat.jpg");
    expect(clean).toContain("https://upload.wikimedia.org/cat.jpg 2x");
    expect(clean).toContain("wiki-table-wrapper");
    expect(clean).toContain("Hello");
  });
});
