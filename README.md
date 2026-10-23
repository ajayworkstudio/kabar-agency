# Agency — tim karyawan bot untuk media sosialmu

**Agency** adalah sistem manajemen agensi konten. Kamu adalah admin; para "karyawan" adalah bot yang masing-masing memegang platform, kategori berita, dan tanggung jawab yang kamu tentukan.

| Halaman | Isi |
|---|---|
| `/` | Landing page |
| `/app` **Ringkasan** | Statistik, chart views harian, per platform, produktivitas karyawan, status tugas |
| `/app/inbox` **Inbox** | Draft yang menunggu persetujuan + hasil riset — tinjau, edit, setujui, atau tolak |
| `/app/tasks` **Tugas** | Task manager (daftar & papan), filter per karyawan, buat tugas riset/manual |
| `/app/agents` **Karyawan** | Rekrut bot baru, atur platform, kategori, tanggung jawab, kuota, jam laporan |
| `/app/reports` **Laporan harian** | Laporan berita terbaru dari tiap karyawan, setiap pagi |
| `/app/news` · `/app/published` · `/app/settings` | Berita & kesehatan sumber · konten terbit & metrik · koneksi & jalankan manual |

Karyawan pertama, **Raka (Editor Berita Sosial Media)**, otomatis dibuat oleh `supabase/migrations/002_agency.sql`.

Cara kerja tiap karyawan:
- **Draft** — setiap berita yang lolos ambang outlet *karyawan itu* dan masuk kategorinya ditulis olehnya, dengan platform default miliknya, sampai kuota hariannya habis. Draft menjadi tugas "Perlu ditinjau" sampai kamu setujui → "Dikerjakan" → "Selesai" saat terbit.
- **Riset** — buat tugas "Riset topik" (mis. *pantau isu harga beras di Jateng*); dalam ±20 menit bot mencari berita 3 hari terakhir, merangkum, mengusulkan angle konten, dan hasilnya masuk Inbox.
- **Laporan harian** — tiap hari pada jam laporannya (default 07.00 WIB) bot mengirim ringkasan berita terbaru, trending, dan kinerja konten ke dashboard + Telegram.

Coba tanpa akun apa pun: `DEMO_MODE=true npm run dev` lalu buka `http://localhost:3000`.

---

## Mesin di baliknya

Watches Indonesian news and search trends around the clock, confirms each story across independent outlets, writes a full content package (carousel, captions, Threads post, short-video script and rendered video), and asks you to approve it with one tap on Telegram or in the dashboard. Approved posts go out on Instagram, Threads, TikTok and YouTube Shorts.

```
 RSS (Antara, CNN Indonesia, Detik, Tempo, Republika, Okezone, Suara)
 Google News topic feeds · Google Trends ID
        │  every 20 min
        ▼
 ┌──────────────┐   group headlines into stories, count independent outlets,
 │   COLLECT    │   rank by heat (outlets × freshness × velocity × trending)
 └──────┬───────┘
        ▼  story confirmed (≥2 outlets, politics ≥3)
 ┌──────────────┐   read the source articles → Claude writes the package
 │    WRITE     │   → a second, independent fact-check pass flags anything
 │  + FACT-CHECK│     the sources don't support
 └──────┬───────┘
        ▼
 ┌──────────────┐   branded 4:5 carousel cards (rendered server-side)
 │    DESIGN    │   Telegram message with ✅ Post now / 🕒 Next slot / ❌ Reject
 └──────┬───────┘
        ▼  you approve
 ┌──────────────┐   GitHub Actions + ffmpeg: 9:16 video, optional ID voiceover
 │ RENDER VIDEO │
 └──────┬───────┘
        ▼  at the scheduled WIB slot (or now)
 ┌──────────────┐   IG carousel/Reel · Threads text/carousel · TikTok · YT Shorts
 │   PUBLISH    │   → engagement metrics pulled every 3h into the dashboard
 └──────────────┘
```

