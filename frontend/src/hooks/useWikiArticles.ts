import { useState, useCallback, useRef, useEffect } from "react";
import { useLocalization } from "./useLocalization";
import type { WikiArticle } from "../lib/article";
import { likeKey } from "../lib/likeKey";
import { languageFromId } from "../lib/language";
import { loadHidden, loadSeen, rememberHidden } from "../lib/readingMemory";
import { readFeedLocation } from "../lib/variantUrl";
import {
  fetchArticleById,
  fetchRelatedArticles,
  loadFeed,
  WikiRequestError,
} from "../lib/wikiFeed";
import { isFeedTopic } from "../lib/topics";

const preloadImage = (src: string, timeoutMs = 3000): Promise<void> => {
  return new Promise((resolve) => {
    const img = new Image();
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

function initialTopic(): string {
  if (typeof window === "undefined") return "all";
  const topic = readFeedLocation(window.location.search).topic;
  return topic && isFeedTopic(topic) ? topic : "all";
}

function initialPageId(): number | null {
  if (typeof window === "undefined") return null;
  return readFeedLocation(window.location.search).pageid ?? null;
}

export function useWikiArticles(hideSensitive = true) {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [topic, setTopic] = useState(initialTopic);

  const seenPageIds = useRef<Set<number>>(new Set());
  const hiddenKeys = useRef<Set<string>>(new Set(loadHidden()));
  const isFetchingRef = useRef(false);
  const generationRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const exhaustedRef = useRef(false);
  const errorRef = useRef<string | null>(null);
  const articlesRef = useRef(articles);
  const pendingPageId = useRef<number | null>(initialPageId());
  const hideSensitiveRef = useRef(hideSensitive);
  const { currentLanguage } = useLocalization();
  const languageRef = useRef(currentLanguage);
  const topicRef = useRef(topic);

  useEffect(() => {
    articlesRef.current = articles;
    hideSensitiveRef.current = hideSensitive;
    languageRef.current = currentLanguage;
    topicRef.current = topic;
  });

  const remember = useCallback((batch: WikiArticle[]) => {
    for (const article of batch) seenPageIds.current.add(article.pageid);
    batch.slice(0, 4).forEach((article) => {
      if (article.thumbnail?.source) void preloadImage(article.thumbnail.source);
    });
  }, []);

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
    const stillCurrent = () => generationRef.current === gen;

    try {
      const pinnedId = isInitial ? pendingPageId.current : null;
      pendingPageId.current = null;
      let pinned: WikiArticle | null = null;
      if (pinnedId) {
        pinned = await fetchArticleById(lang, pinnedId, controller.signal, false);
        if (!stillCurrent()) return;
      }

      for (const key of loadSeen()) {
        const splitAt = key.lastIndexOf(":");
        if (splitAt <= 0) continue;
        if (key.slice(0, splitAt) !== lang.id) continue;
        const id = Number(key.slice(splitAt + 1));
        if (Number.isFinite(id)) seenPageIds.current.add(id);
      }
      if (pinned) seenPageIds.current.delete(pinned.pageid);

      const loaded = await loadFeed({
        lang,
        topic: activeTopic,
        signal: controller.signal,
        hideSensitive: hideSensitiveRef.current,
        seen: seenPageIds.current,
        hidden: hiddenKeys.current,
      });
      if (!stillCurrent()) return;

      const fresh = pinned
        ? [pinned, ...loaded.articles.filter((article) => article.pageid !== pinned?.pageid)]
        : loaded.articles;
      remember(fresh);

      if (loaded.exhausted) {
        exhaustedRef.current = true;
        setExhausted(true);
      }
      if (fresh.length > 0) {
        setArticles((prev) => {
          const keys = new Set(prev.map((article) => likeKey(article)));
          const next = fresh.filter((article) => !keys.has(likeKey(article)));
          return [...prev, ...next];
        });
      } else if (!loaded.exhausted) {
        const message = loaded.timedOut
          ? "The Wikipedia request timed out. Try again."
          : "Couldn't load articles. Check your connection and try again.";
        errorRef.current = message;
        setError(message);
      }
    } catch (error) {
      if (!stillCurrent()) return;
      const timedOut = error instanceof WikiRequestError && error.timedOut;
      const aborted = error instanceof Error && error.name === "AbortError";
      if (aborted && !timedOut) return;
      const message = timedOut
        ? "The Wikipedia request timed out. Try again."
        : "Couldn't load articles. Check your connection and try again.";
      errorRef.current = message;
      setError(message);
    } finally {
      if (stillCurrent()) {
        isFetchingRef.current = false;
        setLoading(false);
        setIsFetchingMore(false);
      }
    }
  }, [remember]);

  const resetAndFetch = useCallback(() => {
    generationRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    seenPageIds.current = new Set();
    hiddenKeys.current = new Set(loadHidden());
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
    // The feed is external Wikipedia data. Changing language, topic, or the
    // sensitive-content filter has to drop the old cards and start a new request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    resetAndFetch();
    return () => {
      generationRef.current += 1;
      abortRef.current?.abort();
      isFetchingRef.current = false;
    };
  }, [currentLanguage.id, topic, hideSensitive, resetAndFetch]);

  const retry = useCallback(() => {
    errorRef.current = null;
    setError(null);
    void fetchArticles(articlesRef.current.length === 0);
  }, [fetchArticles]);

  const loadMore = useCallback(() => {
    void fetchArticles(false);
  }, [fetchArticles]);

  const openArticle = useCallback((article: WikiArticle) => {
    setArticles((prev) => [article, ...prev.filter((item) => likeKey(item) !== likeKey(article))]);
    seenPageIds.current.add(article.pageid);
  }, []);

  const dismissArticle = useCallback((article: WikiArticle) => {
    const key = likeKey(article);
    hiddenKeys.current.add(key);
    rememberHidden(key);
    setArticles((prev) => prev.filter((item) => likeKey(item) !== key));
  }, []);

  const loadRelated = useCallback(async (article: WikiArticle) => {
    const controller = new AbortController();
    const lang = languageFromId(article.lang) ?? languageRef.current;
    const related = await fetchRelatedArticles(
      lang,
      article.title,
      controller.signal,
      hideSensitiveRef.current,
      seenPageIds.current,
      hiddenKeys.current
    );
    if (related.length === 0) return 0;
    remember(related);
    setArticles((prev) => {
      const index = prev.findIndex((item) => likeKey(item) === likeKey(article));
      const insertAt = index === -1 ? prev.length : index + 1;
      const keys = new Set(prev.map((item) => likeKey(item)));
      const fresh = related.filter((item) => !keys.has(likeKey(item)));
      const next = prev.slice();
      next.splice(insertAt, 0, ...fresh);
      return next;
    });
    return related.length;
  }, [remember]);

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
    openArticle,
    dismissArticle,
    loadRelated,
  };
}
