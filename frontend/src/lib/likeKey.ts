export interface LikeIdentity {
  lang?: string;
  pageid: number;
  url?: string;
}

/**
 * Page ids are unique only inside one wiki. New likes store `lang`.
 * Older saves have no language, so the article host keeps them apart.
 */
export function likeKey(article: LikeIdentity): string {
  if (article.lang) return `${article.lang}:${article.pageid}`;
  if (article.url) {
    try {
      const host = new URL(article.url).host;
      if (host) return `${host}:${article.pageid}`;
    } catch {
      // Ignore malformed legacy URLs.
    }
  }
  return `legacy:${article.pageid}`;
}
