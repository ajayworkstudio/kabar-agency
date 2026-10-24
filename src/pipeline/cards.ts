/**
 * Branded news cards rendered to PNG with satori + resvg.
 * Purely typographic: no outlet photos are reused, so there is no image-rights question.
 * Same module renders 4:5 carousel slides (1080×1350) and 9:16 video frames (1080×1920).
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import type { Category } from "@/config/sources";
import type { CardSlide } from "@/lib/types";
import { SIZES, twoToneTree, type DesignFormat, type Palette } from "./twotone";

type Node = { type: string; props: { style?: Record<string, unknown>; children?: unknown } & Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: unknown[]): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children: children.length === 1 ? children[0] : children },
});

const EN = process.env.CONTENT_LANG !== "id";
export const THEME: Record<Category, { accent: string; label: string }> = {
  politik: { accent: "#FF4D4F", label: EN ? "POLITICS" : "POLITIK" },
  olahraga: { accent: "#22C55E", label: EN ? "SPORTS" : "OLAHRAGA" },
  hiburan: { accent: "#F472B6", label: EN ? "ENTERTAINMENT" : "HIBURAN" },
  ekonomi: { accent: "#F5B301", label: EN ? "ECONOMY" : "EKONOMI" },
  teknologi: { accent: "#38BDF8", label: EN ? "TECH" : "TEKNOLOGI" },
  umum: { accent: "#A78BFA", label: EN ? "NEWS" : "NASIONAL" },
};

const INK = "#0B0F1A";
const PAPER = "#F7F5F0";
const MUTED = "#9AA3B5";

/** Card typeface: Plus Jakarta Sans (OFL). Weight 900 requests resolve to ExtraBold 800. */
export const CARD_FONT = "Plus Jakarta Sans";
let fontCache: { name: string; data: Buffer; weight: 400 | 600 | 800; style: "normal" }[] | null = null;
async function fonts() {
  if (fontCache) return fontCache;
  const dir = path.join(process.cwd(), "assets", "fonts");
  const load = (f: string) => readFile(path.join(dir, f));
  const [r, sb, xb] = await Promise.all([load("PlusJakartaSans-400.woff"), load("PlusJakartaSans-600.woff"), load("PlusJakartaSans-800.woff")]);
  fontCache = [
    { name: CARD_FONT, data: r, weight: 400, style: "normal" },
    { name: CARD_FONT, data: sb, weight: 600, style: "normal" },
    { name: CARD_FONT, data: xb, weight: 800, style: "normal" },
  ];
  return fontCache;
}

/** Shrink type as text gets longer so it never overflows the frame. */
function titleSize(text: string, base: number) {
  const n = text.length;
  if (n <= 28) return base;
  if (n <= 50) return Math.round(base * 0.82);
  if (n <= 80) return Math.round(base * 0.68);
  return Math.round(base * 0.56);
}

export type CardOpts = {
  category: Category;
  brandName: string;
  brandHandle: string;
  sourceCredit: string;
  index: number;
  total: number;
  format: "post" | "story" | "square"; // post = 1080×1350, story/video = 1080×1920, square = 1080×1080
  /** When set, render the two-colour designer style instead of the news theme. */
  palette?: Palette | null;
};

