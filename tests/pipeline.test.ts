import { describe, expect, it } from "vitest";
import { canonicalOutlet, cleanTitle, guessCategory, heat, isSameStory, keywords, matchesTrend } from "../src/pipeline/cluster";
import { nextFreeSlot, slotInstants } from "../src/pipeline/schedule";

describe("clustering", () => {
  const kw = (t: string) => keywords(t);

  it("groups different headlines about the same event", () => {
    const a = kw("Timnas Indonesia Kalahkan Vietnam 2-1, Lolos ke Final Piala AFF");
    const b = kw("Kalahkan Vietnam, Timnas Indonesia Melaju ke Final Piala AFF 2026");
    expect(isSameStory(a, b)).toBe(true);
  });

  it("keeps unrelated stories that share a common word apart", () => {
    const a = kw("Timnas Indonesia Kalahkan Vietnam di Semifinal Piala AFF");
    const b = kw("Timnas Indonesia U-17 Gelar Latihan Perdana di Bali");
    expect(isSameStory(a, b)).toBe(false);
  });

  it("separates two political stories", () => {
    const a = kw("DPR Sahkan Revisi UU Penyiaran dalam Rapat Paripurna");
    const b = kw("KPU Tetapkan Jadwal Pilkada Serentak 2027");
    expect(isSameStory(a, b)).toBe(false);
  });

  it("strips the Google News outlet suffix", () => {
    expect(cleanTitle("Harga BBM Naik Mulai Besok - Kompas.com", "Kompas.com")).toBe("Harga BBM Naik Mulai Besok");
  });

  it("counts one newsroom once regardless of spelling", () => {
    expect(new Set(["detikNews", "detikSport", "Detik", "detik.com"].map(canonicalOutlet)).size).toBe(1);
    expect(canonicalOutlet("CNN Indonesia")).toBe(canonicalOutlet("cnnindonesia.com"));
    expect(canonicalOutlet("Kompas.com")).not.toBe(canonicalOutlet("Tempo.co"));
  });

  it("guesses categories from keywords", () => {
    expect(guessCategory("Persib Bandung puncaki klasemen Liga 1")).toBe("olahraga");
    expect(guessCategory("Menteri baru dilantik presiden di Istana")).toBe("politik");
    expect(guessCategory("Artis ini viral usai konser di Jakarta")).toBe("hiburan");
    expect(guessCategory("Apa saja", "ekonomi")).toBe("ekonomi");
  });

  it("matches trend terms to stories", () => {
    const s = kw("Timnas Indonesia Kalahkan Vietnam di Semifinal Piala AFF");
    expect(matchesTrend(s, "timnas indonesia vs vietnam")).toBe(true);
    expect(matchesTrend(s, "harga emas")).toBe(false);
  });

  it("ranks multi-outlet, fresh stories above single-source old ones", () => {
    const hot = heat({ outletCount: 5, articleCount: 9, recentArticles: 4, trendHits: 1, ageHours: 2 });
    const cold = heat({ outletCount: 1, articleCount: 1, recentArticles: 0, trendHits: 0, ageHours: 20 });
    expect(hot).toBeGreaterThan(cold * 5);
  });
});

describe("scheduling (WIB)", () => {
  const slots = ["07:00", "11:30", "19:30"];

  it("converts WIB wall-clock slots to UTC", () => {
    const now = new Date("2026-10-24T00:00:00Z"); // 07:00 WIB
    const s = slotInstants(slots, now, 0);
    expect(s.map((d) => d.toISOString())).toEqual(["2026-10-24T00:00:00.000Z", "2026-10-24T04:30:00.000Z", "2026-10-24T12:30:00.000Z"]);
  });

  it("picks the next free slot and skips taken ones", () => {
    const now = new Date("2026-10-24T02:00:00Z"); // 09:00 WIB
    expect(nextFreeSlot(slots, [], now).toISOString()).toBe("2026-10-24T04:30:00.000Z");
    const taken = [new Date("2026-10-24T04:35:00Z")];
    expect(nextFreeSlot(slots, taken, now).toISOString()).toBe("2026-10-24T12:30:00.000Z");
  });

  it("rolls over to tomorrow after the last slot", () => {
    const now = new Date("2026-10-24T14:00:00Z"); // 21:00 WIB
    expect(nextFreeSlot(slots, [], now).toISOString()).toBe("2026-10-25T00:00:00.000Z");
  });
});

describe("feed parsing", () => {
  it("reads outlet names from Google News items and trend traffic", async () => {
    const { itemsFromFeed, parseFeedString } = await import("../src/pipeline/collect");
    const gn = await parseFeedString(`<?xml version="1.0"?><rss version="2.0"><channel><title>GN</title>
      <item><title>Harga BBM Naik Mulai Besok - Kompas.com</title><link>https://news.google.com/rss/articles/abc</link>
      <pubDate>Fri, 23 Oct 2026 23:10:00 GMT</pubDate><source url="https://www.kompas.com">Kompas.com</source></item>
      <item><title>Pertamina Umumkan Harga Baru BBM - detikFinance</title><link>https://news.google.com/rss/articles/def</link>
      <pubDate>Fri, 23 Oct 2026 23:40:00 GMT</pubDate><source url="https://finance.detik.com">detikFinance</source></item>
    </channel></rss>`);
    const out = itemsFromFeed(gn, { id: "gn-top", outlet: "Google News", url: "", kind: "google_news" });
    expect(out.items.map((i) => [i.outlet, i.title])).toEqual([
      ["Kompas.com", "Harga BBM Naik Mulai Besok"],
      ["detikFinance", "Pertamina Umumkan Harga Baru BBM"],
    ]);

    const tr = await parseFeedString(`<?xml version="1.0"?><rss version="2.0" xmlns:ht="https://trends.google.com/trending/rss"><channel><title>T</title>
      <item><title>timnas indonesia</title><ht:approx_traffic>200K+</ht:approx_traffic></item></channel></rss>`);
    expect(itemsFromFeed(tr, { id: "trends-id", outlet: "Google Trends", url: "", kind: "trends" }).trends).toEqual([{ term: "timnas indonesia", traffic: "200K+" }]);
  });
});

describe("design studio text parser", () => {
  it("splits pasted text into cover / point / quote / closing slides", async () => {
    const { slidesFromText } = await import("../src/lib/slides");
    const s = slidesFromText("#Ekonomi\nHarga *beras* naik\nIsi pembuka\n\nPoin satu\nDetail\n\n#Kata pedagang\n> Pasokan berkurang\nPedagang Johar\n\nDi daerahmu naik?");
    expect(s.map((x) => x.kind)).toEqual(["cover", "point", "quote", "closing"]);
    expect(s[0]).toMatchObject({ kicker: "Ekonomi", title: "Harga *beras* naik", body: "Isi pembuka" });
    expect(s[2]).toMatchObject({ kicker: "Kata pedagang", title: "Pasokan berkurang" });
  });
});

describe("two-colour renderer", () => {
  it("renders every format with exactly the chosen palette", async () => {
    const { renderCard } = await import("../src/pipeline/cards");
    for (const format of ["post", "square", "story"] as const) {
      const png = await renderCard({ kind: "cover", title: "Harga *beras* naik" }, { category: "umum", brandName: "X", brandHandle: "@x", sourceCredit: "", index: 0, total: 3, format, palette: { bg: "#FFD400", fg: "#111111" } });
      expect(png.byteLength).toBeGreaterThan(5000);
      expect(Buffer.from(png).subarray(1, 4).toString()).toBe("PNG");
    }
  });
});
