/** Render a sample video to ./out/sample.mp4 (needs ffmpeg; uses TTS only if GOOGLE_TTS_API_KEY is set). */
import { copyFile, mkdir } from "node:fs/promises";
import { renderVideo } from "../src/pipeline/video";
import type { DraftContent } from "../src/lib/types";

const draft = {
  category: "olahraga",
  sourceCredit: "Sumber: Antara, Detik, Tempo",
  video: {
    title: "Timnas lolos ke final!",
    description: "",
    scenes: [
      { onScreen: "Timnas lolos ke final Piala AFF!", voiceover: "Timnas Indonesia lolos ke final Piala AFF!", seconds: 3 },
      { onScreen: "Gol penentu di menit 89", voiceover: "Gol penentu datang di menit delapan puluh sembilan.", seconds: 3.5 },
      { onScreen: "Final digelar dua leg mulai pekan depan", voiceover: "Final digelar dua leg, mulai pekan depan.", seconds: 3.5 },
      { onScreen: "Siapa man of the match versimu?", voiceover: "Menurutmu siapa man of the match? Tulis di komentar.", seconds: 3 },
    ],
  },
} as unknown as DraftContent;

await mkdir("out", { recursive: true });
const { file, seconds } = await renderVideo(draft, { name: "Kabar Kilat", handle: "@kabarkilat.id" });
await copyFile(file, "out/sample.mp4");
console.log(`out/sample.mp4 (${seconds}s)`);
