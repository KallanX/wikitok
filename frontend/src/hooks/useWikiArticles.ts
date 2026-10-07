import { useState, useCallback, useRef, useEffect } from "react";
import { useLocalization } from "./useLocalization";
import type { WikiArticle } from "../components/WikiCard";
import type { Language } from "../languages";
import { topicSearchTerm } from "../lib/topics";

const FETCH_TIMEOUT_MS = 12_000;
const RANDOM_ATTEMPTS = 3;
const TOPIC_PAGE_ATTEMPTS = 6;

const preloadImage = (src: string, timeoutMs = 3000): Promise<void> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    const timer = setTimeout(() => resolve(), timeoutMs);
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    img.onload = done;
    img.onerror = done;
    img.src = src;
  });
};

interface RawWikiPage {
  title: string;
  varianttitles?: Record<string, string>;
  extract?: string;
  pageid: number;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  canonicalurl?: string;
}

interface BatchResult {
  articles: WikiArticle[];
  nextOffset: number | null;
}

function takeUnique(batches: WikiArticle[][], seen: Set<number>): WikiArticle[] {
  const unique: WikiArticle[] = [];
  const local = new Set<number>();
  for (const batch of batches) {
    for (const article of batch) {
      if (seen.has(article.pageid) || local.has(article.pageid)) continue;
      local.add(article.pageid);
      unique.push(article);
    }
  }
  return unique;
}

async function fetchBatch(
  lang: Language,
  activeTopic: string,
  offset: number,
  signal: AbortSignal,
  seen: Set<number>
): Promise<BatchResult> {
  const params: Record<string, string> = {
    action: "query",
    format: "json",
    prop: "extracts|info|pageimages",
    inprop: "url|varianttitles",
    exintro: "1",
    exlimit: "max",
    exsentences: "6",
    explaintext: "1",
    piprop: "thumbnail",
    pithumbsize: "800",
    pilimit: "max",
    origin: "*",
    variant: lang.id,
  };

  if (activeTopic === "all") {
    params.generator = "random";
    params.grnnamespace = "0";
    params.grnlimit = "20";
  } else {
    params.generator = "search";
    params.gsrsearch = topicSearchTerm(activeTopic, lang.id);
    params.gsrnamespace = "0";
    params.gsrlimit = "20";
    params.gsroffset = String(offset);
  }

  const response = await fetch(`${lang.api}${new URLSearchParams(params).toString()}`, {
    signal,
  });
  if (!response.ok) {
    throw new Error(`Wikipedia responded with ${response.status}`);
  }
  const data = await response.json();
  if (data?.error) {
    throw new Error(data.error.info || "Wikipedia request failed");
  }

  if (!data?.query?.pages) {
    return { articles: [], nextOffset: activeTopic === "all" ? offset : null };
  }

  const rawPages = Object.values(data.query.pages) as RawWikiPage[];
  const articles = rawPages
    .map(
      (page): WikiArticle => ({
        title: page.title,
        displaytitle: page.varianttitles?.[lang.id] || page.title || "Untitled",
        extract: page.extract || "",
        pageid: page.pageid,
        lang: lang.id,
        thumbnail: page.thumbnail,
        url: page.canonicalurl || `${lang.article}${encodeURIComponent(page.title)}`,
      })
    )
    .filter(
      (article) =>
        Boolean(article.thumbnail?.source) &&
        Boolean(article.url) &&
        article.extract.trim().length > 20 &&
        !seen.has(article.pageid)
    );

  let nextOffset: number | null = null;
  if (activeTopic !== "all") {
    const cont = data?.continue?.gsroffset;
    if (typeof cont === "number" && Number.isFinite(cont)) nextOffset = cont;
    else if (typeof cont === "string" && cont !== "" && Number.isFinite(Number(cont))) {
      nextOffset = Number(cont);
    }
  }

  return { articles, nextOffset };
}

