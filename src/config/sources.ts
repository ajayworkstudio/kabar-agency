/**
 * News sources. Each outlet counts once toward "independent confirmation",
 * no matter how many of its feeds report the story.
 *
 * Feed URLs change from time to time. The dashboard's Sources panel shows
 * last success / last error per feed, so a dead feed is easy to spot and fix here.
 */
export type SourceDef = {
  id: string;
  outlet: string;
  url: string;
  kind: "rss" | "google_news" | "trends";
  category?: Category;
};

export type Category = "politik" | "olahraga" | "hiburan" | "ekonomi" | "teknologi" | "umum";

const gnews = (q: string) =>
  `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=id&gl=ID&ceid=ID:id`;

export const SOURCES: SourceDef[] = [
  // ── Wire / general ──
  { id: "antara-terkini", outlet: "Antara", url: "https://www.antaranews.com/rss/terkini.xml", kind: "rss" },
  { id: "antara-politik", outlet: "Antara", url: "https://www.antaranews.com/rss/politik.xml", kind: "rss", category: "politik" },
  { id: "antara-olahraga", outlet: "Antara", url: "https://www.antaranews.com/rss/olahraga.xml", kind: "rss", category: "olahraga" },
  { id: "antara-hiburan", outlet: "Antara", url: "https://www.antaranews.com/rss/hiburan.xml", kind: "rss", category: "hiburan" },

  { id: "cnn-nasional", outlet: "CNN Indonesia", url: "https://www.cnnindonesia.com/nasional/rss", kind: "rss", category: "politik" },
  { id: "cnn-olahraga", outlet: "CNN Indonesia", url: "https://www.cnnindonesia.com/olahraga/rss", kind: "rss", category: "olahraga" },
  { id: "cnn-hiburan", outlet: "CNN Indonesia", url: "https://www.cnnindonesia.com/hiburan/rss", kind: "rss", category: "hiburan" },
  { id: "cnn-ekonomi", outlet: "CNN Indonesia", url: "https://www.cnnindonesia.com/ekonomi/rss", kind: "rss", category: "ekonomi" },

  { id: "detik-news", outlet: "Detik", url: "https://news.detik.com/rss", kind: "rss" },
  { id: "detik-sport", outlet: "Detik", url: "https://sport.detik.com/rss", kind: "rss", category: "olahraga" },
  { id: "detik-hot", outlet: "Detik", url: "https://hot.detik.com/rss", kind: "rss", category: "hiburan" },

  { id: "tempo-nasional", outlet: "Tempo", url: "https://rss.tempo.co/nasional", kind: "rss", category: "politik" },

  { id: "republika", outlet: "Republika", url: "https://www.republika.co.id/rss", kind: "rss" },
  { id: "okezone", outlet: "Okezone", url: "https://sindikasi.okezone.com/index.php/okezone/RSS2.0", kind: "rss" },

  // ── Google News topic queries (aggregates many outlets; outlet name is read per item) ──
  { id: "gn-top", outlet: "Google News", url: "https://news.google.com/rss?hl=id&gl=ID&ceid=ID:id", kind: "google_news" },
  { id: "gn-politik", outlet: "Google News", url: gnews("politik indonesia when:1d"), kind: "google_news", category: "politik" },
  { id: "gn-timnas", outlet: "Google News", url: gnews("timnas indonesia OR liga 1 when:1d"), kind: "google_news", category: "olahraga" },
  { id: "gn-viral", outlet: "Google News", url: gnews("viral when:1d"), kind: "google_news", category: "hiburan" },
  { id: "gn-artis", outlet: "Google News", url: gnews("artis OR selebriti when:1d"), kind: "google_news", category: "hiburan" },

  // ── What people are searching right now ──
  { id: "trends-id", outlet: "Google Trends", url: "https://trends.google.com/trending/rss?geo=ID", kind: "trends" },
];

/** Keyword hints used when a feed has no category of its own. */
export const CATEGORY_HINTS: Record<Exclude<Category, "umum">, string[]> = {
  politik: ["dpr", "mpr", "presiden", "menteri", "pilkada", "pemilu", "partai", "kpu", "bawaslu", "gubernur", "bupati", "wali kota", "kabinet", "istana", "prabowo", "gibran", "ruu", "uu ", "mk ", "kpk", "polri", "tni", "demo"],
  olahraga: ["timnas", "liga 1", "piala", "persib", "persija", "arema", "pssi", "bulu tangkis", "badminton", "motogp", "f1", "sepak bola", "gol", "pelatih", "klasemen", "skuad", "laga", "vs "],
  hiburan: ["artis", "aktor", "aktris", "selebriti", "film", "konser", "musisi", "penyanyi", "viral", "netizen", "drama", "k-pop", "sinetron", "youtuber", "tiktoker", "cerai", "nikah"],
  ekonomi: ["rupiah", "ihsg", "inflasi", "harga", "bbm", "pajak", "bank indonesia", "ojk", "saham", "ekspor", "impor", "umr", "ump"],
  teknologi: ["aplikasi", "ai ", "smartphone", "startup", "internet", "siber", "hacker", "data bocor"],
};
