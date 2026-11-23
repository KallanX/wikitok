import type { Language } from "../languages";
import type { WikiArticle, WikiThumbnail } from "./article";
import { likeKey } from "./likeKey";
import { isDisambiguation, looksSensitive } from "./sensitive";
import { topicDiscoveryQuery, topicSearchTerm } from "./topics";
import { withVariant } from "./variantUrl";

const API_HEADERS = {
  "Api-User-Agent": "WikiTok/1.3.0 (https://github.com/KallanX/wikitok)",
};
const REQUEST_TIMEOUT_MS = 12_000;

export class WikiRequestError extends Error {
  readonly timedOut: boolean;
  readonly status: number;

  constructor(message: string, timedOut = false, status = 0) {
    super(message);
    this.name = "WikiRequestError";
    this.timedOut = timedOut;
    this.status = status;
  }
}

interface RawPage {
  title?: string;
  varianttitles?: Record<string, string>;
  extract?: string;
  pageid?: number;
  missing?: string;
  canonicalurl?: string;
  thumbnail?: WikiThumbnail;
  pageprops?: Record<string, unknown>;
  categories?: { title: string }[];
  index?: number;
}

interface QueryPayload {
  query?: { pages?: Record<string, RawPage> };
  continue?: { gsroffset?: number | string };
  error?: { code?: string; info?: string };
}

export interface FeedBatch {
  articles: WikiArticle[];
  timedOut: boolean;
  failed: boolean;
}