Samples of the generated design are in `docs/samples/` (cards + `sample.mp4`).

---

## What runs where

| Piece | Where | Why |
|---|---|---|
| Dashboard (PWA), API, collect / write / publish | Vercel (Next.js 15) | Free tier is fine to start |
| Database + media storage | Supabase | Postgres + a public bucket the platform APIs download media from |
| Video rendering | GitHub Actions (`render-video.yml`) | Needs ffmpeg; Vercel functions don't have it |
| Scheduler | `vercel.json` crons **or** `heartbeat.yml` | Vercel Hobby only allows daily crons — use the GitHub heartbeat unless you're on Pro |
| Approvals | Telegram bot + dashboard | One tap from your phone |

## Setup (≈1 hour, most of it waiting on platform approvals)

### 1. Supabase
1. Create a project → **SQL Editor** → run `supabase/migrations/001_init.sql`, then `supabase/migrations/002_agency.sql`.
2. Copy the project URL and the **service_role** key (Settings → API).

### 2. Local test
```bash
npm install
cp .env.example .env.local     # fill Supabase + ANTHROPIC_API_KEY at minimum
npm run sample:card            # renders cards to ./out — no keys needed
npm run sample:video           # renders ./out/sample.mp4 (needs ffmpeg)
npm run pipeline:once          # real collect → generate against live feeds
DEMO_MODE=true npm run dev     # dashboard with sample data, no keys needed
```

### 3. Deploy to Vercel
Push to GitHub, import into Vercel, add every variable from `.env.example` (Project → Settings → Environment Variables). `APP_URL` = your Vercel URL.

### 4. Telegram one-tap approvals
1. Message **@BotFather** → `/newbot` → copy the token to `TELEGRAM_BOT_TOKEN`.
2. Send any message to your new bot, then open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `chat.id` → `TELEGRAM_OWNER_CHAT_ID`.
3. Pick a random `TELEGRAM_WEBHOOK_SECRET`, then open once in a browser:
   `https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram&secret_token=<SECRET>`

Only that chat can approve, and every button is signed, so a forwarded message can't be replayed by someone else.

