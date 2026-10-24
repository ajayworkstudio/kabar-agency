import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env } from "@/lib/env";
import type { DraftContent, FactCheck } from "@/lib/types";

const anthropic = () => new Anthropic({ apiKey: env.anthropicKey });

export type SourceDoc = { outlet: string; title: string; url: string; publishedAt: string | null; text: string };

// ── Output schemas (also used to validate what comes back) ────────────────

const Slide = z.object({
  kind: z.enum(["cover", "point", "quote", "closing"]),
  kicker: z.string().optional(),
  title: z.string(),
  body: z.string().optional(),
});

const Draft = z.object({
  category: z.enum(["politik", "olahraga", "hiburan", "ekonomi", "teknologi", "umum"]),
  hook: z.string(),
  summary: z.string(),
  keyFacts: z.array(z.object({ claim: z.string(), sources: z.array(z.string()) })).min(1),
  carousel: z.array(Slide).min(3).max(8),
  instagramCaption: z.string(),
  threadsPost: z.string().max(500),
  threadsFollowUps: z.array(z.string().max(500)).max(3),
  video: z.object({
    title: z.string().max(100),
    description: z.string(),
    scenes: z.array(z.object({ onScreen: z.string(), voiceover: z.string(), seconds: z.number().min(2).max(9) })).min(3).max(9),
  }),
  tiktokCaption: z.string().max(2200),
  hashtags: z.array(z.string()).max(12),
  sourceCredit: z.string(),
  sensitivity: z.enum(["low", "medium", "high"]),
});

const Check = z.object({
  verdict: z.enum(["pass", "warn", "fail"]),
  issues: z.array(z.object({ text: z.string(), problem: z.string() })),
});

// Hand-written JSON schema for the tool (keeps descriptions close to the model)
const draftToolSchema = {
  type: "object",
  required: ["category", "hook", "summary", "keyFacts", "carousel", "instagramCaption", "threadsPost", "threadsFollowUps", "video", "tiktokCaption", "hashtags", "sourceCredit", "sensitivity"],
  properties: {
    category: { type: "string", enum: ["politik", "olahraga", "hiburan", "ekonomi", "teknologi", "umum"] },
    hook: { type: "string", description: "Satu kalimat pembuka ≤ 12 kata yang bikin berhenti scroll. Tetap akurat — tidak boleh menjanjikan sesuatu yang tidak ada di sumber." },
    summary: { type: "string", description: "2–3 kalimat netral untuk editor." },
    keyFacts: {
      type: "array",
      description: "Setiap klaim faktual yang dipakai di konten, beserta nama outlet yang mendukungnya.",
      items: { type: "object", required: ["claim", "sources"], properties: { claim: { type: "string" }, sources: { type: "array", items: { type: "string" } } } },
    },
    carousel: {
      type: "array",
      description: "4–7 slide. Slide 1 kind=cover (hook besar). Tengah kind=point/quote (satu fakta per slide, title ≤ 10 kata, body ≤ 28 kata). Terakhir kind=closing berisi ajakan diskusi.",
      items: {
        type: "object",
        required: ["kind", "title"],
        properties: { kind: { type: "string", enum: ["cover", "point", "quote", "closing"] }, kicker: { type: "string" }, title: { type: "string" }, body: { type: "string" } },
      },
    },
    instagramCaption: { type: "string", description: "Hook di baris pertama, 3–6 baris ringkas, pertanyaan pemantik komentar, baris 'Sumber: …', lalu hashtag." },
    threadsPost: { type: "string", description: "≤ 480 karakter, gaya ngobrol, diakhiri pertanyaan. Tanpa hashtag berderet (maks 1 topik)." },
    threadsFollowUps: { type: "array", description: "0–3 balasan lanjutan berisi detail tambahan + sumber.", items: { type: "string" } },
    video: {
      type: "object",
      required: ["title", "description", "scenes"],
      properties: {
        title: { type: "string", description: "Judul YouTube Shorts ≤ 90 karakter, tanpa clickbait palsu." },
        description: { type: "string", description: "Deskripsi singkat + sumber + #Shorts" },
        scenes: {
          type: "array",
          description: "4–7 adegan vertikal, total 20–45 detik. Adegan 1 = hook (≤ 3 detik).",
          items: {
            type: "object",
            required: ["onScreen", "voiceover", "seconds"],
            properties: {
              onScreen: { type: "string", description: "Teks di layar ≤ 12 kata" },
              voiceover: { type: "string", description: "Narasi bahasa Indonesia lisan, ≤ 25 kata" },
              seconds: { type: "number" },
            },
          },
        },
      },
    },
    tiktokCaption: { type: "string", description: "Caption TikTok pendek + 3–5 hashtag relevan." },
    hashtags: { type: "array", items: { type: "string" }, description: "5–10 hashtag relevan dan populer di Indonesia, tanpa spasi." },
    sourceCredit: { type: "string", description: "Contoh: 'Sumber: Antara, Detik, Tempo'" },
    sensitivity: { type: "string", enum: ["low", "medium", "high"], description: "high untuk politik, hukum/kriminal, bencana, kematian, isu SARA." },
  },
} as const;