function cardTree(slide: CardSlide, o: CardOpts): Node {
  const { accent, label } = THEME[o.category];
  const W = 1080, H = o.format === "story" ? 1920 : 1350;
  const pad = 84;
  const innerW = o.format === "story" ? W - pad * 2 - 60 : W - pad * 2;
  const isCover = slide.kind === "cover";
  const isQuote = slide.kind === "quote";
  const isClosing = slide.kind === "closing";
  const bg = isCover ? INK : isClosing ? accent : PAPER;
  const fg = isCover ? "#FFFFFF" : INK;
  const sub = isCover ? "#C9D1E0" : "#3A4255";
  const tSize = titleSize(slide.title, isCover ? (o.format === "story" ? 132 : 120) : o.format === "story" ? 112 : 92);

  const topBar = h(
    "div",
    { justifyContent: "space-between", alignItems: "center", width: "100%" },
    h(
      "div",
      { alignItems: "center", gap: 18 },
      h("div", { width: 22, height: 22, borderRadius: 11, backgroundColor: isClosing ? INK : accent }),
      h("div", { fontSize: 30, fontWeight: 800, letterSpacing: 1, color: fg }, o.brandName.toUpperCase())
    ),
    h(
      "div",
      { fontSize: 24, fontWeight: 800, letterSpacing: 3, color: isClosing ? INK : isCover ? INK : "#FFFFFF", backgroundColor: isClosing ? "#FFFFFF" : accent, padding: "10px 20px", borderRadius: 8 },
      slide.kicker?.toUpperCase() || label
    )
  );

  const quoteMark = isQuote ? h("div", { fontSize: 220, fontWeight: 900, color: accent, lineHeight: 0.8, height: 150 }, "“") : null;

  const middle = h(
    "div",
    { flexDirection: "column", gap: 34, width: "100%" },
    ...(quoteMark ? [quoteMark] : []),
    isCover ? h("div", { width: 140, height: 14, backgroundColor: accent }) : h("div", { width: 0, height: 0 }),
    h("div", { fontSize: tSize, fontWeight: 900, lineHeight: 1.04, letterSpacing: -2, color: fg }, slide.title),
    ...(slide.body ? [h("div", { fontSize: o.format === "story" ? 44 : 40, fontWeight: 400, lineHeight: 1.35, color: sub }, slide.body)] : [])
  );

  const footer = h(
    "div",
    { justifyContent: "space-between", alignItems: "flex-end", borderTop: `3px solid ${isCover ? "#283044" : isClosing ? INK : "#D9D4C7"}`, paddingTop: 28, width: innerW },
    h(
      "div",
      { flexDirection: "column", gap: 6 },
      h("div", { fontSize: 26, fontWeight: 600, color: isCover ? MUTED : isClosing ? "#1B2233" : "#5B6375" }, o.sourceCredit),
      h("div", { fontSize: 26, fontWeight: 800, color: fg }, o.brandHandle)
    ),
    o.total > 1 ? h("div", { fontSize: 30, fontWeight: 800, color: isCover ? accent : fg }, `${o.index + 1}/${o.total}${isCover ? " ›" : ""}`) : h("div", {}, "")
  );

  // satori sizes boxes content-box, so pad with an inner frame of explicit size
  return h(
    "div",
    { width: W, height: H, backgroundColor: bg, fontFamily: CARD_FONT },
    h(
      "div",
      // story/video: keep clear of TikTok/Shorts UI overlays at the top and bottom
      o.format === "story"
        ? { width: W - pad * 2 - 60, height: H - 220 - 340, marginTop: 220, marginLeft: pad, flexDirection: "column", justifyContent: "space-between" }
        : { width: W - pad * 2, height: H - pad * 2, margin: pad, flexDirection: "column", justifyContent: "space-between" },
      topBar,
      middle,
      footer
    )
  );
}

export async function renderCard(slide: CardSlide, o: CardOpts): Promise<Uint8Array> {
  const { W, H } = SIZES[o.format as DesignFormat];
  const tree = o.palette
    ? twoToneTree(slide, { palette: o.palette, format: o.format, brandName: o.brandName, brandHandle: o.brandHandle, sourceCredit: o.sourceCredit, index: o.index, total: o.total })
    : cardTree(slide, { ...o, format: o.format === "square" ? "post" : o.format });
  const svg = await satori(tree as unknown as Parameters<typeof satori>[0], { width: W, height: H, fonts: await fonts() });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: W } }).render().asPng();
  return new Uint8Array(png);
}

export async function renderCarousel(slides: CardSlide[], base: Omit<CardOpts, "index" | "total" | "format">, format: CardOpts["format"] = "post") {
  return Promise.all(slides.map((s, i) => renderCard(s, { ...base, index: i, total: slides.length, format })));
}
