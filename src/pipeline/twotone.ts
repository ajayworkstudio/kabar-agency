/**
 * Two-colour typographic cards for the design bot.
 * Exactly two colours on every slide: `bg` and `fg`. Cover and closing slides invert them
 * for rhythm; words wrapped in *asterisks* get an inverted highlight block.
 */
import type { CardSlide } from "@/lib/types";

export type Palette = { bg: string; fg: string };
export type DesignFormat = "post" | "square" | "story";

export const SIZES: Record<DesignFormat, { W: number; H: number }> = {
  post: { W: 1080, H: 1350 },   // 4:5 — Instagram/Threads carousel
  square: { W: 1080, H: 1080 }, // 1:1
  story: { W: 1080, H: 1920 },  // 9:16 — Reels/TikTok/Shorts
};

export const PALETTES: { name: string; bg: string; fg: string }[] = [
  { name: "Kertas & Tinta", bg: "#F4F1EA", fg: "#111111" },
  { name: "Malam", bg: "#0E0E10", fg: "#F2F2F2" },
  { name: "Merah Berita", bg: "#D7261E", fg: "#FFF8F0" },
  { name: "Kuning Tegas", bg: "#FFD400", fg: "#111111" },
  { name: "Biru Navy", bg: "#0B2A5B", fg: "#F5F1E6" },
  { name: "Hijau Lapangan", bg: "#0F5132", fg: "#E9F5DB" },
  { name: "Ungu Pop", bg: "#2B1B5A", fg: "#FFB8E0" },
  { name: "Krem & Bata", bg: "#F6E7D3", fg: "#9A2B16" },
];

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children: children.length === 1 ? children[0] : children },
});

function fit(text: string, base: number) {
  const n = text.replace(/\*/g, "").length;
  if (n <= 24) return base;
  if (n <= 45) return Math.round(base * 0.84);
  if (n <= 75) return Math.round(base * 0.7);
  if (n <= 110) return Math.round(base * 0.58);
  return Math.round(base * 0.48);
}

/** Split "Harga *beras* naik" into word blocks; *highlighted* words get inverted colours. */
function richText(text: string, size: number, weight: number, ink: string, paper: string, lineHeight: number) {
  const parts: { w: string; hi: boolean }[] = [];
  let hi = false;
  for (const raw of text.split(/(\*)/)) {
    if (raw === "*") { hi = !hi; continue; }
    raw.split(/\s+/).filter(Boolean).forEach((w) => parts.push({ w, hi }));
  }
  return h(
    "div",
    // each word is its own block, so line spacing comes from rowGap (keeps highlight blocks from touching)
    { flexWrap: "wrap", alignItems: "center", fontSize: size, fontWeight: weight, lineHeight: 1.08, rowGap: Math.round(size * (lineHeight - 1.0)), letterSpacing: size > 60 ? -size * 0.025 : 0, color: ink },
    // punctuation right after a word ("*Diks*, Gladbach") is glued to it so they wrap together
    ...parts.reduce<Node[]>((out, p, i) => {
      if (i > 0 && !p.hi && /^[,.!?;:)]+$/.test(p.w) && parts[i - 1]) return out; // consumed by previous word
      const next = parts[i + 1];
      const punct = next && !next.hi && /^[,.!?;:)]+$/.test(next.w) ? next.w : "";
      const word = p.hi
        ? h("div", { backgroundColor: ink, color: paper, padding: `0 ${Math.round(size * 0.12)}px` }, p.w)
        : h("div", {}, p.w);
      out.push(h("div", { marginRight: Math.round(size * 0.22) }, ...(punct ? [word, h("div", { marginLeft: p.hi ? Math.round(size * 0.04) : 0 }, punct)] : [word])));
      return out;
    }, [])
  );
}

export type TwoToneOpts = {
  palette: Palette;
  format: DesignFormat;
  brandName: string;
  brandHandle: string;
  sourceCredit?: string;
  index: number;
  total: number;
};

export function twoToneTree(slide: CardSlide, o: TwoToneOpts): Node {
  const { W, H } = SIZES[o.format];
  const invert = slide.kind === "cover" || slide.kind === "closing";
  const paper = invert ? o.palette.fg : o.palette.bg;
  const ink = invert ? o.palette.bg : o.palette.fg;
  const story = o.format === "story";
  const pad = 88;
  const top = story ? 230 : pad;
  const bottom = story ? 360 : pad;
  const innerW = W - pad * 2 - (story ? 60 : 0);
  const base = slide.kind === "cover" ? (o.format === "square" ? 112 : 132) : o.format === "square" ? 84 : 100;
  const tSize = fit(slide.title, story ? base + 28 : base);
  const bodySize = o.format === "square" ? 36 : story ? 48 : 42;

  const header = h(
    "div",
    { justifyContent: "space-between", alignItems: "center", width: innerW, borderBottom: `4px solid ${ink}`, paddingBottom: 22 },
    h("div", { fontSize: 28, fontWeight: 900, letterSpacing: 2, color: ink }, o.brandName.toUpperCase()),
    h("div", { fontSize: 26, fontWeight: 800, letterSpacing: 3, color: ink }, (slide.kicker || (slide.kind === "cover" ? (process.env.CONTENT_LANG === "id" ? "TERKINI" : "LATEST") : "")).toUpperCase())
  );

  const quote = slide.kind === "quote" ? [h("div", { fontSize: 200, fontWeight: 900, color: ink, lineHeight: 0.7, height: 120 }, "“")] : [];
  const middle = h(
    "div",
    { flexDirection: "column", gap: 30, width: innerW },
    ...quote,
    richText(slide.title, tSize, 900, ink, paper, 1.12),
    ...(slide.body ? [richText(slide.body, bodySize, 400, ink, paper, 1.3)] : [])
  );

  const footer = h(
    "div",
    { justifyContent: "space-between", alignItems: "flex-end", width: innerW },
    h(
      "div",
      { flexDirection: "column", gap: 6 },
      ...(o.sourceCredit ? [h("div", { fontSize: 24, fontWeight: 600, color: ink }, o.sourceCredit)] : []),
      h("div", { fontSize: 26, fontWeight: 800, color: ink }, o.brandHandle)
    ),
    o.total > 1
      ? h("div", { fontSize: 28, fontWeight: 900, color: paper, backgroundColor: ink, padding: "8px 16px" }, `${o.index + 1}/${o.total}${slide.kind === "cover" ? " ›" : ""}`)
      : h("div", {}, "")
  );

  return h(
    "div",
    { width: W, height: H, backgroundColor: paper, fontFamily: "Plus Jakarta Sans" },
    h("div", { width: innerW, height: H - top - bottom, marginTop: top, marginLeft: pad, flexDirection: "column", justifyContent: "space-between" }, header, middle, footer)
  );
}
