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
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [topic, setTopic] = useState<string>("all");
  const seenPageIds = useRef<Set<number>>(new Set());
  const isFetchingRef = useRef(false);
  const { currentLanguage } = useLocalization();

  // Reset feed when language or topic changes
  const resetFeed = useCallback(() => {
    setArticles([]);
    seenPageIds.current.clear();
    isFetchingRef.current = false;
  }, []);

  // Fetch a single raw batch from Wikipedia API
  const fetchBatch = useCallback(
    async (offset = 0): Promise<WikiArticle[]> => {
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
        params.gsroffset = String(offset);
      }

      const url = `${currentLanguage.api}${new URLSearchParams(params).toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data?.query?.pages) return [];

      const rawPages = Object.values(data.query.pages) as RawWikiPage[];

      return rawPages
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
    },
    [currentLanguage, topic]
  );

  // Parallel multi-batch fetch pipeline to guarantee high-throughput continuous stream
  const fetchArticles = useCallback(
    async (isInitial = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (isInitial) {
        setLoading(true);
      } else {
        setIsFetchingMore(true);
      }

      try {
        let offset1 = 0;
        let offset2 = 40;
        if (topic !== "all") {
          const baseOffset = Math.floor(Math.random() * 120);
          offset1 = baseOffset;
          offset2 = baseOffset + 40;
        }

        // Fire 2 parallel requests to double throughput (~16-20 articles per fetch)
        const [batch1, batch2] = await Promise.all([
          fetchBatch(offset1).catch((err) => {
            console.error("Batch 1 fetch error:", err);
            return [] as WikiArticle[];
          }),
          fetchBatch(offset2).catch((err) => {
            console.error("Batch 2 fetch error:", err);
            return [] as WikiArticle[];
          }),
        ]);

        const combined = [...batch1, ...batch2];
        const uniqueNew: WikiArticle[] = [];

        for (const item of combined) {
          if (!seenPageIds.current.has(item.pageid)) {
            seenPageIds.current.add(item.pageid);
            uniqueNew.push(item);
          }
        }

        // Non-blocking background image preloading for the nearest upcoming items
        uniqueNew.slice(0, 6).forEach((article) => {
          if (article.thumbnail?.source) {
            preloadImage(article.thumbnail.source).catch(() => {});
          }
        });

        if (uniqueNew.length > 0) {
          setArticles((prev) => [...prev, ...uniqueNew]);
        }
      } catch (error) {
        console.error("Error fetching Wikipedia articles:", error);
      } finally {
        isFetchingRef.current = false;
        setLoading(false);
        setIsFetchingMore(false);
      }
    },
    [fetchBatch, topic]
  );

  const fetchMoreArticles = useCallback(() => {
    fetchArticles(false);
  }, [fetchArticles]);

  // Initial fetch and language/topic change handler
  useEffect(() => {
    resetFeed();
    fetchArticles(true);
  }, [currentLanguage.id, topic, fetchArticles, resetFeed]);

  return {
    articles,
    loading,
    isFetchingMore,
    topic,
    setTopic,
    fetchArticles: fetchMoreArticles,
  };
}
