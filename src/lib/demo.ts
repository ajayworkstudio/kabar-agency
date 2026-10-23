/** DEMO_MODE=true: dashboard works without any keys, using sample data (actions are disabled). */
export const isDemo = () => process.env.DEMO_MODE === "true";

const h = (n: number) => new Date(Date.now() - n * 3600_000).toISOString();

export function demoData() {
  const sport = {
    category: "olahraga", hook: "Timnas Lolos ke Final Piala AFF!", summary: "Indonesia menang 2–1 atas Vietnam di leg kedua semifinal. Gol penentu lahir di menit 89 dan Indonesia melaju ke final.",
    keyFacts: [{ claim: "Indonesia menang 2–1", sources: ["Antara", "Detik", "Tempo"] }, { claim: "Gol penentu di menit 89", sources: ["Detik", "Tempo"] }],
    carousel: [
      { kind: "cover", title: "Timnas Lolos ke Babak Final Piala AFF", body: "Menang 2–1 lewat gol di menit akhir." },
      { kind: "point", kicker: "Fakta 1", title: "Gol penentu datang di menit 89", body: "Sundulan dari tendangan sudut." },
      { kind: "quote", kicker: "Kata pelatih", title: "Anak-anak bermain dengan hati malam ini" },
      { kind: "point", kicker: "Selanjutnya", title: "Final digelar dua leg, mulai pekan depan" },
      { kind: "closing", title: "Siapa man of the match versimu?" },
    ],
    instagramCaption: "Timnas lolos ke final! 🇮🇩\n\nMenang 2–1 atas Vietnam, gol penentu di menit 89.\n\nSiapa man of the match versimu?\n\nSumber: Antara, Detik, Tempo",
    threadsPost: "Timnas lolos ke final Piala AFF setelah menang 2–1 atas Vietnam. Gol penentunya baru datang di menit 89 😮‍💨 Siapa pemain terbaik semalam menurutmu?",
    threadsFollowUps: ["Final digelar dua leg mulai pekan depan, leg kedua di Jakarta."],
    video: { title: "Timnas lolos ke final Piala AFF!", description: "Ringkasan semifinal.", scenes: [
      { onScreen: "Timnas lolos ke final!", voiceover: "Timnas Indonesia lolos ke final Piala AFF!", seconds: 3 },
      { onScreen: "Gol di menit 89", voiceover: "Gol penentu datang di menit delapan puluh sembilan.", seconds: 4 },
      { onScreen: "Final mulai pekan depan", voiceover: "Final digelar dua leg mulai pekan depan.", seconds: 4 },
      { onScreen: "Siapa MOTM versimu?", voiceover: "Siapa man of the match menurutmu? Tulis di komentar.", seconds: 3 },
    ] },
    tiktokCaption: "Timnas ke final! 🔥 #timnasindonesia #pialaaff", hashtags: ["#timnasindonesia", "#pialaaff", "#sepakbola"],
    sourceCredit: "Sumber: Antara, Detik, Tempo", sensitivity: "low",
  };
  const politik = {
    ...sport, category: "politik", hook: "DPR Sahkan Revisi UU, Ini Poin yang Dipersoalkan", sensitivity: "high",
    summary: "Rapat paripurna mengesahkan revisi undang-undang. Tiga fraksi menyatakan keberatan atas sejumlah pasal.",
    carousel: [{ kind: "cover", title: "DPR Sahkan Revisi UU, Ini Poin yang Dipersoalkan" }, ...sport.carousel.slice(1)],
  };
  return {
    brand: { name: "Kabar Kilat (demo)", handle: "@kabarkilat.id" },
    config: { minSources: 2, minSourcesPolitics: 3, postSlots: ["07:00", "11:30", "16:00", "19:30", "21:00"], platforms: { instagram: true, threads: true, tiktok: true, tiktokAudited: false, youtube: true, telegram: true, videoWorker: true, voiceover: false } },
    drafts: [
      { id: "demo-1", status: "pending", hook: sport.hook, content: sport, fact_check: { verdict: "pass", issues: [] }, card_urls: [1, 2, 3, 4, 5].map((i) => `/demo/card-${i}.png`), video_url: null, targets: ["instagram:carousel", "threads:text", "tiktok:video", "youtube:short"], scheduled_for: null, error: null, created_at: h(0.3), stories: { headline: sport.hook, outlet_count: 5, heat: 92 } },
      { id: "demo-2", status: "pending", hook: politik.hook, content: politik, fact_check: { verdict: "warn", issues: [{ text: "Tiga fraksi menolak", problem: "Sumber menyebut 'menyatakan keberatan', bukan menolak." }] }, card_urls: ["/demo/card-politik.png", "/demo/card-2.png", "/demo/card-5.png"], video_url: null, targets: ["instagram:carousel", "threads:text"], scheduled_for: null, error: null, created_at: h(1.1), stories: { headline: politik.hook, outlet_count: 4, heat: 71 } },
    ],
    stories: [
      { id: "s1", headline: "Timnas Indonesia Kalahkan Vietnam, Lolos ke Final Piala AFF", category: "olahraga", outlet_count: 5, article_count: 11, heat: 92, trend_score: 1, status: "drafted", first_seen_at: h(2) },
      { id: "s2", headline: "DPR Sahkan Revisi UU dalam Rapat Paripurna", category: "politik", outlet_count: 4, article_count: 7, heat: 71, trend_score: 0, status: "drafted", first_seen_at: h(3) },
      { id: "s3", headline: "Konser Band Asal Bandung Pecahkan Rekor Penonton", category: "hiburan", outlet_count: 2, article_count: 3, heat: 38, trend_score: 1, status: "confirmed", first_seen_at: h(4) },
      { id: "s4", headline: "Rupiah Menguat ke Level Terkuat Sebulan Terakhir", category: "ekonomi", outlet_count: 3, article_count: 4, heat: 33, trend_score: 0, status: "confirmed", first_seen_at: h(5) },
      { id: "s5", headline: "Video Pengendara Motor Terobos Banjir Viral di Media Sosial", category: "hiburan", outlet_count: 1, article_count: 1, heat: 9, trend_score: 0, status: "developing", first_seen_at: h(1) },
    ],
    posts: [
      { id: "p1", platform: "instagram", format: "carousel", status: "published", permalink: null, error: null, published_at: h(20), metrics: { views: 18400, likes: 1210, comments: 96, shares: 140, saves: 75 }, drafts: { hook: "Harga BBM Nonsubsidi Turun Mulai Hari Ini", category: "ekonomi" } },
      { id: "p2", platform: "tiktok", format: "video", status: "published", permalink: null, error: null, published_at: h(20), metrics: { views: 52300, likes: 4100, comments: 310, shares: 620 }, drafts: { hook: "Harga BBM Nonsubsidi Turun Mulai Hari Ini", category: "ekonomi" } },
      { id: "p3", platform: "youtube", format: "short", status: "published", permalink: null, error: null, published_at: h(26), metrics: { views: 9100, likes: 540, comments: 22 }, drafts: { hook: "Persib Puncaki Klasemen Liga 1", category: "olahraga" } },
    ],
    sources: [
      { id: "antara-terkini", outlet: "Antara", kind: "rss", enabled: true, last_ok_at: h(0.2), last_error: null, last_item_count: 30 },
      { id: "detik-news", outlet: "Detik", kind: "rss", enabled: true, last_ok_at: h(0.2), last_error: null, last_item_count: 25 },
      { id: "okezone", outlet: "Okezone", kind: "rss", enabled: true, last_ok_at: h(30), last_error: "Status code 404", last_item_count: 0 },
      { id: "trends-id", outlet: "Google Trends", kind: "trends", enabled: true, last_ok_at: h(0.2), last_error: null, last_item_count: 20 },
    ],
    runs: [
      { id: 3, job: "collect", ok: true, summary: "21/22 feeds ok, 64 new articles, 19 stories updated, 20 trend terms", started_at: h(0.2), duration_ms: 8400 },
      { id: 2, job: "generate", ok: true, summary: "2 draft(s)", started_at: h(0.3), duration_ms: 41000 },
      { id: 1, job: "publish", ok: true, summary: "nothing due", started_at: h(0.1), duration_ms: 300 },
    ],
    trends: [{ term: "timnas indonesia", traffic: "500K+" }, { term: "piala aff", traffic: "200K+" }, { term: "harga emas", traffic: "50K+" }, { term: "revisi uu", traffic: "20K+" }],
    tokens: [],
  };
}
