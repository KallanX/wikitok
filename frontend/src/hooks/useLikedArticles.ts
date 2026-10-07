import { createContext, useContext } from "react";
import type { WikiArticle } from "../components/WikiCard";
import type { LikeIdentity } from "../lib/likeKey";

export interface LikedArticlesContextType {
  likedArticles: WikiArticle[];
  toggleLike: (article: WikiArticle) => void;
  isLiked: (article: LikeIdentity) => boolean;
}

export const LikedArticlesContext = createContext<LikedArticlesContextType | undefined>(undefined);

export function useLikedArticles() {
  const context = useContext(LikedArticlesContext);
  if (!context) {
    throw new Error("useLikedArticles must be used within a LikedArticlesProvider");
  }
  return context;
}
