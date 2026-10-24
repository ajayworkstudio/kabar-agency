/** DEMO_MODE=true: the whole admin app works without any keys, using sample data (actions are disabled). */
import { buildCharts } from "./charts";

export const isDemo = () => process.env.DEMO_MODE === "true";

const AGENT_ID = "00000000-0000-4000-8000-000000000001";

/** Deterministic pseudo-random so the demo looks the same on every reload. */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export function demoWorkspace() {
  const now = Date.now();
  const h = (n: number) => new Date(now - n * 3600_000).toISOString();
  const r = rng(42);

  const raka = {
    id: AGENT_ID,
    slug: "raka",
    name: "Raka",
    role: "Editor Berita Sosial Media",
    kind: "writer",
    color: "#5E6AD2",
    status: "active",
    platforms: ["instagram:carousel", "threads:text", "tiktok:video", "youtube:short"],
    categories: [],
    responsibilities: [
      "Memantau 20+ sumber berita nasional dan Google Trends setiap 20 menit",
      "Memverifikasi setiap berita minimal ke 2 outlet (politik 3 outlet)",
      "Menulis draft carousel, caption, Threads, dan skrip video",
      "Mengajukan draft ke admin untuk disetujui sebelum terbit",
      "Mengirim laporan harian berita terbaru setiap pukul 07.00 WIB",
    ],
    settings: { minSources: 2, minSourcesPolitics: 3, maxDraftsPerDay: 12, reportHour: 7, focus: "genz" },
    created_at: h(24 * 14),
  };

  const dita = {
    id: "00000000-0000-4000-8000-000000000002",
    slug: "dita",
    name: "Dita",
    role: "Desainer Konten",
    kind: "designer",
    color: "#E467B4",
    status: "active",
    platforms: ["instagram:carousel", "threads:carousel"],
    categories: [],
    responsibilities: [
      "Mengubah teks dari admin menjadi desain carousel, post kotak, dan story",
      "Hanya memakai 2 warna per desain sesuai palet yang dipilih admin",
      "Menyorot kata penting yang ditandai *bintang* dengan blok warna terbalik",
      "Mengirim hasil desain ke Inbox untuk disetujui sebelum terbit",
    ],
    settings: { minSources: 2, minSourcesPolitics: 3, maxDraftsPerDay: 30, reportHour: 7, palette: { bg: "#F4F1EA", fg: "#111111" }, format: "post" },
    created_at: h(5),
  };

  const sport = {
    category: "olahraga", hook: "Timnas Lolos ke Final Piala AFF!", summary: "Indonesia menang 2–1 atas Vietnam di leg kedua semifinal. Gol penentu lahir di menit 89 dan Indonesia melaju ke final.",
    keyFacts: [{ claim: "Indonesia menang 2–1 atas Vietnam", sources: ["Antara", "Detik", "Tempo"] }, { claim: "Gol penentu di menit 89", sources: ["Detik", "Tempo"] }, { claim: "Final digelar dua leg", sources: ["Antara"] }],
    carousel: [
      { kind: "cover", title: "Timnas Lolos ke Babak Final Piala AFF", body: "Menang 2–1 lewat gol di menit akhir." },
      { kind: "point", kicker: "Fakta 1", title: "Gol penentu datang di menit 89", body: "Sundulan dari tendangan sudut." },
      { kind: "quote", kicker: "Kata pelatih", title: "Anak-anak bermain dengan hati malam ini" },
      { kind: "point", kicker: "Selanjutnya", title: "Final digelar dua leg, mulai pekan depan" },
      { kind: "closing", title: "Siapa man of the match versimu?" },
    ],
    instagramCaption: "Timnas lolos ke final! 🇮🇩\n\nMenang 2–1 atas Vietnam, gol penentu di menit 89.\n\nSiapa man of the match versimu?\n\nSumber: Antara, Detik, Tempo",
    threadsPost: "Timnas lolos ke final Piala AFF setelah menang 2–1 atas Vietnam. Gol penentunya baru datang di menit 89. Siapa pemain terbaik semalam menurutmu?",
    threadsFollowUps: ["Final digelar dua leg mulai pekan depan, leg kedua di Jakarta."],
    video: { title: "Timnas lolos ke final Piala AFF!", description: "Ringkasan semifinal.", scenes: [
      { onScreen: "Timnas lolos ke final!", voiceover: "Timnas Indonesia lolos ke final Piala AFF!", seconds: 3 },
      { onScreen: "Gol di menit 89", voiceover: "Gol penentu datang di menit delapan puluh sembilan.", seconds: 4 },
      { onScreen: "Final mulai pekan depan", voiceover: "Final digelar dua leg mulai pekan depan.", seconds: 4 },
      { onScreen: "Siapa MOTM versimu?", voiceover: "Siapa man of the match menurutmu? Tulis di komentar.", seconds: 3 },
    ] },
    tiktokCaption: "Timnas ke final! #timnasindonesia #pialaaff", hashtags: ["#timnasindonesia", "#pialaaff", "#sepakbola"],
    sourceCredit: "Sumber: Antara, Detik, Tempo", sensitivity: "low",
  };
  const politik = {
    ...sport, category: "politik", hook: "DPR Sahkan Revisi UU, Ini Poin yang Dipersoalkan", sensitivity: "high",
    summary: "Rapat paripurna mengesahkan revisi undang-undang. Tiga fraksi menyatakan keberatan atas sejumlah pasal.",
    keyFacts: [{ claim: "Revisi UU disahkan dalam rapat paripurna", sources: ["Antara", "Kompas", "Tempo", "Detik"] }, { claim: "Tiga fraksi menyatakan keberatan", sources: ["Tempo", "Kompas"] }],
    carousel: [{ kind: "cover", title: "DPR Sahkan Revisi UU, Ini Poin yang Dipersoalkan" }, ...sport.carousel.slice(1)],
    sourceCredit: "Sumber: Antara, Kompas, Tempo, Detik",
  };

  const drafts = [
    { id: "demo-d1", agent_id: AGENT_ID, status: "pending", hook: sport.hook, content: sport, fact_check: { verdict: "pass", issues: [] }, card_urls: [1, 2, 3, 4, 5].map((i) => `/demo/card-${i}.png`), video_url: null, targets: raka.platforms, scheduled_for: null, error: null, created_at: h(0.3), stories: { headline: sport.hook, outlet_count: 5, heat: 92 } },
    { id: "demo-d2", agent_id: AGENT_ID, status: "pending", hook: politik.hook, content: politik, fact_check: { verdict: "warn", issues: [{ text: "Tiga fraksi menolak", problem: "Sumber menyebut 'menyatakan keberatan', bukan menolak." }] }, card_urls: ["/demo/card-politik.png", "/demo/card-2.png", "/demo/card-5.png"], video_url: null, targets: ["instagram:carousel", "threads:text"], scheduled_for: null, error: null, created_at: h(1.1), stories: { headline: politik.hook, outlet_count: 4, heat: 71 } },
    { id: "demo-d4", agent_id: AGENT_ID, status: "ready", hook: "Veda Ega takes pole at the Australian GP", content: { ...sport, hook: "Veda Ega takes pole at the Australian GP", instagramCaption: "History made 🇮🇩 Veda Ega becomes the first Indonesian rider to take a Grand Prix pole.\n\nRace starts Sunday 07:00 WIB — where does he finish?", tiktokCaption: "First Indonesian on GP pole 🔥", hashtags: ["#VedaEga", "#Moto3", "#AustralianGP"], design: { palette: { bg: "#F4F1EA", fg: "#111111" }, format: "post" } }, fact_check: { verdict: "pass", issues: [] }, card_urls: ["/demo/card-1.png", "/demo/card-2.png"], video_url: null, targets: ["instagram:carousel", "tiktok:video"], scheduled_for: null, error: null, created_at: h(0.9), stories: { headline: "Veda Ega pole", outlet_count: 4, heat: 80 } },
    { id: "demo-d3", agent_id: AGENT_ID, status: "scheduled", hook: "Rupiah Menguat ke Level Terkuat Sebulan", content: { ...sport, category: "ekonomi", hook: "Rupiah Menguat ke Level Terkuat Sebulan" }, fact_check: { verdict: "pass", issues: [] }, card_urls: ["/demo/card-1.png"], video_url: null, targets: ["instagram:carousel", "threads:text"], scheduled_for: new Date(now + 3 * 3600_000).toISOString(), error: null, created_at: h(2.4), stories: { headline: "Rupiah menguat", outlet_count: 3, heat: 33 } },
  ];

  const platforms = ["instagram", "threads", "tiktok", "youtube"];
  const formats: Record<string, string> = { instagram: "carousel", threads: "text", tiktok: "video", youtube: "short" };
  const hooks = ["Harga BBM Nonsubsidi Turun Mulai Hari Ini", "Persib Puncaki Klasemen Liga 1", "Konser Band Bandung Pecahkan Rekor", "Jadwal Libur Panjang Akhir Tahun", "KPU Umumkan Tahapan Pilkada", "Gempa M5,2 Guncang Selatan Jawa", "Harga Emas Antam Naik Lagi"];
  const posts: { id: string; platform: string; format: string; status: string; permalink: string | null; error: string | null; published_at: string; metrics: Record<string, number>; drafts: { hook: string; agent_id: string } }[] = [];
  const pastDrafts: { created_at: string; status: string; agent_id: string }[] = [];
  for (let day = 13; day >= 1; day--) {
    const n = 1 + Math.floor(r() * 3) + (day < 6 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const at = h(day * 24 - 8 - k * 3);
      pastDrafts.push({ created_at: at, status: r() > 0.18 ? "published" : "rejected", agent_id: AGENT_ID });
      const hook = hooks[Math.floor(r() * hooks.length)];
      for (const p of platforms) {
        if (p === "youtube" && r() > 0.6) continue;
        const base = p === "tiktok" ? 30000 : p === "instagram" ? 12000 : p === "youtube" ? 6000 : 3000;
        const views = Math.round(base * (0.4 + r() * 1.4) * (1 + (13 - day) * 0.06));
        posts.push({
          id: `p-${day}-${k}-${p}`, platform: p, format: formats[p], status: "published", permalink: null, error: null, published_at: at,
          metrics: { views, likes: Math.round(views * (0.05 + r() * 0.04)), comments: Math.round(views * 0.006 * (0.5 + r())), shares: Math.round(views * 0.009 * (0.5 + r())), saves: p === "instagram" ? Math.round(views * 0.004) : 0 },
          drafts: { hook, agent_id: AGENT_ID },
        });
      }
    }
  }
  pastDrafts.push(...drafts.map((d) => ({ created_at: d.created_at, status: d.status, agent_id: AGENT_ID })));

  let num = 40;
  const task = (t: { status: string; kind: string; title: string; created_at: string } & Record<string, unknown>) => ({ id: `t-${num}`, number: num--, agent_id: AGENT_ID, description: null, priority: 3, draft_id: null, payload: {}, result: null, error: null, created_by: "system", due_at: null, started_at: null, finished_at: null, ...t });
  const tasks = [
    task({ kind: "draft", title: sport.hook, description: sport.summary, status: "in_review", priority: 2, draft_id: "demo-d1", created_at: h(0.3), started_at: h(0.3), payload: { outlets: 5, category: "olahraga", factCheck: "pass" } }),
    task({ kind: "draft", title: politik.hook, description: politik.summary, status: "in_review", priority: 2, draft_id: "demo-d2", created_at: h(1.1), started_at: h(1.1), payload: { outlets: 4, category: "politik", factCheck: "warn" } }),
    task({ kind: "research", title: "Pantau isu harga beras di Jawa Tengah", status: "in_review", priority: 2, created_by: "admin", created_at: h(5), started_at: h(4.6), payload: { query: "harga beras jawa tengah" },
      result: { query: "harga beras jawa tengah", outlets: 6, summary: "• Harga beras medium di sejumlah pasar Semarang dilaporkan naik dalam sepekan terakhir (Antara, Suara).\n• Bulog menyiapkan operasi pasar di beberapa kabupaten (Kompas, Detik).\n• Satu outlet melaporkan stok gudang aman hingga akhir tahun (hanya Tribun — perlu konfirmasi).\n\nAngle konten:\n1. Carousel \"Cek harga beras di pasarmu\" — perbandingan per kota\n2. Video 30 detik: kenapa harga naik & kapan turun\n3. Threads: tanya pengalaman warga belanja minggu ini",
        articles: [{ outlet: "Antara", title: "Harga beras medium di Semarang naik", url: "#", publishedAt: h(20) }, { outlet: "Kompas.com", title: "Bulog gelar operasi pasar di Jateng", url: "#", publishedAt: h(14) }, { outlet: "detikJateng", title: "Pedagang keluhkan pasokan beras", url: "#", publishedAt: h(9) }] } }),
    task({ kind: "draft", title: "Rupiah Menguat ke Level Terkuat Sebulan", status: "in_progress", draft_id: "demo-d3", created_at: h(2.4), started_at: h(2) }),
    task({ kind: "manual", title: "Siapkan template carousel untuk final Piala AFF", description: "Buat 3 variasi cover untuk hari pertandingan.", status: "todo", priority: 1, created_by: "admin", created_at: h(6), due_at: new Date(now + 48 * 3600_000).toISOString() }),
    task({ kind: "research", title: "Rangkum respons publik soal revisi UU", status: "todo", priority: 3, created_by: "admin", created_at: h(0.8), payload: { query: "revisi uu respons publik" } }),
    task({ kind: "manual", title: "Cek ulang akun TikTok setelah audit", status: "backlog", priority: 4, created_by: "admin", created_at: h(30) }),
    task({ kind: "report", title: "Laporan harian Raka — hari ini", status: "done", priority: 4, created_at: h(3), started_at: h(3), finished_at: h(3) }),
    task({ kind: "draft", title: "Harga BBM Nonsubsidi Turun Mulai Hari Ini", status: "done", created_at: h(26), started_at: h(25), finished_at: h(24) }),
    task({ kind: "draft", title: "Video Pengendara Terobos Banjir Viral", status: "canceled", priority: 4, created_at: h(28), finished_at: h(27) }),
    task({ kind: "draft", title: "Persib Puncaki Klasemen Liga 1", status: "failed", error: "tiktok: privacy level not allowed", created_at: h(29), started_at: h(28), finished_at: h(28) }),
  ];

  const stories = [
    { id: "s1", headline: "Timnas Indonesia Kalahkan Vietnam, Lolos ke Final Piala AFF", category: "olahraga", outlet_count: 5, article_count: 11, heat: 92, trend_score: 1, status: "drafted", first_seen_at: h(2) },
    { id: "s2", headline: "DPR Sahkan Revisi UU dalam Rapat Paripurna", category: "politik", outlet_count: 4, article_count: 7, heat: 71, trend_score: 0, status: "drafted", first_seen_at: h(3) },
    { id: "s3", headline: "Konser Band Asal Bandung Pecahkan Rekor Penonton", category: "hiburan", outlet_count: 2, article_count: 3, heat: 38, trend_score: 1, status: "confirmed", first_seen_at: h(4) },
    { id: "s4", headline: "Rupiah Menguat ke Level Terkuat Sebulan Terakhir", category: "ekonomi", outlet_count: 3, article_count: 4, heat: 33, trend_score: 0, status: "drafted", first_seen_at: h(5) },
    { id: "s5", headline: "Aplikasi Pinjol Ilegal Kembali Diblokir Kominfo", category: "teknologi", outlet_count: 2, article_count: 2, heat: 21, trend_score: 0, status: "confirmed", first_seen_at: h(6) },
    { id: "s6", headline: "Pemprov Umumkan UMP 2027", category: "ekonomi", outlet_count: 2, article_count: 3, heat: 19, trend_score: 1, status: "confirmed", first_seen_at: h(7) },
    { id: "s7", headline: "Video Pengendara Motor Terobos Banjir Viral di Media Sosial", category: "hiburan", outlet_count: 1, article_count: 1, heat: 9, trend_score: 0, status: "developing", first_seen_at: h(1) },
  ];

  const reports = [0, 1, 2].map((d) => ({
    id: `r-${d}`, agent_id: AGENT_ID,
    day: new Date(now + 7 * 3600_000 - d * 86400_000).toISOString().slice(0, 10),
    title: `Laporan harian Raka — ${new Date(now - d * 86400_000).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jakarta" })}`,
    summary: d === 0
      ? "Berita olahraga mendominasi pagi ini setelah kemenangan Timnas di semifinal, disusul pengesahan revisi UU di DPR yang memicu perdebatan.\n\n1. Timnas lolos ke final Piala AFF — momentum tertinggi, dicari 500rb+ orang\n2. DPR sahkan revisi UU — penting, butuh penyajian netral\n3. Rupiah menguat sebulan terakhir — relevan untuk audiens muda\n4. Konser band Bandung pecahkan rekor — potensi viral\n5. UMP 2027 diumumkan — banyak dicari pekerja\n\nSaran: fokuskan pagi pada Timnas, siang untuk ekonomi."
      : "Hari yang relatif tenang; ekonomi dan hiburan mendominasi pemberitaan.",
    data: {
      stories: stories.slice(0, 6), categories: { olahraga: 4, politik: 3, ekonomi: 3, hiburan: 2, teknologi: 1 }, trends: ["timnas indonesia", "piala aff", "harga emas", "ump 2027", "revisi uu"],
      drafts: { total: 4 - d, published: 2, pending: d === 0 ? 2 : 0, rejected: d === 1 ? 1 : 0 }, posts: 7 - d, engagement: { views: 84000 - d * 12000, likes: 5200 - d * 600, comments: 410, shares: 690 },
    },
    created_at: h(d * 24 + 3),
  }));

  return {
    demo: true,
    brand: { name: "fyinews.official", handle: "@fyinews.official" },
    config: { postSlots: ["07:00", "11:30", "16:00", "19:30", "21:00"], publishMode: "manual", contentLang: "en", platforms: { instagram: true, threads: true, tiktok: true, tiktokAudited: false, youtube: true, telegram: true, videoWorker: true, voiceover: false, ai: true } },
    agents: [raka, dita],
    tasks,
    reports,
    drafts,
    stories,
    posts,
    sources: [
      { id: "antara-terkini", outlet: "Antara", kind: "rss", enabled: true, last_ok_at: h(0.2), last_error: null, last_item_count: 30 },
      { id: "cnn-nasional", outlet: "CNN Indonesia", kind: "rss", enabled: true, last_ok_at: h(0.2), last_error: null, last_item_count: 20 },
      { id: "detik-news", outlet: "Detik", kind: "rss", enabled: true, last_ok_at: h(0.2), last_error: null, last_item_count: 25 },
      { id: "tempo-nasional", outlet: "Tempo", kind: "rss", enabled: true, last_ok_at: h(0.2), last_error: null, last_item_count: 15 },
      { id: "okezone", outlet: "Okezone", kind: "rss", enabled: true, last_ok_at: h(30), last_error: "Status code 404", last_item_count: 0 },
      { id: "gn-top", outlet: "Google News", kind: "google_news", enabled: true, last_ok_at: h(0.2), last_error: null, last_item_count: 38 },
      { id: "trends-id", outlet: "Google Trends", kind: "trends", enabled: true, last_ok_at: h(0.2), last_error: null, last_item_count: 20 },
    ],
    runs: [
      { id: 5, job: "agents", ok: true, summary: "0 laporan harian, 1 riset: harga beras jawa tengah", started_at: h(0.1), duration_ms: 6100 },
      { id: 4, job: "collect", ok: true, summary: "21/22 feeds ok, 64 new articles, 19 stories updated, 20 trend terms", started_at: h(0.2), duration_ms: 8400 },
      { id: 3, job: "generate", ok: true, summary: "2 draft(s): Raka: Timnas Lolos ke Final Piala AFF!; Raka: DPR Sahkan Revisi UU", started_at: h(0.3), duration_ms: 41000 },
      { id: 2, job: "publish", ok: true, summary: "nothing due", started_at: h(0.1), duration_ms: 300 },
      { id: 1, job: "render", ok: false, summary: "ffmpeg exited with code 1", started_at: h(28), duration_ms: 12000 },
    ],
    trends: [{ term: "timnas indonesia", traffic: "500K+" }, { term: "piala aff", traffic: "200K+" }, { term: "harga emas", traffic: "50K+" }, { term: "ump 2027", traffic: "50K+" }, { term: "revisi uu", traffic: "20K+" }],
    charts: buildCharts(posts, pastDrafts, stories, tasks),
  };
}
