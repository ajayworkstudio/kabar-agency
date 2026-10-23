import { syncDraftTask } from "@/lib/agents";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { markMessage, sendText } from "@/lib/telegram";
import type { DraftContent } from "@/lib/types";
import { VIDEO_TARGETS } from "../approve";
import { igCarousel, igMetrics, igReel } from "./instagram";
import { threadsCarousel, threadsMetrics, threadsText } from "./threads";
import { tiktokMetrics, tiktokVideo } from "./tiktok";
import { ytMetrics, ytShort } from "./youtube";

type Result = { externalId: string; permalink: string | null };

function withTags(text: string, tags: string[], max: number) {
  const t = tags.filter((h) => !text.includes(h)).join(" ");
  return `${text}\n\n${t}`.trim().slice(0, max);
}

async function publishTarget(target: string, c: DraftContent, cards: string[], videoUrl: string | null, getVideo: () => Promise<Uint8Array>): Promise<Result> {
  const configured = {
    instagram: !!env.igUserId,
    threads: !!env.threadsUserId,
    tiktok: !!env.tiktokClientKey,
    youtube: !!env.ytClientId,
  } as Record<string, boolean>;
  const [platform] = target.split(":");
  if (!configured[platform]) throw new Error(`${platform} not configured`);
  if (VIDEO_TARGETS.includes(target) && !videoUrl) throw new Error("video not rendered");

  switch (target) {
    case "instagram:carousel":
      return igCarousel(cards, withTags(c.instagramCaption, c.hashtags, 2200));
    case "instagram:reel":
      return igReel(videoUrl!, withTags(c.instagramCaption, c.hashtags, 2200), cards[0]);
    case "threads:text":
      return threadsText(c.threadsPost, [...c.threadsFollowUps, c.sourceCredit].filter(Boolean));
    case "threads:carousel":
      return threadsCarousel(cards, c.threadsPost);
    case "tiktok:video":
      return tiktokVideo(await getVideo(), withTags(c.tiktokCaption, c.hashtags.slice(0, 5), 2200), { aiVoice: !!env.googleTtsKey });
    case "youtube:short":
      return ytShort(await getVideo(), { title: c.video.title, description: `${c.video.description}\n\n${c.sourceCredit}\n\n${c.hashtags.join(" ")} #Shorts`, tags: c.hashtags });
    default:
      throw new Error(`unknown target ${target}`);
  }
}

/** Publish every approved draft whose time has come. */
export async function publishDue() {
  const supa = db();
  const { data: due } = await supa
    .from("drafts")
    .select("id")
    .eq("status", "scheduled")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for")
    .limit(3);

  const lines: string[] = [];
  for (const { id } of due ?? []) {
    // atomic claim
    const { data: claimed } = await supa.from("drafts").update({ status: "publishing", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "scheduled").select("*");
    const d = claimed?.[0];
    if (!d) continue;

    const content = d.content as DraftContent;
    let videoBytes: Uint8Array | null = null;
    const getVideo = async () => (videoBytes ??= new Uint8Array(await (await fetch(d.video_url as string)).arrayBuffer()));

    const { data: done } = await supa.from("posts").select("platform, format, status").eq("draft_id", id);
    const ok = new Set((done ?? []).filter((p) => p.status === "published").map((p) => `${p.platform}:${p.format}`));

    const results: string[] = [];
    let failures = 0;
    for (const target of d.targets as string[]) {
      if (ok.has(target)) continue;
      const [platform, format] = target.split(":");
      try {
        const r = await publishTarget(target, content, d.card_urls as string[], d.video_url as string | null, getVideo);
        await supa.from("posts").upsert(
          { draft_id: id, platform, format, status: "published", external_id: r.externalId, permalink: r.permalink, published_at: new Date().toISOString(), error: null },
          { onConflict: "draft_id,platform,format" }
        );
        results.push(`✅ ${target}${r.permalink ? ` ${r.permalink}` : ""}`);
      } catch (e) {
        failures++;
        const msg = e instanceof Error ? e.message : String(e);
        await supa.from("posts").upsert({ draft_id: id, platform, format, status: "failed", error: msg.slice(0, 500) }, { onConflict: "draft_id,platform,format" });
        results.push(`❌ ${target}: ${msg.slice(0, 120)}`);
      }
    }

    await supa
      .from("drafts")
      .update({ status: failures ? "failed" : "published", error: failures ? `${failures} target(s) failed` : null, updated_at: new Date().toISOString() })
      .eq("id", id);
    await syncDraftTask(id, failures ? "failed" : "done", failures ? `${failures} platform gagal` : null);
    if (d.telegram_message_id) await markMessage(d.telegram_message_id as number, failures ? "⚠️ Sebagian gagal — cek dashboard" : "✅ Terbit");
    await sendText(`<b>${content.hook}</b>\n${results.join("\n")}`);
    lines.push(`${content.hook.slice(0, 40)} → ${results.length - failures}/${results.length}`);
  }
  return { summary: lines.length ? lines.join("; ") : "nothing due" };
}

/** Pull engagement numbers for posts from the last 7 days. */
export async function collectMetrics() {
  const supa = db();
  const { data: posts } = await supa
    .from("posts")
    .select("id, platform, external_id")
    .eq("status", "published")
    .gte("published_at", new Date(Date.now() - 7 * 86400_000).toISOString());
  if (!posts?.length) return { summary: "no recent posts" };

  const byPlat = (p: string) => posts.filter((x) => x.platform === p && x.external_id);
  const updates: { id: string; metrics: Record<string, number> }[] = [];

  for (const p of byPlat("instagram")) {
    try { updates.push({ id: p.id, metrics: await igMetrics(p.external_id as string) }); } catch { /* insights can lag right after posting */ }
  }
  for (const p of byPlat("threads")) {
    try { updates.push({ id: p.id, metrics: await threadsMetrics(p.external_id as string) }); } catch { /* ignore */ }
  }
  try {
    const yt = await ytMetrics(byPlat("youtube").map((p) => p.external_id as string));
    byPlat("youtube").forEach((p) => yt[p.external_id as string] && updates.push({ id: p.id, metrics: yt[p.external_id as string] }));
  } catch { /* not configured */ }
  try {
    const tt = await tiktokMetrics(byPlat("tiktok").map((p) => p.external_id as string).filter((x) => /^\d+$/.test(x)));
    byPlat("tiktok").forEach((p) => tt[p.external_id as string] && updates.push({ id: p.id, metrics: tt[p.external_id as string] }));
  } catch { /* not configured */ }

  const now = new Date().toISOString();
  await Promise.all(updates.map((u) => supa.from("posts").update({ metrics: u.metrics, metrics_at: now }).eq("id", u.id)));
  return { summary: `metrics updated for ${updates.length}/${posts.length} posts` };
}
