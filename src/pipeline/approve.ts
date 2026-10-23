import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { nextFreeSlot } from "./schedule";

export const VIDEO_TARGETS = ["instagram:reel", "tiktok:video", "youtube:short"];
export const ALL_TARGETS = ["instagram:carousel", "instagram:reel", "threads:text", "threads:carousel", "tiktok:video", "youtube:short"] as const;

/** Wake the GitHub Actions video worker right away (it also runs on a schedule as backup). */
async function dispatchRender(draftId: string) {
  if (!env.githubDispatchToken || !env.githubRepo) return;
  await fetch(`https://api.github.com/repos/${env.githubRepo}/actions/workflows/render-video.yml/dispatches`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.githubDispatchToken}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
    body: JSON.stringify({ ref: "main", inputs: { draft_id: draftId } }),
  }).catch(() => {});
}

export async function approveDraft(id: string, mode: "now" | "slot" | Date, targets?: string[]) {
  const supa = db();
  const { data: d } = await supa.from("drafts").select("id, status, targets, video_url").eq("id", id).single();
  if (!d) throw new Error("draft not found");
  if (!["pending", "failed"].includes(d.status as string)) return { status: d.status as string, scheduledFor: null };

  const finalTargets = (targets?.length ? targets : (d.targets as string[])).filter((t) => (ALL_TARGETS as readonly string[]).includes(t));
  let when: Date;
  if (mode === "now") when = new Date();
  else if (mode instanceof Date) when = mode;
  else {
    const { data: taken } = await supa.from("drafts").select("scheduled_for").in("status", ["scheduled", "rendering"]).not("scheduled_for", "is", null);
    when = nextFreeSlot(env.postSlots, (taken ?? []).map((t) => new Date(t.scheduled_for as string)));
  }

  const needsVideo = finalTargets.some((t) => VIDEO_TARGETS.includes(t)) && !d.video_url;
  const status = needsVideo ? "rendering" : "scheduled";
  await supa
    .from("drafts")
    .update({ status, targets: finalTargets, scheduled_for: when.toISOString(), approved_at: new Date().toISOString(), error: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (needsVideo) await dispatchRender(id);
  return { status, scheduledFor: when };
}

export async function rejectDraft(id: string) {
  await db().from("drafts").update({ status: "rejected", updated_at: new Date().toISOString() }).eq("id", id).in("status", ["pending", "failed", "scheduled"]);
}