export function useWikiArticles() {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [topic, setTopic] = useState("all");

  const seenPageIds = useRef<Set<number>>(new Set());
  const isFetchingRef = useRef(false);
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const offsetRef = useRef(0);
  const exhaustedRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const articlesRef = useRef(articles);
  articlesRef.current = articles;

  const { currentLanguage } = useLocalization();
  const languageRef = useRef(currentLanguage);
  const topicRef = useRef(topic);
  languageRef.current = currentLanguage;
  topicRef.current = topic;

  const fetchArticles = useCallback(async (isInitial = false) => {
    if (isFetchingRef.current) return;
    if (errorRef.current) return;
    if (exhaustedRef.current && topicRef.current !== "all") return;

    const gen = generationRef.current;
    const lang = languageRef.current;
    const activeTopic = topicRef.current;
    isFetchingRef.current = true;
    if (isInitial) setLoading(true);
    else setIsFetchingMore(true);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const stillCurrent = () => generationRef.current === gen;

    try {
      let collected: WikiArticle[] = [];
      let reachedEnd = false;

      if (activeTopic === "all") {
        for (let attempt = 0; attempt < RANDOM_ATTEMPTS && collected.length === 0; attempt += 1) {
          const [first, second] = await Promise.all([
            fetchBatch(lang, activeTopic, 0, controller.signal, seenPageIds.current),
            fetchBatch(lang, activeTopic, 0, controller.signal, seenPageIds.current),
          ]);
          if (!stillCurrent()) return;
          collected = takeUnique([first.articles, second.articles], seenPageIds.current);
        }
      } else {
        let offset = offsetRef.current;
        for (
          let attempt = 0;
          attempt < TOPIC_PAGE_ATTEMPTS && collected.length < 8 && !reachedEnd;
          attempt += 1
        ) {
          const batch = await fetchBatch(lang, activeTopic, offset, controller.signal, seenPageIds.current);
          if (!stillCurrent()) return;
          collected = takeUnique([collected, batch.articles], seenPageIds.current);
          if (batch.nextOffset == null || batch.nextOffset === offset) {
            reachedEnd = true;
            break;
          }
          offset = batch.nextOffset;
        }
        if (stillCurrent()) offsetRef.current = offset;
      }

      if (!stillCurrent()) return;

      for (const article of collected) seenPageIds.current.add(article.pageid);
      collected.slice(0, 4).forEach((article) => {
        if (article.thumbnail?.source) void preloadImage(article.thumbnail.source);
      });

      if (reachedEnd) {
        exhaustedRef.current = true;
        setExhausted(true);
      }
      if (collected.length > 0) {
        setArticles((prev) => [...prev, ...collected]);
      } else if (!reachedEnd) {
        const message = "Couldn't load articles. Check your connection and try again.";
        errorRef.current = message;
        setError(message);
      }
    } catch (error) {
      if (!stillCurrent()) return;
      const timedOut = error instanceof Error && error.name === "AbortError";
      const message = timedOut
        ? "The Wikipedia request timed out. Try again."
        : "Couldn't load articles. Check your connection and try again.";
      errorRef.current = message;
      setError(message);
    } finally {
      clearTimeout(timeout);
      if (stillCurrent()) {
        isFetchingRef.current = false;
        setLoading(false);
        setIsFetchingMore(false);
      }
    }
  }, []);

  const resetAndFetch = useCallback(() => {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    seenPageIds.current = new Set();
    offsetRef.current = 0;
    exhaustedRef.current = false;
    errorRef.current = null;
    isFetchingRef.current = false;
    setArticles([]);
    setError(null);
    setExhausted(false);
    setLoading(true);
    void fetchArticles(true);
  }, [fetchArticles]);

  useEffect(() => {
    resetAndFetch();
    return () => {
      generationRef.current += 1;
      abortRef.current?.abort();
      isFetchingRef.current = false;
    };
  }, [currentLanguage.id, topic, resetAndFetch]);

  const retry = useCallback(() => {
    errorRef.current = null;
    setError(null);
    void fetchArticles(articlesRef.current.length === 0);
  }, [fetchArticles]);

  const loadMore = useCallback(() => {
    void fetchArticles(false);
  }, [fetchArticles]);

  return {
    articles,
    loading,
    isFetchingMore,
    error,
    exhausted,
    topic,
    setTopic,
    fetchArticles: loadMore,
    retry,
  };
}