function systemPromptId() {
  return `Kamu adalah redaktur media sosial untuk akun berita "${env.brandName}" (${env.brandHandle}) yang menyasar anak muda Indonesia.

Tugasmu: mengubah beberapa laporan berita tentang SATU peristiwa menjadi paket konten untuk Instagram, Threads, TikTok, dan YouTube Shorts.

ATURAN AKURASI (wajib, tidak bisa ditawar):
1. Hanya gunakan fakta yang ada di dokumen sumber. Jangan menambah angka, nama, kutipan, atau tanggal dari ingatanmu.
2. Jika sumber saling bertentangan, sebutkan perbedaannya ("Menurut X …, sementara Y …") — jangan memilih salah satu diam-diam.
3. Klaim yang hanya dimuat satu outlet harus diatribusikan ("menurut Detik …").
4. Tuduhan, dugaan, atau kasus hukum: gunakan kata "diduga", "dilaporkan", "menurut polisi". Jangan menyimpulkan bersalah.
5. Kutipan langsung hanya jika kata-katanya persis ada di sumber, dan singkat.
6. Politik: netral. Jangan memihak, jangan memberi opini, jangan memakai kata bermuatan ("bobrok", "pahlawan"). Sampaikan apa yang terjadi dan apa kata masing-masing pihak.
7. Jangan menulis ulang artikel. Ringkas dengan kata-katamu sendiri dan selalu cantumkan sumber.

GAYA:
- Bahasa Indonesia santai tapi rapi (boleh "nih", "gimana menurutmu?"), tidak alay, tidak clickbait palsu.
- Hook kuat di detik/baris pertama. Satu ide per slide/adegan.
- Akhiri dengan pertanyaan yang mengundang komentar, bukan ajakan kebencian.
- Hiburan/viral: hormati privasi; jangan mengejek fisik, jangan menyebarkan identitas orang biasa (bukan figur publik) atau anak-anak.

Panggil tool submit_draft tepat satu kali.`;
}

function systemPromptEn() {
  return `You are the social media editor for the news account "${env.brandName}" (${env.brandHandle}). It covers news from Indonesia for an English-speaking audience: young Indonesians who prefer English and international followers interested in Indonesia.

The source articles are mostly in Indonesian. Your job: turn several reports about ONE event into a content package for Instagram, Threads, TikTok and YouTube Shorts — written entirely in ENGLISH.

ACCURACY RULES (non-negotiable):
1. Use only facts that appear in the source documents. Never add numbers, names, quotes or dates from memory.
2. If sources disagree, say so ("According to X …, while Y …") — never silently pick one.
3. Claims reported by only one outlet must be attributed ("according to Detik …").
4. Allegations and legal cases: use "allegedly", "reportedly", "according to police". Never imply guilt.
5. Translate quotes faithfully and keep them short; mark them as translated where it matters.
6. Politics: neutral. No opinions, no loaded words. State what happened and what each side says.
7. Don't rewrite the article. Summarise in your own words and always credit the sources.

CONTEXT FOR A GLOBAL AUDIENCE:
- Briefly explain Indonesian names, institutions and terms on first use (e.g. "DPR, Indonesia's parliament"; "Timnas, the national football team").
- Give amounts in rupiah as written in the source; add an approximate USD figure only if the source provides one.

STYLE:
- Clear, punchy, conversational English. No fake clickbait.
- Strong hook in the first line/second. One idea per slide/scene.
- End with a question that invites comments, never one that invites hate.
- Entertainment/viral: respect privacy; no body-shaming; never identify private individuals or children.

Write EVERY field value in English (the field descriptions in the tool schema are in Indonesian; follow their limits, but answer in English). Use "Source: …" for sourceCredit and English hashtags.
Call the submit_draft tool exactly once.`;
}

const systemPrompt = () => (env.contentLang === "en" ? systemPromptEn() : systemPromptId());

function renderSources(docs: SourceDoc[]) {
  return docs
    .map((d, i) => `<sumber no="${i + 1}" outlet="${d.outlet}" waktu="${d.publishedAt ?? "?"}">\nJudul: ${d.title}\n${d.text}\n</sumber>`)
    .join("\n\n");
}

