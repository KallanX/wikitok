import { useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import type { WikiArticle } from "../lib/article";
import { likeKey, type LikeIdentity } from "../lib/likeKey";
import { LikedArticlesContext } from "../hooks/useLikedArticles";

const ORDER_FLAG = "likedArticles.newestFirst";

function isArticle(item: unknown): item is WikiArticle {
  return Boolean(
    item &&
      typeof item === "object" &&
      typeof (item as WikiArticle).pageid === "number" &&
      typeof (item as WikiArticle).title === "string"
  );
}

function loadLikedArticles(): WikiArticle[] {
  try {
    const saved = localStorage.getItem("likedArticles");
    if (!saved) return [];
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];
    const articles = parsed.filter(isArticle);
    if (!localStorage.getItem(ORDER_FLAG)) {
      articles.reverse();
      localStorage.setItem(ORDER_FLAG, "1");
    }
    return articles;
  } catch {
    return [];
  }
}

export function LikedArticlesProvider({ children }: { children: ReactNode }) {
  const [likedArticles, setLikedArticles] = useState<WikiArticle[]>(loadLikedArticles);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem("likedArticles", JSON.stringify(likedArticles));
      localStorage.setItem(ORDER_FLAG, "1");
      queueMicrotask(() => setStorageWarning((current) => (current ? null : current)));
    } catch {
      queueMicrotask(() =>
        setStorageWarning("This browser couldn't save your likes. Export them before you leave.")
      );
    }
  }, [likedArticles]);

  const keys = useMemo(() => new Set(likedArticles.map((article) => likeKey(article))), [likedArticles]);

  const toggleLike = useCallback((article: WikiArticle) => {
    const key = likeKey(article);
    setLikedArticles((prev) => {
      const alreadyLiked = prev.some((item) => likeKey(item) === key);
      if (alreadyLiked) return prev.filter((item) => likeKey(item) !== key);
      return [article, ...prev];
    });
  }, []);

  const isLiked = useCallback((article: LikeIdentity) => keys.has(likeKey(article)), [keys]);

  const setCollections = useCallback((article: LikeIdentity, collections: string[]) => {
    const key = likeKey(article);
    const cleaned = collections.map((name) => name.trim()).filter(Boolean).slice(0, 8);
    setLikedArticles((prev) =>
      prev.map((item) => (likeKey(item) === key ? { ...item, collections: cleaned } : item))
    );
  }, []);

  const importLikes = useCallback((value: unknown) => {
    const incoming = Array.isArray(value) ? value.filter(isArticle) : [];
    let added = 0;
    setLikedArticles((prev) => {
      const seen = new Set(prev.map((item) => likeKey(item)));
      const fresh = incoming.filter((item) => {
        const key = likeKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      added = fresh.length;
      return [...fresh, ...prev];
    });
    return added;
  }, []);

  const value = useMemo(
    () => ({ likedArticles, toggleLike, isLiked, storageWarning, setCollections, importLikes }),
    [likedArticles, toggleLike, isLiked, storageWarning, setCollections, importLikes]
  );

  return <LikedArticlesContext.Provider value={value}>{children}</LikedArticlesContext.Provider>;
}