### 5. GitHub Actions (video + scheduler)
Repo → Settings → Secrets and variables → Actions:
- **Secrets:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`, `GOOGLE_TTS_API_KEY` (optional)
- **Variables:** `APP_URL`, `BRAND_NAME`, `BRAND_HANDLE`, `GOOGLE_TTS_VOICE` (optional)

Then create a fine-grained token with **Actions: Read and write** on this repo → set it on Vercel as `GITHUB_DISPATCH_TOKEN` (plus `GITHUB_REPO=user/repo`). Approving a draft now wakes the worker instantly; it also sweeps every 15 min as a backup.

GitHub's scheduled workflows can run a few minutes late under load. That's fine for news posting; if you need exact timing, upgrade to Vercel Pro and delete `heartbeat.yml`.

### 6. Platforms

**Instagram** — Business or Creator account. In Meta for Developers create an app with *Instagram API with Instagram Login*, add the `instagram_business_basic` and `instagram_business_content_publish` permissions, generate a long-lived token → `IG_ACCESS_TOKEN`, and your IG user ID → `IG_USER_ID`. The daily cron refreshes the 60-day token.

**Threads** — same Meta app, add the Threads use case with `threads_basic` + `threads_content_publish`, generate a long-lived token → `THREADS_ACCESS_TOKEN` / `THREADS_USER_ID`. Limit: 250 API posts per rolling 24h; a carousel counts as one.

**YouTube Shorts** — Google Cloud project → enable *YouTube Data API v3* → OAuth client (Desktop or Web) → get a refresh token for your channel with scope `youtube.upload` (e.g. via the OAuth Playground) → `YT_CLIENT_ID`, `YT_CLIENT_SECRET`, `YT_REFRESH_TOKEN`. The default 10,000-unit daily quota covers about 6 uploads a day; request more in Google Cloud if you need it. Unverified OAuth apps may have uploads locked to private until Google audits the app.

**TikTok** — developers.tiktok.com → create an app with *Login Kit* + *Content Posting API* (enable Direct Post) → authorize your account with scope `video.publish` → `TIKTOK_ACCESS_TOKEN` / `TIKTOK_REFRESH_TOKEN`.
> ⚠️ Until TikTok audits your app, **every API post is forced to private (SELF_ONLY)**, only up to 5 accounts can post per 24h, and the posting account must be set to private. Apply for the audit early (it takes weeks and is often rejected the first time). Until then, a practical workflow is: let the bot post privately, then make the video public in the TikTok app. Set `TIKTOK_AUDITED=true` after approval.

**Voiceover (optional)** — Google Cloud → enable *Text-to-Speech API* → API key → `GOOGLE_TTS_API_KEY`. Without it, videos are silent text-motion pieces with an optional music bed: drop royalty-free tracks (that you have rights to) into `assets/music/`. Trending in-app sounds can't be added through the APIs — add them in the TikTok/IG app if you want them.

---

## Daily use (legacy notes — the dashboard is now the Agency app above)

- **Telegram** pings you with the cover card, hook, how many outlets confirmed it, and the fact-check verdict. Tap **Post sekarang**, **Slot berikutnya**, or **Tolak**.
- **Dashboard → Antrian**: swipe through every slide, read the fact-check notes and the list of claims → sources, edit any text (cards re-render), choose which platforms get it.
- **Trending**: everything the bot is tracking, ranked by heat, with a progress marker like `2/3 outlet`. Tap **Draft** to write one early — you'll be warned if it's below the confirmation bar.
- **Terbit**: views / likes / comments / shares per post.
- **Sistem**: platform connections, feed health (dead feeds show their error here — fix the URL in `src/config/sources.ts`), run log, manual job buttons.

Install it on your phone: open the dashboard in Chrome/Safari → *Add to Home Screen*.

## Tuning

| Variable | Default | Effect |
|---|---|---|
| `MIN_SOURCES` / `MIN_SOURCES_POLITICS` | 2 / 3 | Independent outlets needed before a draft is written |
| `MAX_DRAFTS_PER_RUN` | 4 | Caps AI spend (each draft ≈ 2 model calls) |
| `POST_SLOTS` | 07:00, 11:30, 16:00, 19:30, 21:00 | WIB slots for "next slot" — commute, lunch, after work, prime time |
| `src/config/sources.ts` | — | Add/remove feeds and Google News queries |
| `src/pipeline/writer.ts` | — | Brand voice and accuracy rules (in Indonesian) |
| `src/pipeline/cards.ts` | — | Card design, colors per category |

## Accuracy & safety rules built in

- A story is only drafted once enough **independent** outlets report it. Outlet spellings are normalized (`detikNews` = `detikSport` = Detik), and Google News itself never counts as a source.
- The writer may only use facts present in the source articles, must attribute single-source claims, must use "diduga/dilaporkan" for allegations, and stays neutral on politics.
- A second, separate model call fact-checks the finished copy against the sources. A failing draft needs an extra confirmation before it can be posted.
- Nothing posts without your approval.
- Article text is used only as grounding. Posts are original summaries that credit the outlets. Cards are typographic, so no news photos are reused.

## Tests
```bash
npm test          # clustering, outlet normalization, WIB scheduling, feed parsing, every admin page renders
npm run typecheck
```

## Not included yet (good next steps)
- An auto-post rule for low-sensitivity categories (e.g. sports results) — the approval step is deliberately the only path today.
- Comment monitoring and reply suggestions.
- A/B testing of hooks, using the metrics already collected.
- X/Twitter and Facebook Page publishers (same pattern as `src/pipeline/publish/*`).
