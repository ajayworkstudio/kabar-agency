/**
 * Short vertical video (Reels / TikTok / Shorts) from the writer's scene script.
 * Each scene = a branded 9:16 frame with a slow push-in, optional Indonesian
 * voiceover (Google Cloud TTS), optional music bed from assets/music/.
 * Needs the ffmpeg binary, so this runs in the worker (GitHub Actions), not on Vercel.
 */
import { execFile } from "node:child_process";
import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { env } from "@/lib/env";
import type { DraftContent } from "@/lib/types";
import { renderCard } from "./cards";

const run = promisify(execFile);
const FPS = 30;

async function ffprobeDuration(file: string): Promise<number> {
  const { stdout } = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return Number(stdout.trim()) || 0;
}

async function tts(text: string, out: string): Promise<boolean> {
  if (!env.googleTtsKey) return false;
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${env.googleTtsKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: "id-ID", name: env.googleTtsVoice },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.1, sampleRateHertz: 48000 },
    }),
  });
  if (!res.ok) throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const { audioContent } = (await res.json()) as { audioContent: string };
  await writeFile(out, Buffer.from(audioContent, "base64"));
  return true;
}

async function pickMusic(): Promise<string | null> {
  const dir = path.join(process.cwd(), "assets", "music");
  try {
    const files = (await readdir(dir)).filter((f) => /\.(mp3|m4a|wav)$/i.test(f));
    return files.length ? path.join(dir, files[Math.floor(Math.random() * files.length)]) : null;
  } catch {
    return null;
  }
}

export async function renderVideo(draft: DraftContent, brand: { name: string; handle: string }): Promise<{ file: string; seconds: number }> {
  const work = await mkdtemp(path.join(tmpdir(), "kv-"));
  const scenes = draft.video.scenes;
  const segs: string[] = [];
  let total = 0;

  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const png = path.join(work, `s${i}.png`);
    await writeFile(
      png,
      await renderCard(
        i === 0
          ? { kind: "cover", title: sc.onScreen }
          : i === scenes.length - 1
            ? { kind: "closing", title: sc.onScreen }
            : { kind: "point", title: sc.onScreen },
        { category: draft.category, brandName: brand.name, brandHandle: brand.handle, sourceCredit: draft.sourceCredit, index: i, total: 1, format: "story", palette: draft.design?.palette ?? null }
      )
    );

    const mp3 = path.join(work, `s${i}.mp3`);
    const hasVoice = await tts(sc.voiceover, mp3);
    const dur = Math.max(sc.seconds, hasVoice ? (await ffprobeDuration(mp3)) + 0.35 : 0);
    total += dur;
    const frames = Math.ceil(dur * FPS);

    const seg = path.join(work, `s${i}.mp4`);
    const audioIn = hasVoice ? ["-i", mp3] : ["-f", "lavfi", "-t", String(dur), "-i", "anullsrc=r=48000:cl=stereo"];
    await run("ffmpeg", [
      "-y", "-loop", "1", "-framerate", String(FPS), "-i", png, ...audioIn,
      "-filter_complex",
      // render at 2x then zoompan down = smooth push-in without jitter
      `[0:v]scale=2160:3840,zoompan=z='min(1+0.0009*on,1.07)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=${FPS},fade=t=in:st=0:d=0.2,format=yuv420p[v];[1:a]apad,atrim=0:${dur.toFixed(2)}[a]`,
      "-map", "[v]", "-map", "[a]", "-t", dur.toFixed(2),
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
      seg,
    ], { maxBuffer: 1 << 24 });
    segs.push(seg);
  }

  const list = path.join(work, "list.txt");
  await writeFile(list, segs.map((s) => `file '${s}'`).join("\n"));
  const joined = path.join(work, "joined.mp4");
  await run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);

  const music = await pickMusic();
  const final = path.join(work, "final.mp4");
  if (music) {
    await run("ffmpeg", [
      "-y", "-i", joined, "-stream_loop", "-1", "-i", music,
      "-filter_complex", `[1:a]volume=0.12,afade=t=out:st=${Math.max(0, total - 1.2).toFixed(2)}:d=1.2[m];[0:a][m]amix=inputs=2:duration=first:dropout_transition=0[a]`,
      "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", final,
    ]);
  } else {
    await run("ffmpeg", ["-y", "-i", joined, "-c", "copy", "-movflags", "+faststart", final]);
  }
  return { file: final, seconds: Math.round(total * 10) / 10 };
}

export async function readBytes(file: string) {
  return new Uint8Array(await readFile(file));
}
