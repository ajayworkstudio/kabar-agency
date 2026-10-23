/**
 * Pure text utilities for grouping headlines about the same event.
 * No I/O here so it can be unit-tested.
 */
import { CATEGORY_HINTS, type Category } from "@/config/sources";

const STOPWORDS = new Set(
  (
    "yang dan di ke dari ini itu untuk dengan pada dalam akan tidak ada adalah juga atau oleh karena sudah " +
    "bisa jadi agar saat setelah sebelum masih hanya lebih para kata soal usai jelang terkait hingga sejak " +
    "bagi antara namun tapi tetapi kini baru begini begitu ini, inilah ternyata resmi segera terbaru hari ini " +
    "kamis jumat sabtu minggu senin selasa rabu video foto berita breaking update live sebut minta " +
    "bakal makin ungkap respons tanggapi buka suara singgung beri dia mereka kita kami anda " +
    "the a an of to in on for and is at by with"
  ).split(/\s+/)
);

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip " - Outlet" suffix that Google News appends to titles. */
export function cleanTitle(title: string, outlet?: string): string {
  let t = title.trim();
  if (outlet && t.endsWith(` - ${outlet}`)) t = t.slice(0, -(outlet.length + 3));
  return t.replace(/\s+[-|]\s+[A-Z][\w.]+(\.com|\.id|\.co\.id)?$/i, "").trim();
}

export function keywords(text: string): string[] {
  const words = normalize(text).split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d{1,2}$/.test(w));
  return [...new Set(words)];
}

/**
 * Similarity between two keyword sets.
 * Overlap coefficient is forgiving of short vs long headlines, but we also require
 * a minimum number of shared words so two unrelated "Timnas …" stories don't merge.
 */
export function similarity(a: string[], b: string[]): { score: number; shared: number } {
  if (!a.length || !b.length) return { score: 0, shared: 0 };
  const B = new Set(b);
  const shared = a.filter((w) => B.has(w)).length;
  return { score: shared / Math.min(a.length, b.length), shared };
}

export function isSameStory(a: string[], b: string[]): boolean {
  const { score, shared } = similarity(a, b);
  return (shared >= 3 && score >= 0.45) || (shared >= 2 && score >= 0.75);
}

export function guessCategory(text: string, fallback?: Category): Category {
  if (fallback && fallback !== "umum") return fallback;
  const t = ` ${normalize(text)} `;
  let best: Category = "umum", bestHits = 0;
  for (const [cat, hints] of Object.entries(CATEGORY_HINTS) as [Category, string[]][]) {
    const hits = hints.filter((h) => t.includes(h.includes(" ") ? h : ` ${h} `) || t.includes(` ${h}`)).length;
    if (hits > bestHits) { best = cat; bestHits = hits; }
  }
  return best;
}

/**
 * Ranking score for a story. Independent outlets matter most;
 * fresh, fast-growing and search-trending stories get a boost; old ones decay.
 */
export function heat(input: { outletCount: number; articleCount: number; recentArticles: number; trendHits: number; ageHours: number }): number {
  const base = input.outletCount * 10 + Math.log2(1 + input.articleCount) * 4 + input.recentArticles * 3 + input.trendHits * 15;
  const decay = Math.pow(0.5, Math.max(0, input.ageHours) / 10); // half-life 10h
  return Math.round(base * decay * 10) / 10;
}

export function matchesTrend(storyKeywords: string[], term: string): boolean {
  const t = keywords(term);
  if (!t.length) return false;
  const S = new Set(storyKeywords);
  const hit = t.filter((w) => S.has(w)).length;
  return hit === t.length || hit >= 2;
}

/**
 * Collapse the many spellings of one newsroom ("detikNews", "detikSport", "Detik")
 * so a single outlet never counts as two independent confirmations.
 */
const OUTLET_ALIASES: [RegExp, string][] = [
  [/^detik/, "detik"],
  [/^cnn ?indonesia/, "cnn indonesia"],
  [/^kompas/, "kompas"],
  [/^antara/, "antara"],
  [/^tempo/, "tempo"],
  [/^tribun/, "tribun"],
  [/^liputan ?6/, "liputan6"],
  [/^kumparan/, "kumparan"],
  [/^okezone/, "okezone"],
  [/^republika/, "republika"],
  [/^suara/, "suara"],
  [/^cnbc ?indonesia/, "cnbc indonesia"],
  [/^(idn ?times)/, "idn times"],
  [/^viva/, "viva"],
  [/^merdeka/, "merdeka"],
  [/^sindonews|^sindo/, "sindonews"],
  [/^jawapos|^jawa pos/, "jawapos"],
  [/^bola\.?(com|net)?/, "bola"],
];

export function canonicalOutlet(name: string): string {
  const n = name.toLowerCase().replace(/\.(com|co\.id|id|net|co)$/g, "").replace(/\s+/g, " ").trim();
  for (const [re, canon] of OUTLET_ALIASES) if (re.test(n)) return canon;
  return n;
}
