/**
 * TikTok Content Posting API — Direct Post via FILE_UPLOAD
 * (PULL_FROM_URL would require verifying ownership of the media domain).
 *
 * IMPORTANT: until your developer app passes TikTok's audit, every post is forced
 * to SELF_ONLY (visible only to you) and the posting account must be private.
 * Set TIKTOK_AUDITED=true once approved.
 */
import { env } from "@/lib/env";
import { getToken } from "@/lib/tokens";

const API = "https://open.tiktokapis.com/v2";

async function tt<T>(pathname: string, body: unknown): Promise<T> {
  const { access } = await getToken("tiktok");
  const res = await fetch(`${API}${pathname}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as { data: T; error: { code: string; message: string } };
  if (j.error && j.error.code !== "ok") throw new Error(`TikTok ${pathname}: ${j.error.code} ${j.error.message}`);
  return j.data;
}

export async function tiktokVideo(video: Uint8Array, caption: string, opts: { aiVoice: boolean }) {
  const creator = await tt<{ privacy_level_options: string[]; max_video_post_duration_sec: number }>("/post/publish/creator_info/query/", {});
  const wanted = env.tiktokAudited ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY";
  const privacy = creator.privacy_level_options.includes(wanted) ? wanted : "SELF_ONLY";

  const size = video.byteLength;
  if (size > 64 * 1024 * 1024) throw new Error("video too large for single-chunk upload");
  const init = await tt<{ publish_id: string; upload_url: string }>("/post/publish/video/init/", {
    post_info: {
      title: caption.slice(0, 2200),
      privacy_level: privacy,
      disable_comment: false,
      disable_duet: false,
      disable_stitch: false,
      is_aigc: opts.aiVoice,
    },
    source_info: { source: "FILE_UPLOAD", video_size: size, chunk_size: size, total_chunk_count: 1 },
  });

  const put = await fetch(init.upload_url, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(size), "Content-Range": `bytes 0-${size - 1}/${size}` },
    body: video as unknown as BodyInit,
  });
  if (!put.ok) throw new Error(`TikTok upload ${put.status}`);

  // poll until TikTok finishes processing
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const st = await tt<{ status: string; fail_reason?: string; publicaly_available_post_id?: (string | number)[] }>("/post/publish/status/fetch/", { publish_id: init.publish_id });
    if (st.status === "PUBLISH_COMPLETE") {
      const vid = st.publicaly_available_post_id?.[0];
      return { externalId: vid ? String(vid) : init.publish_id, permalink: vid ? `https://www.tiktok.com/video/${vid}` : null, privacy };
    }
    if (st.status === "FAILED") throw new Error(`TikTok publish failed: ${st.fail_reason ?? "unknown"}`);
  }
  return { externalId: init.publish_id, permalink: null, privacy }; // still processing; metrics cron will pick it up later
}

export async function tiktokMetrics(videoIds: string[]) {
  if (!videoIds.length) return {};
  const data = await tt<{ videos: { id: string; view_count: number; like_count: number; comment_count: number; share_count: number }[] }>(
    "/video/query/?fields=id,view_count,like_count,comment_count,share_count",
    { filters: { video_ids: videoIds.slice(0, 20) } }
  );
  return Object.fromEntries(data.videos.map((v) => [v.id, { views: v.view_count, likes: v.like_count, comments: v.comment_count, shares: v.share_count }]));
}
