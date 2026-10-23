/** Render a sample carousel + one vertical frame to ./out so you can check the design without any API keys. */
import { mkdir, writeFile } from "node:fs/promises";
import { renderCarousel, renderCard } from "../src/pipeline/cards";
import type { CardSlide } from "../src/lib/types";

const slides: CardSlide[] = [
  { kind: "cover", title: "Timnas Lolos ke Babak Final Piala AFF", body: "Menang 2–1 lewat gol di menit akhir. Ini 4 fakta yang perlu kamu tahu." },
  { kind: "point", kicker: "Fakta 1", title: "Gol penentu datang di menit 89", body: "Sundulan dari tendangan sudut mengubah skor setelah laga sempat imbang sejak babak pertama." },
  { kind: "quote", kicker: "Kata pelatih", title: "Anak-anak bermain dengan hati malam ini", body: "Pelatih kepala, dalam konferensi pers usai laga." },
  { kind: "point", kicker: "Selanjutnya", title: "Final digelar dua leg, mulai pekan depan", body: "Leg pertama di kandang lawan, leg kedua di Jakarta." },
  { kind: "closing", title: "Siapa man of the match versimu?", body: "Tulis di kolom komentar ya" },
];

const base = { category: "olahraga" as const, brandName: "Kabar Kilat", brandHandle: "@kabarkilat.id", sourceCredit: "Sumber: Antara, Detik, Tempo" };

await mkdir("out", { recursive: true });
const pngs = await renderCarousel(slides, base);
await Promise.all(pngs.map((p, i) => writeFile(`out/card-${i + 1}.png`, p)));
await writeFile("out/frame-story.png", await renderCard(slides[0], { ...base, index: 0, total: 1, format: "story" }));
await writeFile(
  "out/card-politik.png",
  await renderCard({ kind: "cover", title: "DPR Sahkan Revisi UU, Ini Poin yang Dipersoalkan", body: "Tiga fraksi menyatakan keberatan. Apa saja isinya?" }, { ...base, category: "politik", index: 0, total: 5, format: "post" })
);
console.log("wrote out/card-*.png and out/frame-story.png");
