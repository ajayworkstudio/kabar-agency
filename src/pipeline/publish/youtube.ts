/**
 * YouTube Data API v3 resumable upload. A vertical video ≤ 3 min is treated as a Short.
 * Default quota is 10,000 units/day and an upload costs ~1,600, so plan on ~6 uploads/day
 * unless you request more quota.
 */
import { youtubeAccessToken } from "@/lib/tokens";

export async function ytShort(video: Uint8Array, meta: { title: string; description: string; tags: string[] }) {
  const token = await youtubeAccessToken();
  const title = meta.title.includes("#Shorts") ? meta.title : `${meta.title.slice(0, 90)} #Shorts`;
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(video.byteLength),
    },
    body: JSON.stringify({
      snippet: {
        title: title.slice(0, 100),
        description: meta.description.slice(0, 4900),
        tags: meta.tags.map((t) => t.replace(/^#/, "")).slice(0, 15),
        categoryId: "25", // News & Politics
        defaultLanguage: "id",
        defaultAudioLanguage: "id",
      },
      status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
    }),
  });
  if (!init.ok) throw new Error(`YouTube init ${init.status}: ${(await init.text()).slice(0, 300)}`);
  const uploadUrl = init.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube: no upload URL");

  const up = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": "video/mp4", "Content-Length": String(video.byteLength) }, body: video as unknown as BodyInit });
  const j = (await up.json()) as { id?: string; error?: { message: string } };
  if (!j.id) throw new Error(`YouTube upload: ${j.error?.message ?? up.status}`);
  return { externalId: j.id, permalink: `https://youtube.com/shorts/${j.id}` };
}

export async function ytMetrics(ids: string[]) {
  if (!ids.length) return {};
  const token = await youtubeAccessToken();
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${ids.join(",")}`, { headers: { Authorization: `Bearer ${token}` } });
  const j = (await res.json()) as { items?: { id: string; statistics: Record<string, string> }[] };
  return Object.fromEntries(
    (j.items ?? []).map((v) => [v.id, { views: Number(v.statistics.viewCount ?? 0), likes: Number(v.statistics.likeCount ?? 0), comments: Number(v.statistics.commentCount ?? 0) }])
  );
}
