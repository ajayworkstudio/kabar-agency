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

describe("manual posting + Gen Z", () => {
  it("builds paste-ready captions with hashtags appended once", async () => {
    const { captionKit } = await import("../src/lib/captions");
    const kit = captionKit({ hook: "H", instagramCaption: "Big news #Moto3", tiktokCaption: "Pole!", threadsPost: "Thread", threadsFollowUps: ["More"], hashtags: ["#Moto3", "VedaEga"], video: { title: "T", description: "D", scenes: [] } } as never);
    const ig = kit.find((k) => k.id === "ig")!.text;
    expect(ig).toContain("#VedaEga");
    expect(ig.match(/#Moto3/g)!.length).toBe(1);
    expect(kit.find((k) => k.id === "threads")!.text).toContain("More");
  });
  it("scores Gen Z topics above general news", async () => {
    const { genzScore } = await import("../src/config/genz");
    expect(genzScore("Konser idol K-pop di Jakarta bikin netizen heboh")).toBeGreaterThan(1);
    expect(genzScore("Rapat koordinasi anggaran daerah")).toBe(0);
  });
});

describe("story → Dita without AI", () => {
  it("builds studio text: cover, one slide per outlet angle, comment prompt", async () => {
    const { storyToText, slidesFromText } = await import("../src/lib/slides");
    const out = storyToText(
      { headline: "Timnas lolos ke final Piala AFF", category: "olahraga" },
      [
        { outlet: "Antara", title: "Timnas lolos ke final Piala AFF", snippet: "Menang 2-1 atas Vietnam.", url: "#" },
        { outlet: "Detik", title: "Gol menit 89 bawa Garuda ke final", snippet: "Sundulan dari sepak pojok.", url: "#" },
      ],
      "en",
      "Olahraga"
    );
    const slides = slidesFromText(out.text);
    expect(slides.map((s) => s.kind)).toEqual(["cover", "point", "closing"]);
    expect(slides[1]).toMatchObject({ kicker: "Detik", title: "Gol menit 89 bawa Garuda ke final" });
    expect(out.credit).toBe("Source: Antara, Detik");
  });
});

describe("article link to slides", () => {
  it("builds cover, points and a comment prompt", async () => {
    const { articleToText, slidesFromText } = await import("../src/lib/slides");
    const text = "Promotor menyebut 20.500 penonton dari luar negeri sudah membeli tiket konser. Penonton terutama datang dari Australia, Singapura, dan Malaysia. Konser digelar di Stadion Utama GBK pada 24 Oktober. Panggung memakai konsep 360 derajat dengan ornamen globe besar.";
    const out = articleToText({ title: "Promotor Konser Kanye West: 20 Ribu Penonton dari Luar Negeri", text, outlet: "CNN Indonesia" }, "en");
    const slides = slidesFromText(out.text);
    expect(slides[0]).toMatchObject({ kind: "cover", title: "Promotor Konser Kanye West: 20 Ribu Penonton dari Luar Negeri" });
    expect(slides.at(-1)!.kind).toBe("closing");
    expect(slides.length).toBe(4);
    expect(out.credit).toBe("Source: CNN Indonesia");
  });
});

describe("raw text summariser", () => {
  const raw = `Promotor Konser Kanye West Jakarta: 20 Ribu Penonton dari Luar Negeri

Jakarta, CNN Indonesia -- Promotor konser Raw Vision Collective menyebut 20.500 penonton dari luar negeri sudah membeli tiket konser di GBK pada 24 Oktober.

"Hingga hari ini, dengan bangga kita sampaikan ada 20.500 teman-teman dari luar negeri yang sudah membeli tiket," kata Karen Tjahja di Jakarta, Kamis (22/10).

ADVERTISEMENT
Baca juga: Daftar Harga Tiket Konser Kanye West Jakarta

Selain itu, promotor memperkirakan lebih dari 30.000 penonton datang dari berbagai kota di Indonesia.
Kanye dijadwalkan membawakan sekitar 35 lagu, termasuk Gold Digger dan Can't Tell Me Nothing.
Panggung konser mengusung konsep 360 derajat dengan ornamen globe berukuran besar.

(fby/end)`;

  it("follows the chosen format", async () => {
    const { summarizeRaw } = await import("../src/lib/summarize");
    const { slidesFromText } = await import("../src/lib/slides");
    const out = summarizeRaw(raw, { slides: 5, quote: true, closing: "question", labels: "numbered" }, "en")!;
    const slides = slidesFromText(out.text);
    expect(slides).toHaveLength(5);
    expect(slides[0].kind).toBe("cover");
    expect(slides[0].title).toContain("*20 Ribu*");
    expect(slides.find((s) => s.kind === "quote")?.body).toBe("Karen Tjahja");
    expect(slides.at(-1)!.kind).toBe("closing");
    expect(out.credit).toBe("Source: CNN Indonesia");
    expect(out.text).not.toMatch(/ADVERTISEMENT|Baca juga|fby/);
    expect(out.text).toContain("*30.000* penonton"); // highlight keeps its space; "Selain itu," connector dropped
  });

  it("no quote, no closing → all points", async () => {
    const { summarizeRaw } = await import("../src/lib/summarize");
    const { slidesFromText } = await import("../src/lib/slides");
    const slides = slidesFromText(summarizeRaw(raw, { slides: 4, quote: false, closing: "none", labels: "none" }, "id")!.text);
    expect(slides).toHaveLength(4);
    expect(slides.every((s) => !s.kicker)).toBe(true);
  });
});

describe("bullet lists on slides", () => {
  it("parses '- ' lines into bullets and round-trips", async () => {
    const { slidesFromText, slidesToText } = await import("../src/lib/slides");
    const text = "#Price list\niPhone Duo *prices*\nAll four options.\n- iPhone Duo 256 GB: Rp 45.678.910\n- iPhone Duo 512 GB: Rp 51.999.000\n\nThat's it";
    const slides = slidesFromText(text);
    expect(slides[0]).toMatchObject({ kicker: "Price list", title: "iPhone Duo *prices*", body: "All four options.", bullets: ["iPhone Duo 256 GB: Rp 45.678.910", "iPhone Duo 512 GB: Rp 51.999.000"] });
    expect(slides[1].bullets).toBeUndefined();
    expect(slidesFromText(slidesToText(slides))).toEqual(slides);
  });

  it("summariser turns a price list in the article into a bullet slide", async () => {
    const { summarizeRaw } = await import("../src/lib/summarize");
    const { slidesFromText } = await import("../src/lib/slides");
    const raw = `Harga iPhone Duo Resmi di Indonesia

Jakarta, CNBC Indonesia -- Apple resmi merilis iPhone Duo di Indonesia hari ini. Ponsel lipat itu dijual mulai Rp45,6 juta untuk varian terkecil.

Berikut daftar harga iPhone Duo di Indonesia:
- iPhone Duo 256 GB: Rp 45.678.910
- iPhone Duo 512 GB: Rp 51.999.000
- iPhone Duo 1 TB: Rp 61.999.000

Pemesanan awal dibuka mulai 30 Oktober melalui iBox dan Erafone. Unit pertama dijadwalkan sampai ke konsumen pada 7 November 2026.`;
    const slides = slidesFromText(summarizeRaw(raw, { slides: 5, quote: false, closing: "question", labels: "numbered" }, "en")!.text);
    const list = slides.find((s) => s.bullets);
    expect(list?.title).toBe("Daftar harga iPhone Duo di Indonesia");
    expect(list?.bullets).toEqual(["iPhone Duo 256 GB: Rp 45.678.910", "iPhone Duo 512 GB: Rp 51.999.000", "iPhone Duo 1 TB: Rp 61.999.000"]);
    expect(slides.map((s) => s.title).join(" ")).not.toContain("Rp 51.999.000"); // list lines don't leak into fact slides
  });

  it("renders a bullet slide", async () => {
    const { renderCarousel } = await import("../src/pipeline/cards");
    const out = await renderCarousel([{ kind: "point", title: "Prices", bullets: ["256 GB: Rp 45.678.910", "No colon row"] }], { category: "teknologi", brandName: "b", brandHandle: "@b", sourceCredit: "", palette: { bg: "#F4F1EA", fg: "#111111" } });
    expect(out[0].byteLength).toBeGreaterThan(10000);
  });
});

describe("slide photos", () => {
  const png1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  it("renders every layout in every format", async () => {
    const { renderCard } = await import("../src/pipeline/cards");
    for (const format of ["post", "square", "story"] as const)
      for (const imageLayout of ["top", "bottom", "left", "right", "full"] as const) {
        const out = await renderCard({ kind: "point", title: "Photo *test*", body: "Body", image: png1x1, imageLayout }, { category: "umum", brandName: "b", brandHandle: "@b", sourceCredit: "", index: 0, total: 2, format, palette: { bg: "#F4F1EA", fg: "#111111" } });
        expect(out.byteLength).toBeGreaterThan(5000);
      }
  }, 30000);
  it("schema accepts https or data:image and rejects anything else", async () => {
    const { SlideInput } = await import("../src/lib/design");
    expect(SlideInput.safeParse({ kind: "point", title: "x", image: png1x1, imageLayout: "full" }).success).toBe(true);
    expect(SlideInput.safeParse({ kind: "point", title: "x", image: "https://x.supabase.co/a.jpg" }).success).toBe(true);
    expect(SlideInput.safeParse({ kind: "point", title: "x", image: "javascript:alert(1)" }).success).toBe(false);
    expect(SlideInput.safeParse({ kind: "point", title: "x", image: "http://insecure/a.jpg" }).success).toBe(false);
  });
});
