import DOMPurify from "dompurify";

const REMOVE_SELECTORS = [
  ".mw-editsection",
  ".navbox",
  ".vertical-navbox",
  ".sidebar",
  ".noprint",
  ".metadata",
  ".ambox",
  ".tombstone",
  ".mw-jump-link",
  ".mw-empty-elt",
];

function articleDomain(articleUrl: string): string {
  try {
    const parsed = new URL(articleUrl);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "https://en.wikipedia.org";
  }
}

function toSafeUrl(value: string, domain: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    return null;
  }
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("/")) return `${domain}${trimmed}`;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
  if (trimmed.startsWith("#")) return trimmed;
  return null;
}

function rewriteSrcset(value: string, domain: string): string {
  return value
    .split(",")
    .map((part) => {
      const bits = part.trim().split(/\s+/);
      if (bits.length === 0 || !bits[0]) return "";
      const url = toSafeUrl(bits[0], domain);
      if (!url || url.startsWith("#")) return "";
      return [url, ...bits.slice(1)].join(" ");
    })
    .filter(Boolean)
    .join(", ");
}

export function prepareWikipediaHtml(rawHtml: string, articleUrl: string): string {
  if (typeof DOMParser === "undefined") return "";

  const sanitized = DOMPurify.sanitize(rawHtml, {
    FORBID_TAGS: ["style", "form", "iframe", "object", "embed", "link", "meta", "base"],
    FORBID_ATTR: ["style"],
  });

  const doc = new DOMParser().parseFromString(sanitized, "text/html");
  const domain = articleDomain(articleUrl);

  doc
    .querySelectorAll("script, style, iframe, frame, frameset, object, embed, applet, form, link, meta, base")
    .forEach((element) => element.remove());

  doc.querySelectorAll("*").forEach((element) => {
    for (let index = element.attributes.length - 1; index >= 0; index -= 1) {
      const attr = element.attributes[index];
      const name = attr.name.toLowerCase();
      if (name.startsWith("on") || name === "style") element.removeAttribute(attr.name);
    }
  });

  REMOVE_SELECTORS.forEach((selector) => {
    doc.querySelectorAll(selector).forEach((element) => element.remove());
  });

  doc.querySelectorAll("a").forEach((anchor) => {
    const href = anchor.getAttribute("href")?.trim();
    if (!href) return;
    if (href.startsWith("#")) return;

    let finalHref: string | null;
    if (href.startsWith("/wiki/") || href.startsWith("./")) {
      const cleanHref = href.startsWith("./") ? href.slice(2) : href.slice(6);
      finalHref = `${domain}/wiki/${cleanHref}`;
    } else {
      finalHref = toSafeUrl(href, domain);
    }
    if (!finalHref) {
      anchor.removeAttribute("href");
      return;
    }
    anchor.setAttribute("href", finalHref);
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });

  doc.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src");
    if (src) {
      const safe = toSafeUrl(src, domain);
      if (!safe) img.remove();
      else img.setAttribute("src", safe);
    }
    const srcset = img.getAttribute("srcset");
    if (srcset) {
      const rewritten = rewriteSrcset(srcset, domain);
      if (rewritten) img.setAttribute("srcset", rewritten);
      else img.removeAttribute("srcset");
    }
    img.setAttribute("loading", "lazy");
  });

  doc.querySelectorAll("table").forEach((table) => {
    if (table.parentElement?.classList.contains("wiki-table-wrapper")) return;
    const wrapper = doc.createElement("div");
    wrapper.className =
      "wiki-table-wrapper overflow-x-auto my-4 rounded-xl border border-white/10 bg-white/[0.02]";
    table.parentNode?.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });

  const output = doc.querySelector(".mw-parser-output");
  return output ? output.innerHTML : doc.body.innerHTML;
}