export interface FeedLoad {
  articles: WikiArticle[];
  timedOut: boolean;
  failed: boolean;
  exhausted: boolean;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

export async function fetchWiki(
  url: string,
  parent: AbortSignal,
  attempt = 0,
  headers: HeadersInit = API_HEADERS
): Promise<unknown> {
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const signal = AbortSignal.any([parent, timeout]);
  let response: Response;
  try {
    response = await fetch(url, { signal, headers });
  } catch (error) {
    if (parent.aborted) throw error;
    if (timeout.aborted) throw new WikiRequestError("The Wikipedia request timed out.", true);
    throw error;
  }

  if (response.status === 429 && attempt < 1) {
    const retryAfter = Number(response.headers.get("Retry-After"));
    const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500;
    await sleep(Math.min(delay, 5000), parent);
    return fetchWiki(url, parent, attempt + 1, headers);
  }
  if (!response.ok) {
    throw new WikiRequestError(`Wikipedia responded with ${response.status}`, false, response.status);
  }

  const data = (await response.json()) as QueryPayload;
  if (data?.error?.code === "maxlag" && attempt < 1) {
    await sleep(1500, parent);
    return fetchWiki(url, parent, attempt + 1, headers);
  }
  if (data?.error) {
    throw new WikiRequestError(data.error.info || "Wikipedia request failed");
  }
  return data;
}

async function safeWiki(
  url: string,
  signal: AbortSignal,
  headers?: HeadersInit
): Promise<FeedBatch & { data?: unknown }> {
  try {
    const data = await fetchWiki(url, signal, 0, headers);
    return { data, articles: [], timedOut: false, failed: false };
  } catch (error) {
    if (signal.aborted) throw error;
    const timedOut = error instanceof WikiRequestError && error.timedOut;
    return { articles: [], timedOut, failed: !timedOut };
  }
}

function queryUrl(api: string, params: Record<string, string>): string {
  return `${api}${new URLSearchParams({
    format: "json",
    origin: "*",
    maxlag: "5",
    ...params,
  }).toString()}`;
}

const PAGE_FIELDS: Record<string, string> = {
  action: "query",
  prop: "extracts|info|pageimages|pageprops|categories",
  inprop: "url|varianttitles",
  exintro: "1",
  exlimit: "max",
  exsentences: "6",
  explaintext: "1",
  piprop: "thumbnail",
  pithumbsize: "800",
  pilimit: "max",
  ppprop: "disambiguation",
  cllimit: "max",
  clshow: "!hidden",
};

export function pagesFromPayload(
  data: unknown,
  lang: Language,
  hideSensitive: boolean
): WikiArticle[] {
  const pages = Object.values(((data as QueryPayload)?.query?.pages ?? {}) as Record<string, RawPage>);
  const articles: WikiArticle[] = [];
  for (const page of pages) {
    if (!page || typeof page.pageid !== "number" || page.missing != null || !page.title) continue;
    if (isDisambiguation(page)) continue;
    const categories = (page.categories ?? []).map((category) => category.title).filter(Boolean);
    if (hideSensitive && looksSensitive(page.title, categories)) continue;
    const extract = (page.extract || "").trim();
    if (extract.length <= 20 || !page.thumbnail?.source) continue;
    articles.push({
      title: page.title,
      displaytitle: page.varianttitles?.[lang.id] || page.title,
      extract,
      pageid: page.pageid,
      lang: lang.id,
      thumbnail: page.thumbnail,
      categories,
      url: withVariant(
        page.canonicalurl || `${lang.article}${encodeURIComponent(page.title)}`,
        lang.id
      ),
    });
  }
  return articles;
}

function keepFresh(articles: WikiArticle[], seen: Set<number>, hidden: Set<string>): WikiArticle[] {
  return articles.filter(
    (article) => !seen.has(article.pageid) && !hidden.has(likeKey(article))
  );
}

function dedupe(articles: WikiArticle[]): WikiArticle[] {
  const seen = new Set<string>();
  const unique: WikiArticle[] = [];
  for (const article of articles) {
    const key = likeKey(article);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(article);
  }
  return unique;
}

async function queryPages(
  lang: Language,
  params: Record<string, string>,
  signal: AbortSignal,
  hideSensitive: boolean,
  seen: Set<number>,
  hidden: Set<string>
): Promise<FeedBatch> {
  const result = await safeWiki(queryUrl(lang.api, { ...PAGE_FIELDS, ...params }), signal);
  if (!result.data) return result;
  return {
    articles: keepFresh(pagesFromPayload(result.data, lang, hideSensitive), seen, hidden),
    timedOut: false,
    failed: false,
  };
}

export async function fetchRandomBatch(
  lang: Language,
  signal: AbortSignal,
  hideSensitive: boolean,
  seen: Set<number>,
  hidden: Set<string>
): Promise<FeedBatch> {
  return queryPages(
    lang,
    { generator: "random", grnnamespace: "0", grnlimit: "20" },
    signal,
    hideSensitive,
    seen,
    hidden
  );
}

export async function fetchTopicBatch(
  lang: Language,
  topic: string,
  signal: AbortSignal,
  hideSensitive: boolean,
  seen: Set<number>,
  hidden: Set<string>
): Promise<FeedBatch> {
  const discovery = topicDiscoveryQuery(topic);
  const queries = discovery ? [discovery, topicSearchTerm(topic, lang.id)] : [topicSearchTerm(topic, lang.id)];
  let last: FeedBatch = { articles: [], timedOut: false, failed: true };
  for (const search of queries) {
    const params: Record<string, string> = {
      generator: "search",
      gsrsearch: search,
      gsrnamespace: "0",
      gsrlimit: "20",
    };
    if (search.startsWith("articletopic:")) params.gsrsort = "random";
    last = await queryPages(lang, params, signal, hideSensitive, seen, hidden);
    if (last.articles.length > 0 || last.timedOut || last.failed) return last;
  }
  return last;
}

function projectName(lang: Language): string {
  return new URL(lang.api).host.replace(/\.org$/, "");
}

function yesterdayUtc(now = new Date()): { year: string; month: string; day: string } {
  const date = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return {
    year: String(date.getUTCFullYear()),
    month: String(date.getUTCMonth() + 1).padStart(2, "0"),
    day: String(date.getUTCDate()).padStart(2, "0"),
  };
}

export async function fetchPopularArticles(
  lang: Language,
  signal: AbortSignal,
  hideSensitive: boolean,
  seen: Set<number>,
  hidden: Set<string>,
  now = new Date()
): Promise<FeedBatch> {
  const { year, month, day } = yesterdayUtc(now);
  const url = `https://wikimedia.org/api/rest_v1/metrics/pageviews/top/${projectName(lang)}/all-access/${year}/${month}/${day}`;
  // The pageview host rejects the custom Api-User-Agent preflight, so this call stays header-free.
  const result = await safeWiki(url, signal, {});
  if (!result.data) return result;
  const payload = result.data as {
    items?: { articles?: { article?: string }[] }[];
  };
  const titles: string[] = [];
  for (const item of payload.items?.[0]?.articles ?? []) {
    const name = item.article || "";
    if (
      !name ||
      name === "Main_Page" ||
      name === "-" ||
      /^(Special|Wikipedia|Portal|File|Category|Talk|User):/i.test(name)
    ) {
      continue;
    }
    titles.push(name.replace(/_/g, " "));
    if (titles.length >= 20) break;
  }
  if (titles.length === 0) return { articles: [], timedOut: false, failed: false };
  return queryPages(
    lang,
    { titles: titles.join("|") },
    signal,
    hideSensitive,
    seen,
    hidden
  );
}

interface FeedPage {
  pageid?: number;
  title?: string;
  displaytitle?: string;
  normalizedtitle?: string;
  extract?: string;
  description?: string;
  thumbnail?: WikiThumbnail;
  content_urls?: { desktop?: { page?: string } };
}

function feedTitle(page: FeedPage): string {
  const raw = (page.normalizedtitle || page.displaytitle || page.title || "").replace(/<[^>]+>/g, "").trim();
  if (raw.includes("_") && !raw.includes(" ")) return raw.replace(/_/g, " ");
  return raw;
}

function pagesFromOnThisDay(data: unknown, lang: Language, hideSensitive: boolean): WikiArticle[] {
  const record = data as Record<string, { pages?: FeedPage[] }[] | undefined>;
  const articles: WikiArticle[] = [];
  for (const bucket of ["selected", "events", "births", "deaths", "holidays"]) {
    for (const entry of record[bucket] ?? []) {
      for (const page of entry.pages ?? []) {
        const title = feedTitle(page);
        if (!page.pageid || !title) continue;
        const extract = (page.extract || page.description || "").trim();
        if (extract.length <= 20 || !page.thumbnail?.source) continue;
        if (hideSensitive && looksSensitive(title)) continue;
        const desktop = page.content_urls?.desktop?.page;
        articles.push({
          title,
          displaytitle: title,
          extract,
          pageid: page.pageid,
          lang: lang.id,
          thumbnail: page.thumbnail,
          url: withVariant(desktop || `${lang.article}${encodeURIComponent(title)}`, lang.id),
        });
      }
    }
  }
  return articles;
}

export async function fetchOnThisDay(
  lang: Language,
  signal: AbortSignal,
  hideSensitive: boolean,
  seen: Set<number>,
  hidden: Set<string>,
  now = new Date()
): Promise<FeedBatch> {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const host = new URL(lang.api).host;
  const result = await safeWiki(`https://${host}/api/rest_v1/feed/onthisday/all/${month}/${day}`, signal);
  if (!result.data) return result;
  return {
    articles: keepFresh(dedupe(pagesFromOnThisDay(result.data, lang, hideSensitive)), seen, hidden),
    timedOut: false,
    failed: false,
  };
}

export async function fetchArticlesByTitles(
  lang: Language,
  titles: string[],
  signal: AbortSignal,
  hideSensitive: boolean
): Promise<WikiArticle[]> {
  if (titles.length === 0) return [];
  const batch = await queryPages(lang, { titles: titles.join("|") }, signal, hideSensitive, new Set(), new Set());
  return batch.articles;
}

export async function fetchArticleById(
  lang: Language,
  pageid: number,
  signal: AbortSignal,
  hideSensitive: boolean
): Promise<WikiArticle | null> {
  const batch = await queryPages(
    lang,
    { pageids: String(pageid) },
    signal,
    hideSensitive,
    new Set(),
    new Set()
  );
  return batch.articles[0] ?? null;
}

export interface LangLink {
  lang: string;
  autonym: string;
  title: string;
  url: string;
}

export async function fetchLangLinks(
  lang: Language,
  pageid: number,
  signal: AbortSignal
): Promise<LangLink[]> {
  const result = await safeWiki(
    queryUrl(lang.api, {
      action: "query",
      prop: "langlinks",
      lllimit: "80",
      llprop: "url|autonym|langname",
      pageids: String(pageid),
    }),
    signal
  );
  if (!result.data) return [];
  const pages = Object.values(
    ((result.data as QueryPayload).query?.pages ?? {}) as Record<
      string,
      { langlinks?: { lang: string; autonym?: string; "*": string; url?: string }[] }
    >
  );
  const links = pages[0]?.langlinks ?? [];
  return links
    .filter((link) => link.lang && link["*"])
    .map((link) => ({
      lang: link.lang,
      autonym: link.autonym || link.lang,
      title: link["*"],
      url: link.url || "",
    }));
}

export async function searchArticles(
  lang: Language,
  term: string,
  signal: AbortSignal,
  hideSensitive: boolean
): Promise<WikiArticle[]> {
  const query = term.trim();
  if (query.length < 2) return [];
  const batch = await queryPages(
    lang,
    {
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "0",
      gsrlimit: "8",
    },
    signal,
    hideSensitive,
    new Set(),
    new Set()
  );
  return batch.articles;
}

export async function fetchRelatedArticles(
  lang: Language,
  title: string,
  signal: AbortSignal,
  hideSensitive: boolean,
  seen: Set<number>,
  hidden: Set<string>
): Promise<WikiArticle[]> {
  const batch = await queryPages(
    lang,
    {
      generator: "search",
      gsrsearch: `morelike:${title}`,
      gsrnamespace: "0",
      gsrlimit: "8",
    },
    signal,
    hideSensitive,
    seen,
    hidden
  );
  return batch.articles.filter((article) => article.title !== title);
}

export async function loadFeed(input: {
  lang: Language;
  topic: string;
  signal: AbortSignal;
  hideSensitive: boolean;
  seen: Set<number>;
  hidden: Set<string>;
}): Promise<FeedLoad> {
  const { lang, topic, signal, hideSensitive, hidden } = input;
  const seen = new Set(input.seen);
  if (topic === "popular" || topic === "today") {
    const batch =
      topic === "popular"
        ? await fetchPopularArticles(lang, signal, hideSensitive, seen, hidden)
        : await fetchOnThisDay(lang, signal, hideSensitive, seen, hidden);
    return { ...batch, exhausted: !batch.failed && !batch.timedOut };
  }
  if (topic === "all") {
    let collected: WikiArticle[] = [];
    let timedOut = false;
    let failed = false;
    for (let attempt = 0; attempt < 3 && collected.length === 0; attempt += 1) {
      const [first, second] = await Promise.all([
        fetchRandomBatch(lang, signal, hideSensitive, seen, hidden),
        fetchRandomBatch(lang, signal, hideSensitive, seen, hidden),
      ]);
      timedOut = timedOut || first.timedOut || second.timedOut;
      failed = failed || first.failed || second.failed;
      collected = dedupe([...collected, ...first.articles, ...second.articles]);
      for (const article of collected) seen.add(article.pageid);
      if (timedOut && collected.length > 0) break;
    }
    return { articles: collected, timedOut, failed: failed && collected.length === 0, exhausted: false };
  }

  let collected: WikiArticle[] = [];
  let timedOut = false;
  let failed = false;
  for (let attempt = 0; attempt < 4 && collected.length === 0; attempt += 1) {
    const batch = await fetchTopicBatch(lang, topic, signal, hideSensitive, seen, hidden);
    timedOut = timedOut || batch.timedOut;
    failed = failed || batch.failed;
    collected = dedupe([...collected, ...batch.articles]);
    for (const article of collected) seen.add(article.pageid);
    if (timedOut || failed) break;
  }
  return {
    articles: collected,
    timedOut,
    failed: failed && collected.length === 0,
    exhausted: false,
  };
}
