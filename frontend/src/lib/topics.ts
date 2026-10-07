export const TOPIC_IDS = ["science", "history", "nature", "space", "art"] as const;
export type TopicId = (typeof TOPIC_IDS)[number];

type TopicTerms = Record<TopicId, string>;

const EN: TopicTerms = {
  science: "science",
  history: "history",
  nature: "nature",
  space: "space",
  art: "art",
};

const HANS: TopicTerms = {
  science: "科学",
  history: "历史",
  nature: "自然",
  space: "太空",
  art: "艺术",
};

const HANT: TopicTerms = {
  science: "科學",
  history: "歷史",
  nature: "自然",
  space: "太空",
  art: "藝術",
};

const TERMS: Record<string, TopicTerms> = {
  en: EN,
  ar: { science: "علوم", history: "تاريخ", nature: "طبيعة", space: "فضاء", art: "فن" },
  bn: { science: "বিজ্ঞান", history: "ইতিহাস", nature: "প্রকৃতি", space: "মহাকাশ", art: "শিল্প" },
  ca: { science: "ciència", history: "història", nature: "natura", space: "espai", art: "art" },
  cs: { science: "věda", history: "historie", nature: "příroda", space: "vesmír", art: "umění" },
  de: { science: "Wissenschaft", history: "Geschichte", nature: "Natur", space: "Weltraum", art: "Kunst" },
  eo: { science: "scienco", history: "historio", nature: "naturo", space: "kosmo", art: "arto" },
  es: { science: "ciencia", history: "historia", nature: "naturaleza", space: "espacio", art: "arte" },
  eu: { science: "zientzia", history: "historia", nature: "natura", space: "espazio", art: "arte" },
  fa: { science: "علم", history: "تاریخ", nature: "طبیعت", space: "فضا", art: "هنر" },
  fi: { science: "tiede", history: "historia", nature: "luonto", space: "avaruus", art: "taide" },
  fr: { science: "science", history: "histoire", nature: "nature", space: "espace", art: "art" },
  el: { science: "επιστήμη", history: "ιστορία", nature: "φύση", space: "διάστημα", art: "τέχνη" },
  he: { science: "מדע", history: "היסטוריה", nature: "טבע", space: "חלל", art: "אמנות" },
  hi: { science: "विज्ञान", history: "इतिहास", nature: "प्रकृति", space: "अंतरिक्ष", art: "कला" },
  hr: { science: "znanost", history: "povijest", nature: "priroda", space: "svemir", art: "umjetnost" },
  hu: { science: "tudomány", history: "történelem", nature: "természet", space: "űr", art: "művészet" },
  id: { science: "ilmu", history: "sejarah", nature: "alam", space: "luar angkasa", art: "seni" },
  it: { science: "scienza", history: "storia", nature: "natura", space: "spazio", art: "arte" },
  ja: { science: "科学", history: "歴史", nature: "自然", space: "宇宙", art: "芸術" },
  ko: { science: "과학", history: "역사", nature: "자연", space: "우주", art: "예술" },
  ml: { science: "ശാസ്ത്രം", history: "ചരിത്രം", nature: "പ്രകൃതി", space: "ബഹിരാകാശം", art: "കല" },
  nl: { science: "wetenschap", history: "geschiedenis", nature: "natuur", space: "ruimte", art: "kunst" },
  pl: { science: "nauka", history: "historia", nature: "przyroda", space: "kosmos", art: "sztuka" },
  pt: { science: "ciência", history: "história", nature: "natureza", space: "espaço", art: "arte" },
  ro: { science: "știință", history: "istorie", nature: "natură", space: "spațiu", art: "artă" },
  ru: { science: "наука", history: "история", nature: "природа", space: "космос", art: "искусство" },
  sk: { science: "veda", history: "história", nature: "príroda", space: "vesmír", art: "umenie" },
  sr: { science: "наука", history: "историја", nature: "природа", space: "свемир", art: "уметност" },
  sv: { science: "vetenskap", history: "historia", nature: "natur", space: "rymden", art: "konst" },
  te: { science: "విజ్ఞానశాస్త్రం", history: "చరిత్ర", nature: "ప్రకృతి", space: "అంతరిక్షం", art: "కళ" },
  th: { science: "วิทยาศาสตร์", history: "ประวัติศาสตร์", nature: "ธรรมชาติ", space: "อวกาศ", art: "ศิลปะ" },
  tr: { science: "bilim", history: "tarih", nature: "doğa", space: "uzay", art: "sanat" },
  uk: { science: "наука", history: "історія", nature: "природа", space: "космос", art: "мистецтво" },
  ur: { science: "سائنس", history: "تاریخ", nature: "فطرت", space: "خلا", art: "فن" },
  vi: { science: "khoa học", history: "lịch sử", nature: "thiên nhiên", space: "vũ trụ", art: "nghệ thuật" },
  ks: { science: "سائنس", history: "تواریخ", nature: "فطرت", space: "خلا", art: "فن" },
  "zh-cn": HANS,
  "zh-sg": HANS,
  "zh-my": HANS,
  "gan-hans": HANS,
  "wuu-hans": HANS,
  "zh-tw": HANT,
  "zh-hk": HANT,
  "zh-mo": HANT,
  "yue-hant": HANT,
  "gan-hant": HANT,
  "wuu-hant": HANT,
};

export function hasOwnTopicTerms(languageId: string): boolean {
  return Object.prototype.hasOwnProperty.call(TERMS, languageId);
}

export function topicSearchTerm(topicId: string, languageId: string): string {
  const terms = TERMS[languageId] ?? TERMS.en;
  if (topicId in terms) return terms[topicId as TopicId];
  return topicId;
}
