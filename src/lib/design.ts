import { z } from "zod";
import { ALL_TARGETS } from "@/pipeline/approve";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "warna harus format #RRGGBB");

export const SlideInput = z.object({
  kind: z.enum(["cover", "point", "quote", "closing"]),
  kicker: z.string().max(40).optional(),
  title: z.string().trim().min(1, "judul slide kosong").max(220),
  body: z.string().max(400).optional(),
  bullets: z.array(z.string().trim().min(1).max(140)).max(10).optional(),
  // uploaded photo URL, or a compressed data: URL when storage isn't available (demo)
  image: z.string().max(3_000_000).refine((u) => /^https:\/\//.test(u) || /^data:image\/(jpeg|png);base64,/.test(u), "gambar harus https:// atau data:image").optional(),
  imageLayout: z.enum(["top", "bottom", "left", "right", "full"]).optional(),
});

export const PaletteInput = z.object({ bg: hex, fg: hex });
export const FormatInput = z.enum(["post", "square", "story"]);

export const PreviewInput = z.object({
  slide: SlideInput,
  palette: PaletteInput,
  format: FormatInput,
  index: z.number().int().min(0).max(19),
  total: z.number().int().min(1).max(20),
  sourceCredit: z.string().max(120).optional(),
});

export const DesignInput = z.object({
  agent_id: z.string().uuid().nullable(),
  title: z.string().trim().min(2).max(200),
  category: z.enum(["politik", "olahraga", "hiburan", "ekonomi", "teknologi", "umum"]).default("umum"),
  slides: z.array(SlideInput).min(1).max(20),
  palette: PaletteInput,
  format: FormatInput,
  caption: z.string().max(2200).default(""),
  hashtags: z.array(z.string()).max(30).default([]),
  sourceCredit: z.string().max(120).default(""),
  targets: z.array(z.enum(ALL_TARGETS)).default(["instagram:carousel"]),
});

export { slidesFromText } from "./slides";
