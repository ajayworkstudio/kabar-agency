/** Render sample two-colour designs to ./out/design-*.png (no keys needed). */
import { mkdir, writeFile } from "node:fs/promises";
import { renderCarousel } from "../src/pipeline/cards";
import type { CardSlide } from "../src/lib/types";

const slides: CardSlide[] = [
  { kind: "cover", kicker: "Ekonomi", title: "Harga *beras* naik lagi di Jawa Tengah", body: "Ini yang perlu kamu tahu sebelum belanja minggu ini." },
  { kind: "point", kicker: "Fakta 1", title: "Naik Rp1.000/kg dalam *seminggu*", body: "Kenaikan tercatat di pasar-pasar Semarang, Solo, dan Purwokerto." },
  { kind: "quote", kicker: "Kata pedagang", title: "Pasokan dari petani mulai berkurang", body: "Pedagang Pasar Johar, Semarang." },
  { kind: "closing", title: "Di daerahmu *naik* juga?", body: "Ceritain di kolom komentar ya." },
];
const base = { category: "ekonomi" as const, brandName: "Kabar Kilat", brandHandle: "@kabarkilat.id", sourceCredit: "Sumber: Antara, Kompas" };

await mkdir("out", { recursive: true });
const a = await renderCarousel(slides, { ...base, palette: { bg: "#F4F1EA", fg: "#111111" } });
await Promise.all(a.map((p, i) => writeFile(`out/design-a-${i + 1}.png`, p)));
const b = await renderCarousel(slides, { ...base, palette: { bg: "#D7261E", fg: "#FFF8F0" } });
await Promise.all(b.map((p, i) => writeFile(`out/design-b-${i + 1}.png`, p)));
const s = await renderCarousel(slides.slice(0, 1), { ...base, palette: { bg: "#0B2A5B", fg: "#F5F1E6" } }, "square");
await writeFile("out/design-square.png", s[0]);
const st = await renderCarousel(slides.slice(1, 2), { ...base, palette: { bg: "#FFD400", fg: "#111111" } }, "story");
await writeFile("out/design-story.png", st[0]);
console.log("ok");
