import { useState, useEffect, useMemo, useCallback, ReactNode } from "react";
import type { WikiArticle } from "../components/WikiCard";
import { likeKey, type LikeIdentity } from "../lib/likeKey";
import { LikedArticlesContext } from "../hooks/useLikedArticles";

function loadLikedArticles(): WikiArticle[] {
  try {
    const saved = localStorage.getItem("likedArticles");
    if (!saved) return [];
    const parsed = JSON.parse(saved) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is WikiArticle =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as WikiArticle).pageid === "number" &&
        typeof (item as WikiArticle).title === "string"
    );
  } catch {
    return [];
  }
}

export function LikedArticlesProvider({ children }: { children: ReactNode }) {
  const [likedArticles, setLikedArticles] = useState<WikiArticle[]>(loadLikedArticles);

  useEffect(() => {
    try {
      localStorage.setItem("likedArticles", JSON.stringify(likedArticles));
    } catch {
      // Private mode and full storage should not crash the feed.
    }
  }, [likedArticles]);

  const keys = useMemo(() => new Set(likedArticles.map((article) => likeKey(article))), [likedArticles]);

  const toggleLike = useCallback((article: WikiArticle) => {
    const key = likeKey(article);
    setLikedArticles((prev) => {
      const alreadyLiked = prev.some((item) => likeKey(item) === key);
      if (alreadyLiked) return prev.filter((item) => likeKey(item) !== key);
      return [...prev, article];
    });
  }, []);

  const isLiked = useCallback((article: LikeIdentity) => keys.has(likeKey(article)), [keys]);

  const value = useMemo(
    () => ({ likedArticles, toggleLike, isLiked }),
    [likedArticles, toggleLike, isLiked]
  );

  return (
    <LikedArticlesContext.Provider value={value}>
      {children}
    </LikedArticlesContext.Provider>
  );
}