import { LANGUAGES, type Language } from "../languages";

const RTL_LANGUAGE_IDS = new Set(["ar", "fa", "he", "ur", "ks"]);

export function isRtlLanguage(languageId: string | undefined): boolean {
  if (!languageId) return false;
  const base = languageId.split("-")[0];
  return RTL_LANGUAGE_IDS.has(languageId) || RTL_LANGUAGE_IDS.has(base);
}

export function languageFromId(languageId: string | undefined): Language | undefined {
  if (!languageId) return undefined;
  return LANGUAGES.find((language) => language.id === languageId);
}

export function languageIdFromArticle(article: { lang?: string; url?: string }): string {
  if (article.lang) return article.lang;
  if (!article.url) return "en";
  try {
    const host = new URL(article.url).host;
    const match = LANGUAGES.find((language) =>
      language.api.startsWith(`https://${host}/`)
    );
    return match?.id ?? "en";
  } catch {
    return "en";
  }
}
