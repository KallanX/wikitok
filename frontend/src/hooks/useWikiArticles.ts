import { useState, useCallback, useRef, useEffect } from "react";
import { useLocalization } from "./useLocalization";
import type { WikiArticle } from "../components/WikiCard";

const preloadImage = (src: string, timeoutMs = 3000): Promise<void> => {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => resolve(), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve();
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
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

export function useWikiArticles() {
  const [articles, setArticles] = useState<WikiArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [topic, setTopic] = useState<string>("all");
  const buffer = useRef<WikiArticle[]>([]);
  const seenPageIds = useRef<Set<number>>(new Set());
  const isFetchingMain = useRef(false);
  const isPrefetching = useRef(false);
  const { currentLanguage } = useLocalization();

  // Reset feed when language or topic changes
  const resetFeed = useCallback(() => {
    setArticles([]);
    buffer.current = [];
    seenPageIds.current.clear();
    isFetchingMain.current = false;
    isPrefetching.current = false;
  }, []);

  const fetchArticles = useCallback(
    async (isPrefetch = false) => {
      if (isPrefetch) {
        if (isPrefetching.current) return;
        isPrefetching.current = true;
      } else {
        if (isFetchingMain.current) return;
        isFetchingMain.current = true;
        setLoading(true);
      }

      try {
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
          pithumbsize: "1200",
          origin: "*",
          variant: currentLanguage.id,
        };

        if (topic === "all") {
          params.generator = "random";
          params.grnnamespace = "0";
          params.grnlimit = "50";
        } else {
          params.generator = "search";
          params.gsrsearch = topic;
          params.gsrnamespace = "0";
          params.gsrlimit = "40";
          // Add random search offset between 0 and 150 for variety
          const randomOffset = Math.floor(Math.random() * 150);
          params.gsroffset = String(randomOffset);
        }

        const url = `${currentLanguage.api}${new URLSearchParams(params).toString()}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data?.query?.pages) {
          const rawPages = Object.values(data.query.pages) as RawWikiPage[];

          const parsedArticles: WikiArticle[] = rawPages
            .map((page: RawWikiPage): WikiArticle => ({
              title: page.title,
              displaytitle:
                page.varianttitles?.[currentLanguage.id] ||
                page.title ||
                "Untitled",
              extract: page.extract || "",
              pageid: page.pageid,
              thumbnail: page.thumbnail as WikiArticle["thumbnail"],
              url:
                page.canonicalurl ||
                `${currentLanguage.article}${encodeURIComponent(page.title)}`,
            }))
            .filter(
              (article) =>
                article.thumbnail?.source &&
                article.url &&
                article.extract &&
                article.extract.trim().length > 20 &&
                !seenPageIds.current.has(article.pageid)
            );

          // Mark newly fetched articles as seen
          parsedArticles.forEach((article) => {
            seenPageIds.current.add(article.pageid);
          });

          // Non-blocking background image warmup for upcoming items
          parsedArticles.slice(0, 6).forEach((article) => {
            if (article.thumbnail?.source) {
              preloadImage(article.thumbnail.source).catch(() => {});
            }
          });

          if (isPrefetch) {
            buffer.current = [...buffer.current, ...parsedArticles];
          } else {
            setArticles((prev) => [...prev, ...parsedArticles]);
            // Instantly start background prefetch for the buffer
            setTimeout(() => {
              fetchArticles(true);
            }, 60);
          }
        }
      } catch (error) {
        console.error("Error fetching Wikipedia articles:", error);
      } finally {
        if (isPrefetch) {
          isPrefetching.current = false;
        } else {
          isFetchingMain.current = false;
          setLoading(false);
        }
      }
    },
    [currentLanguage, topic]
  );

  // When buffer has items, instantly append them (0ms delay) and trigger background refill
  const getMoreArticles = useCallback(() => {
    if (buffer.current.length > 0) {
      const nextBatch = buffer.current;
      buffer.current = [];
      setArticles((prev) => [...prev, ...nextBatch]);
      fetchArticles(true);
    } else {
      fetchArticles(false);
    }
  }, [fetchArticles]);

  // Initial fetch and language/topic change handler
  useEffect(() => {
    resetFeed();
    fetchArticles(false);
  }, [currentLanguage.id, topic, fetchArticles, resetFeed]);

  return {
    articles,
    loading,
    topic,
    setTopic,
    fetchArticles: getMoreArticles,
  };
}