export async function writeDraft(docs: SourceDoc[], hint: { category: string; trending: boolean }): Promise<DraftContent> {
  const res = await anthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 4000,
    system: systemPrompt(),
    tools: [{ name: "submit_draft", description: "Kirim paket konten final.", input_schema: draftToolSchema as unknown as Anthropic.Tool.InputSchema }],
    tool_choice: { type: "tool", name: "submit_draft" },
    messages: [
      {
        role: "user",
        content:
          env.contentLang === "en"
            ? `Estimated category: ${hint.category}${hint.trending ? " (currently trending on Google Indonesia)" : ""}.\nToday's date: ${new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Jakarta", dateStyle: "full" })}.\nWrite the whole package in English.\n\n${renderSources(docs)}`
            : `Kategori perkiraan: ${hint.category}${hint.trending ? " (sedang trending di Google Indonesia)" : ""}.\nTanggal hari ini: ${new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full" })}.\n\n${renderSources(docs)}`,
      },
    ],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("writer returned no draft");
  const parsed = Draft.safeParse(block.input);
  if (!parsed.success) throw new Error(`draft failed validation: ${parsed.error.message.slice(0, 300)}`);
  const d = parsed.data;
  return { ...d, hashtags: d.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, "")) };
}

/**
 * Independent second pass: a fresh call that only sees sources + the finished copy
 * and lists anything not supported by the sources.
 */
export async function factCheck(docs: SourceDoc[], draft: DraftContent): Promise<FactCheck> {
  const copy = [
    `HOOK: ${draft.hook}`,
    ...draft.carousel.map((s, i) => `SLIDE ${i + 1}: ${s.title} — ${s.body ?? ""}`),
    `IG: ${draft.instagramCaption}`,
    `THREADS: ${draft.threadsPost} ${draft.threadsFollowUps.join(" ")}`,
    ...draft.video.scenes.map((s, i) => `SCENE ${i + 1}: ${s.onScreen} / ${s.voiceover}`),
    `VIDEO TITLE: ${draft.video.title}`,
  ].join("\n");

  const res = await anthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: 1500,
    system:
      "Kamu pemeriksa fakta. Bandingkan SALINAN dengan SUMBER (salinan boleh berbahasa Inggris — terjemahan yang setia bukan masalah; nilai maknanya). Laporkan setiap kalimat di salinan yang: (a) tidak didukung sumber, (b) melebih-lebihkan, (c) menyatakan dugaan sebagai fakta, (d) memihak secara politik, atau (e) menyebut identitas orang biasa/anak. " +
      "verdict: pass = tidak ada masalah; warn = masalah kecil/gaya; fail = ada klaim salah atau tak berdasar. Jangan menilai gaya bahasa selain hal di atas. Panggil tool report.",
    tools: [
      {
        name: "report",
        description: "Laporan pemeriksaan fakta",
        input_schema: {
          type: "object",
          required: ["verdict", "issues"],
          properties: {
            verdict: { type: "string", enum: ["pass", "warn", "fail"] },
            issues: { type: "array", items: { type: "object", required: ["text", "problem"], properties: { text: { type: "string" }, problem: { type: "string" } } } },
          },
        },
      },
    ],
    tool_choice: { type: "tool", name: "report" },
    messages: [{ role: "user", content: `${renderSources(docs)}\n\n<salinan>\n${copy}\n</salinan>` }],
  });
  const block = res.content.find((b) => b.type === "tool_use");
  const parsed = block && block.type === "tool_use" ? Check.safeParse(block.input) : null;
  return parsed?.success ? parsed.data : { verdict: "warn", issues: [{ text: "-", problem: "Fact-check tidak menghasilkan laporan; periksa manual." }] };
}

/** Short free-text briefing (daily reports, research summaries). Returns null when no API key is set. */
export async function brief(instruction: string, material: string, maxTokens = 900): Promise<string | null> {
  if (!env.anthropicKey) return null;
  const res = await anthropic().messages.create({
    model: env.anthropicModel,
    max_tokens: maxTokens,
    system:
      "Kamu asisten redaksi untuk agensi konten berita. Tulis dalam bahasa Indonesia yang ringkas dan rapi. " +
      "Hanya gunakan informasi dari materi yang diberikan; jangan menambah fakta. Netral untuk isu politik.",
    messages: [{ role: "user", content: `${instruction}\n\n<materi>\n${material}\n</materi>` }],
  });
  const text = res.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
  return text || null;
}
