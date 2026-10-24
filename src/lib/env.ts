const num = (v: string | undefined, d: number) => (v && !Number.isNaN(Number(v)) ? Number(v) : d);

export const env = {
  brandName: process.env.BRAND_NAME ?? "fyinews.official",
  brandHandle: process.env.BRAND_HANDLE ?? "@fyinews.official",
  /** Language of everything that gets published: "en" (default) or "id". The admin dashboard stays Indonesian. */
  /** "manual" (default): approve → download & copy, you post yourself. "api": publish through platform APIs. */
  publishMode: (process.env.PUBLISH_MODE === "api" ? "api" : "manual") as "manual" | "api",
  contentLang: (process.env.CONTENT_LANG === "id" ? "id" : "en") as "en" | "id",
  appUrl: (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),

  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",

  supabaseUrl: process.env.SUPABASE_URL ?? "",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  mediaBucket: process.env.SUPABASE_MEDIA_BUCKET ?? "media",

  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",

  minSources: num(process.env.MIN_SOURCES, 2),
  minSourcesPolitics: num(process.env.MIN_SOURCES_POLITICS, 3),
  maxDraftsPerRun: num(process.env.MAX_DRAFTS_PER_RUN, 4),
  postSlots: (process.env.POST_SLOTS ?? "07:00,11:30,16:00,19:30,21:00").split(",").map((s) => s.trim()).filter(Boolean),

  telegramToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_OWNER_CHAT_ID ?? "",
  telegramWebhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "",

  igUserId: process.env.IG_USER_ID ?? "",
  igToken: process.env.IG_ACCESS_TOKEN ?? "",
  threadsUserId: process.env.THREADS_USER_ID ?? "",
  threadsToken: process.env.THREADS_ACCESS_TOKEN ?? "",
  ytClientId: process.env.YT_CLIENT_ID ?? "",
  ytClientSecret: process.env.YT_CLIENT_SECRET ?? "",
  ytRefreshToken: process.env.YT_REFRESH_TOKEN ?? "",
  tiktokClientKey: process.env.TIKTOK_CLIENT_KEY ?? "",
  tiktokClientSecret: process.env.TIKTOK_CLIENT_SECRET ?? "",
  tiktokToken: process.env.TIKTOK_ACCESS_TOKEN ?? "",
  tiktokRefreshToken: process.env.TIKTOK_REFRESH_TOKEN ?? "",
  tiktokAudited: process.env.TIKTOK_AUDITED === "true",

  githubDispatchToken: process.env.GITHUB_DISPATCH_TOKEN ?? "",
  githubRepo: process.env.GITHUB_REPO ?? "",
  googleTtsKey: process.env.GOOGLE_TTS_API_KEY ?? "",
  googleTtsVoice: process.env.GOOGLE_TTS_VOICE ?? (process.env.CONTENT_LANG === "id" ? "id-ID-Wavenet-D" : "en-US-Neural2-D"),
};
