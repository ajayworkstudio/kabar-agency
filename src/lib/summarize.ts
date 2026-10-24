/**
 * Client-safe extractive summariser for the design studio (no AI, no network).
 * Paste raw article text → pick the most informative sentences → studio slide text.
 */

export type SummaryFormat = {
  /** Total slides including cover and closing. */
  slides: number;
  /** Add a quote slide when the article quotes someone. */
  quote: boolean;
  /** Closing slide style. */
  closing: "question" | "follow" | "none";
  /** Small label on point slides. */
  labels: "numbered" | "none";
};

export const DEFAULT_FORMAT: SummaryFormat = { slides: 5, quote: true, closing: "question", labels: "numbered" };

const STOP = new Set(
  (
    "yang dan di ke dari ini itu untuk dengan pada dalam tidak akan juga sudah ada adalah oleh karena sebagai atau saat bisa lebih " +
    "telah masih para kata ujar ucap tersebut mereka kami kita ia dia nya pun hingga agar namun tetapi serta jadi bagi setelah sebelum " +
    "menjadi menurut kepada antara secara hal banyak sangat lagi baru hari kamis jumat sabtu minggu senin selasa rabu tahun bulan " +
    "the a an and or of to in on for with at by from is are was were be been it its this that as has have had will would said says " +
    "he she they we you their his her not but also more than after before about into over"
  ).split(" ")
);

