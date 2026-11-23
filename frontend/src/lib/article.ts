export interface WikiThumbnail {
  source: string;
  width: number;
  height: number;
}

export interface WikiArticle {
  title: string;
  displaytitle: string;
  extract: string;
  pageid: number;
  url: string;
  lang?: string;
  thumbnail?: WikiThumbnail;
  categories?: string[];
  collections?: string[];
}

export function articleLabel(article: Pick<WikiArticle, "title" | "displaytitle">): string {
  return article.displaytitle || article.title;
}
