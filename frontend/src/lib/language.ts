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
    const url = new URL(article.url);
    const variant = url.searchParams.get("variant");
    if (variant && languageFromId(variant)) return variant;
    const match = LANGUAGES.find((language) => language.api.startsWith(`https://${url.host}/`));
    return match?.id ?? "en";
  } catch {
    return "en";
  }
}

const CHINESE_REGION: Record<string, string> = {
  tw: "zh-tw",
  hk: "zh-hk",
  mo: "zh-mo",
  sg: "zh-sg",
  my: "zh-my",
  cn: "zh-cn",
};

export function languageFromNavigator(languages: readonly string[]): Language {
  for (const tag of languages) {
    if (!tag) continue;
    const norm = tag.toLowerCase().replace(/_/g, "-");
    const exact = languageFromId(norm);
    if (exact) return exact;
    const [base, region] = norm.split("-");
    if (base === "zh") {
      if (norm.includes("hant") && !region) return languageFromId("zh-tw") ?? LANGUAGES[0];
      const mapped = region ? CHINESE_REGION[region] : undefined;
      if (mapped) return languageFromId(mapped) ?? LANGUAGES[0];
      return languageFromId("zh-cn") ?? LANGUAGES[0];
    }
    const baseMatch = languageFromId(base);
    if (baseMatch) return baseMatch;
  }
  return LANGUAGES[0];
}