const JUNK = [
  /^(baca juga|simak juga|lihat juga|tonton juga|advertisement|scroll to continue|gambas|video|foto|sumber)\b.*$/gim,
  /\bADVERTISEMENT\b|SCROLL TO CONTINUE WITH CONTENT/g,
  /\[Gambas:[^\]]*\]/g,
  /\((?:[a-z]{2,4}\/){1,3}[a-z]{2,4}\)/gi, // (fby/end) style editor codes
];

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/[\s,;:]+\S*$/, "")}…` : s);
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];

/** "Jakarta, CNN Indonesia -- " → outlet "CNN Indonesia", and strip it. */
function dateline(text: string): { outlet: string | null; text: string } {
  const m = text.match(/^\s*([A-Z][\p{L} .]{1,30}),\s*([\p{L}\d .]{2,30}?)\s*(?:--|—|–|-)\s+/u);
  if (m) return { outlet: m[2].trim(), text: text.slice(m[0].length) };
  const d = text.match(/^\s*([\p{L}\d.]{3,20}\.com)\s*(?:--|—|–|-)\s+/u);
  if (d) return { outlet: d[1], text: text.slice(d[0].length) };
  return { outlet: null, text };
}

const CONNECTOR = /^(selain itu|sementara itu|menurutnya|menurut dia|di sisi lain|adapun|lebih lanjut|meanwhile|in addition|however),\s*/i;

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…]["”']?)\s+(?=["“']?[\p{Lu}\d])/u)
    .map((s) => s.trim().replace(CONNECTOR, "").replace(/^\p{Ll}/u, (c) => c.toUpperCase()))
    .filter((s) => s.length >= 25);
}

/** Split a long sentence into a punchy title + body at a natural break. */
function titleBody(s: string): { title: string; body?: string } {
  const t = s.replace(/[.]$/, "");
  const q = t.match(/^["“]([^"”]{10,})["”][,.]?\s*(.*)$/);
  if (q) return { title: clip(q[1].replace(/[,.]$/, ""), 115), body: q[2] ? clip(q[2].replace(/^\p{Ll}/u, (c) => c.toUpperCase()), 170) : undefined };
  if (t.length <= 115) return { title: t };
  const breaks = [", sehingga ", ", karena ", ", namun ", ", sementara ", ", yang ", " sehingga ", " karena ", "; ", ", and ", ", which ", ", while ", ", but ", " yang "];
  for (const b of breaks) {
    const i = t.indexOf(b, 35);
    if (i > 0 && i < 110) return { title: t.slice(0, i), body: clip(t.slice(i + b.length).replace(/^\p{Ll}/u, (c) => c.toUpperCase()), 170) };
  }
  return { title: clip(t, 100), body: undefined };
}

/** Wrap the first striking number (20.500, 3-2, Rp1,8 juta, 35%) in *…* so Dita highlights it. */
function highlight(s: string): string {
  if (s.includes("*")) return s;
  const m = s.match(/(Rp\s?[\d.,]+(?:\s?(?:juta|miliar|triliun|ribu))?|\d+(?:[.,]\d+)*\s?(?:%|persen|juta|miliar|ribu|million|billion)?|\d+-\d+)/i);
  if (m && m[0].replace(/\D/g, "").length >= 2) return s.replace(m[0], `*${m[0].trim()}*${/\s$/.test(m[0]) ? " " : ""}`);
  return s;
}

type Quote = { text: string; who: string | null };

function findQuote(raw: string): Quote | null {
  const re = /["“]([^"”]{30,220})["”][,.]?\s*(?:(?:kata|ujar|ucap|tutur|jelas|ungkap|tegas|said|says)\s+([\p{Lu}][^,.()"“”]{1,90}?)(?=\s+(?:di|dalam|saat|pada|kepada|kepada|on|at|in)\s|[,.()]|$))?/gmu;
  let best: Quote | null = null;
  for (const m of raw.matchAll(re)) {
    const q = { text: m[1].trim().replace(/[,.]$/, "") + ".", who: m[2] ?? null };
    if (!best || (q.who && !best.who)) best = q;
    if (best.who) break;
  }
  return best;
}

export function summarizeRaw(raw: string, fmt: SummaryFormat, lang: "en" | "id") {
  let text = raw.replace(/\r/g, "");
  for (const j of JUNK) text = text.replace(j, "");

  // A short first line without a full stop is the headline
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  let headline: string | null = null;
  if (lines.length > 1 && lines[0].length <= 160 && !/[.!?]$/.test(lines[0])) {
    headline = lines[0];
    text = lines.slice(1).join("\n");
  }
  const dl = dateline(text);
  text = dl.text;
  const quote = fmt.quote ? findQuote(text) : null;

  const all = sentences(text);
  if (!all.length) return null;
  const lead = all[0];

  // score: keyword frequency (normalised) + numbers + early-position bonus; skip quote-only sentences
  const freq = new Map<string, number>();
  for (const w of words(text)) if (!STOP.has(w) && w.length > 2) freq.set(w, (freq.get(w) ?? 0) + 1);
  const scored = all.map((s, i) => {
    const ws = words(s).filter((w) => !STOP.has(w) && w.length > 2);
    const kw = ws.reduce((a, w) => a + Math.log(1 + (freq.get(w) ?? 0)), 0) / Math.sqrt(ws.length || 1);
    const num = /\d/.test(s) ? 0.6 : 0;
    const pos = Math.max(0, 1 - i / all.length) * 0.8;
    const len = s.length > 260 ? -1 : 0;
    const quoted = quote && s.includes(quote.text.slice(0, 25)) ? -5 : /^["“]/.test(s) ? -1.5 : 0;
    return { s, i, score: kw + num + pos + len + quoted };
  });

  const fixed = 1 + (fmt.closing !== "none" ? 1 : 0) + (quote ? 1 : 0);
  const nPoints = Math.max(1, fmt.slides - fixed);
  const picked = scored
    .filter((x) => x.i !== 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, nPoints)
    .sort((a, b) => a.i - b.i);

  const label = (k: number) => (fmt.labels === "numbered" ? `#${lang === "en" ? "Fact" : "Fakta"} ${k}\n` : "");
  const coverTitle = headline ?? titleBody(lead).title;
  const blocks: string[] = [
    `${highlight(clip(coverTitle, 110))}\n${clip(headline ? lead : titleBody(lead).body ?? "", 200)}`.trim(),
    ...picked.map((p, k) => {
      const tb = titleBody(p.s);
      return `${label(k + 1)}${highlight(tb.title)}${tb.body ? `\n${tb.body}` : ""}`;
    }),
  ];
  if (quote) blocks.push(`${fmt.labels === "numbered" ? `#${lang === "en" ? "Quote" : "Kutipan"}\n` : ""}> ${clip(quote.text, 160)}${quote.who ? `\n${quote.who}` : ""}`);
  if (fmt.closing === "question") blocks.push(lang === "en" ? "What's your take?\nDrop it in the comments." : "Menurutmu gimana?\nTulis di kolom komentar ya.");
  if (fmt.closing === "follow") blocks.push(lang === "en" ? "Follow for more\nNews that matters, fast." : "Follow untuk update\nBerita penting, cepat & ringkas.");

  const outlet = dl.outlet;
  const src = outlet ? `${lang === "en" ? "Source" : "Sumber"}: ${outlet}` : "";
  return {
    title: coverTitle,
    text: blocks.join("\n\n"),
    credit: src,
    caption: `${coverTitle}\n\n${clip(lead, 220)}${src ? `\n\n${src}` : ""}`,
  };
}
