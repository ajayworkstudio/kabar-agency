/**
 * Video worker — runs in GitHub Actions (ffmpeg available there, not on Vercel).
 * Renders every draft in status "rendering", uploads the MP4, and hands it back to the
 * publish cron by setting status "scheduled".
 *
 *   npx tsx worker/render-video.ts            # all pending
 *   npx tsx worker/render-video.ts <draftId>  # one draft
 */
import { syncDraftTask } from "../src/lib/agents";
import { db, uploadMedia } from "../src/lib/db";
import { env } from "../src/lib/env";
import type { DraftContent } from "../src/lib/types";
import { readBytes, renderVideo } from "../src/pipeline/video";

const only = process.argv[2];
const supa = db();

let q = supa.from("drafts").select("id, content").eq("status", "rendering").order("scheduled_for").limit(5);
if (only) q = supa.from("drafts").select("id, content").eq("id", only).limit(1);
const { data: jobs, error } = await q;
if (error) throw error;

for (const job of jobs ?? []) {
  const t0 = Date.now();
  try {
    const { file, seconds } = await renderVideo(job.content as DraftContent, { name: env.brandName, handle: env.brandHandle });
    const url = await uploadMedia(`drafts/${job.id}/video.mp4`, await readBytes(file), "video/mp4");
    await supa.from("drafts").update({ video_url: url, status: "scheduled", updated_at: new Date().toISOString() }).eq("id", job.id).eq("status", "rendering");
    await supa.from("runs").insert({ job: "render", ok: true, summary: `${job.id.slice(0, 8)} ${seconds}s video`, duration_ms: Date.now() - t0 });
    console.log(`rendered ${job.id} (${seconds}s)`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supa.from("drafts").update({ status: "failed", error: `render: ${msg.slice(0, 400)}` }).eq("id", job.id);
    await syncDraftTask(job.id, "failed", `render: ${msg.slice(0, 200)}`);
    await supa.from("runs").insert({ job: "render", ok: false, summary: msg.slice(0, 500), duration_ms: Date.now() - t0 });
    console.error(`failed ${job.id}: ${msg}`);
  }
}
console.log(`done: ${jobs?.length ?? 0} job(s)`);
