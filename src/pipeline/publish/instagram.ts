/**
 * Instagram API with Instagram Login (graph.instagram.com) — Business or Creator account.
 * Publishing is two-step: create a media container, wait until FINISHED, then media_publish.
 */
import { env } from "@/lib/env";
import { getToken } from "@/lib/tokens";

const V = process.env.IG_GRAPH_VERSION ?? "v24.0";
const base = () => `https://graph.instagram.com/${V}`;

async function call(pathname: string, params: Record<string, string>, method: "GET" | "POST" = "POST") {
  const { access } = await getToken("instagram");
  const qs = new URLSearchParams({ ...params, access_token: access });
  const res = await fetch(`${base()}/${pathname}${method === "GET" ? `?${qs}` : ""}`, {
    method,
    ...(method === "POST" ? { body: qs, headers: { "Content-Type": "application/x-www-form-urlencoded" } } : {}),
  });
  const j = (await res.json()) as Record<string, unknown> & { error?: { message: string } };
  if (j.error) throw new Error(`IG ${pathname}: ${j.error.message}`);
  return j;
}

async function waitReady(containerId: string, timeoutMs = 240_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const j = await call(containerId, { fields: "status_code,status" }, "GET");
    if (j.status_code === "FINISHED") return;
    if (j.status_code === "ERROR" || j.status_code === "EXPIRED") throw new Error(`IG container ${j.status_code}: ${j.status ?? ""}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("IG container not ready in time");
}

async function publish(creationId: string) {
  const { id } = (await call(`${env.igUserId}/media_publish`, { creation_id: creationId })) as { id: string };
  const { permalink } = (await call(id, { fields: "permalink" }, "GET")) as { permalink?: string };
  return { externalId: id, permalink: permalink ?? null };
}

export async function igCarousel(imageUrls: string[], caption: string) {
  if (imageUrls.length < 2) throw new Error("carousel needs ≥ 2 images");
  const children: string[] = [];
  for (const url of imageUrls.slice(0, 10)) {
    const { id } = (await call(`${env.igUserId}/media`, { image_url: url, is_carousel_item: "true" })) as { id: string };
    children.push(id);
  }
  for (const c of children) await waitReady(c);
  const { id } = (await call(`${env.igUserId}/media`, { media_type: "CAROUSEL", children: children.join(","), caption: caption.slice(0, 2200) })) as { id: string };
  await waitReady(id);
  return publish(id);
}

export async function igReel(videoUrl: string, caption: string, coverUrl?: string) {
  const { id } = (await call(`${env.igUserId}/media`, {
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption.slice(0, 2200),
    share_to_feed: "true",
    ...(coverUrl ? { cover_url: coverUrl } : {}),
  })) as { id: string };
  await waitReady(id, 280_000);
  return publish(id);
}

export async function igMetrics(mediaId: string) {
  const j = (await call(`${mediaId}/insights`, { metric: "views,likes,comments,shares,saved" }, "GET")) as {
    data: { name: string; values: { value: number }[] }[];
  };
  return Object.fromEntries(j.data.map((m) => [m.name === "saved" ? "saves" : m.name, m.values?.[0]?.value ?? 0]));
}
