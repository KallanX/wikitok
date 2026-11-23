const SENSITIVE =
  /pornograph|erotica|\berotic\b|nudity|nude (?:photo|image|model)|hentai|sex work|sexual content|explicit sexual|\bxxx\b|إباح|色情|ポルノ|포르노|порнограф/i;

export function looksSensitive(title: string, categories: string[] = []): boolean {
  return SENSITIVE.test(`${title}\n${categories.join("\n")}`);
}

export function isDisambiguation(page: {
  title?: string;
  pageprops?: Record<string, unknown> | null;
}): boolean {
  if (page.pageprops && Object.prototype.hasOwnProperty.call(page.pageprops, "disambiguation")) {
    return true;
  }
  return /disambiguation|消歧义|消歧義|曖昧さ回避|동음이의/i.test(page.title || "");
}
