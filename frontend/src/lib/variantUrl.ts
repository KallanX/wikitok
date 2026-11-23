export function needsVariant(languageId: string | undefined): boolean {
  return Boolean(languageId && languageId.includes("-"));
}

export function withVariant(rawUrl: string, languageId: string | undefined): string {
  if (!needsVariant(languageId)) return rawUrl;
  try {
    const url = new URL(rawUrl);
    if (!url.searchParams.has("variant")) url.searchParams.set("variant", languageId!);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

export function appArticleHref(input: {
  origin: string;
  path?: string;
  lang: string;
  topic?: string;
  pageid?: number;
}): string {
  const url = new URL(input.path && input.path.startsWith("/") ? input.path : "/", input.origin);
  url.search = "";
  url.searchParams.set("lang", input.lang);
  if (input.topic && input.topic !== "all") url.searchParams.set("topic", input.topic);
  if (input.pageid) url.searchParams.set("article", String(input.pageid));
  return url.toString();
}

export function readFeedLocation(search: string): {
  lang?: string;
  topic?: string;
  pageid?: number;
} {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const lang = params.get("lang")?.trim() || undefined;
  const topic = params.get("topic")?.trim() || undefined;
  const raw = params.get("article");
  const pageid = raw && Number.isFinite(Number(raw)) && Number(raw) > 0 ? Number(raw) : undefined;
  return { lang, topic, pageid };
}
