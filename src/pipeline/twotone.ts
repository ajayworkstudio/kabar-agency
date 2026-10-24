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

/**
 * List rows. "Label: value" → label left, bold value right (price lists, specs, scores);
 * anything else → a dash marker and the text. Thin rules between rows, same two colours.
 */
function bulletList(items: string[], size: number, ink: string, paper: string, width: number) {
  const longest = Math.max(...items.map((b) => b.replace(/\*/g, "").length));
  const fs = Math.round(size * (items.length > 7 ? 0.74 : items.length > 5 ? 0.86 : 1) * (longest > 44 ? 0.88 : 1));
  const padY = Math.round(fs * 0.36);
  return h(
    "div",
    { flexDirection: "column", width, borderTop: `3px solid ${ink}` },
    ...items.map((b) => {
      const m = b.match(/^(.{2,80}?):\s+(.{1,60})$/);
      const row = { width, alignItems: "center", padding: `${padY}px 0`, borderBottom: `2px solid ${ink}`, fontSize: fs, color: ink, lineHeight: 1.2 };
      if (m) {
        return h("div", row,
          h("div", { flexGrow: 1, flexShrink: 1, fontWeight: 500, paddingRight: 24 }, m[1].replace(/\*/g, "")),
          h("div", { flexShrink: 0, fontWeight: 900, letterSpacing: -fs * 0.01 }, m[2].replace(/\*/g, "")));
      }
      return h("div", row,
        h("div", { flexShrink: 0, width: Math.round(fs * 1.45), fontWeight: 900 }, "—"),
        h("div", { flexGrow: 1, flexShrink: 1 }, richText(b, fs, 500, ink, paper, 1.2)));
    })
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

export type ImageLayout = "top" | "bottom" | "left" | "right" | "full";

const img = (src: string, width: number, height: number, position = "center"): Node => ({
  type: "img",
  props: { src, width, height, style: { width, height, objectFit: "cover", objectPosition: position } },
});
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const rgba = (hex: string, a: number) => `rgba(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)}, ${a})`;

export function twoToneTree(slide: CardSlide, o: TwoToneOpts): Node {
  const { W, H } = SIZES[o.format];
  const story = o.format === "story";
  const square = o.format === "square";
  const photo = slide.image ? (slide.imageLayout ?? "top") : null;

  // colours: cover/closing invert for rhythm; on a full-bleed photo the text is always the lighter colour
  const invert = slide.kind === "cover" || slide.kind === "closing";
  let paper = invert ? o.palette.fg : o.palette.bg;
  let ink = invert ? o.palette.bg : o.palette.fg;
  if (photo === "full") {
    const [light, dark] = lum(o.palette.bg) >= lum(o.palette.fg) ? [o.palette.bg, o.palette.fg] : [o.palette.fg, o.palette.bg];
    ink = light;
    paper = dark;
  }

  const pad = photo === "left" || photo === "right" ? 60 : 88;
  const top = story && photo !== "top" ? 230 : pad;
  const bottom = story && photo !== "bottom" ? 360 : pad;

  // text scale by how much room the photo leaves
  const scale = photo === "full" ? 0.86 : photo === "top" || photo === "bottom" ? 0.62 : photo ? 0.56 : 1;
  const base = slide.kind === "cover" ? (square ? 112 : 132) : square ? 84 : 100;
  const bullets = slide.bullets?.filter((b) => b.trim()).slice(0, 10) ?? [];
  const tSize = fit(slide.title, Math.round((story ? base + 28 : base) * (bullets.length ? 0.78 : 1) * scale));
  const bodySize = Math.round((square ? 36 : story ? 48 : 42) * (photo && photo !== "full" ? 0.78 : 1));
  const kicker = (slide.kicker || (slide.kind === "cover" ? (process.env.CONTENT_LANG === "id" ? "TERKINI" : "LATEST") : "")).toUpperCase();

  const header = (w: number) =>
    h(
      "div",
      w < 560
        ? { flexDirection: "column", gap: 10, width: w, borderBottom: `4px solid ${ink}`, paddingBottom: 18 }
        : { justifyContent: "space-between", alignItems: "center", width: w, borderBottom: `4px solid ${ink}`, paddingBottom: 22 },
      h("div", { fontSize: w < 560 ? 24 : 28, fontWeight: 900, letterSpacing: 2, color: ink }, o.brandName.toUpperCase()),
      h("div", { fontSize: w < 560 ? 22 : 26, fontWeight: 800, letterSpacing: 3, color: ink }, kicker)
    );

  const middle = (w: number) =>
    h(
      "div",
      { flexDirection: "column", gap: bullets.length ? 22 : photo && photo !== "full" ? 20 : 30, width: w },
      ...(slide.kind === "quote" ? [h("div", { fontSize: Math.round(200 * Math.max(scale, 0.6)), fontWeight: 900, color: ink, lineHeight: 0.7, height: Math.round(120 * Math.max(scale, 0.6)) }, "“")] : []),
      richText(slide.title, tSize, 900, ink, paper, 1.12),
      ...(slide.body ? [richText(slide.body, bullets.length ? Math.round(bodySize * 0.85) : bodySize, 400, ink, paper, 1.3)] : []),
      ...(bullets.length ? [bulletList(bullets, Math.round((square ? 32 : story ? 44 : 38) * (photo && photo !== "full" ? 0.82 : 1)), ink, paper, w)] : [])
    );

  const footer = (w: number) =>
    h(
      "div",
      { justifyContent: "space-between", alignItems: "flex-end", width: w },
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

  const frame = (w: number, height: number, style: Record<string, unknown>, ...kids: Node[]) =>
    h("div", { width: w, height, flexDirection: "column", justifyContent: "space-between", ...style }, ...kids);
  const card = (...kids: Node[]) => h("div", { width: W, height: H, backgroundColor: paper, fontFamily: "Plus Jakarta Sans", position: "relative" }, ...kids);

  if (!photo || !slide.image) {
    const innerW = W - pad * 2 - (story ? 60 : 0);
    return card(frame(innerW, H - top - bottom, { marginTop: top, marginLeft: pad }, header(innerW), middle(innerW), footer(innerW)));
  }

  if (photo === "full") {
    const innerW = W - pad * 2 - (story ? 60 : 0);
    return card(
      h("div", { position: "absolute", left: 0, top: 0, width: W, height: H }, img(slide.image, W, H)),
      h("div", { position: "absolute", left: 0, top: 0, width: W, height: H, backgroundImage: `linear-gradient(to bottom, ${rgba(paper, 0.55)} 0%, ${rgba(paper, 0.05)} 22%, ${rgba(paper, 0.1)} 42%, ${rgba(paper, 0.88)} 72%, ${rgba(paper, 0.96)} 100%)` }),
      h(
        "div",
        { position: "absolute", left: pad, top, width: innerW, height: H - top - bottom, flexDirection: "column", justifyContent: "space-between" },
        header(innerW),
        h("div", { flexDirection: "column", gap: 44, width: innerW }, middle(innerW), footer(innerW))
      )
    );
  }

  if (photo === "top" || photo === "bottom") {
    const imgH = Math.round(H * (story ? 0.44 : square ? 0.46 : 0.5));
    const innerW = W - pad * 2 - (story ? 60 : 0);
    const textH = H - imgH - (photo === "top" ? pad + bottom : top + pad);
    const text = frame(innerW, textH, { marginLeft: pad, marginTop: photo === "top" ? pad : top, marginBottom: photo === "top" ? bottom : pad }, header(innerW), middle(innerW), footer(innerW));
    const pic = h("div", { width: W, height: imgH }, img(slide.image, W, imgH));
    return card(h("div", { flexDirection: "column", width: W, height: H }, ...(photo === "top" ? [pic, text] : [text, pic])));
  }

  // left / right
  const imgW = Math.round(W * (square ? 0.44 : 0.46));
  const textW = W - imgW - pad * 2;
  const text = frame(textW, H - top - bottom, { marginLeft: pad, marginRight: pad, marginTop: top, marginBottom: bottom }, header(textW), middle(textW), footer(textW));
  const pic = h("div", { width: imgW, height: H }, img(slide.image, imgW, H));
  return card(h("div", { flexDirection: "row", width: W, height: H }, ...(photo === "left" ? [pic, text] : [text, pic])));
}
