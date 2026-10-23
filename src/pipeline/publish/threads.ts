/**
 * Threads API. Profiles may publish 250 posts per rolling 24h; a carousel counts as one.
 * Text posts are capped at 500 characters. Meta recommends ~30s between container creation and publish.
 */
import { env } from "@/lib/env";
import { getToken } from "@/lib/tokens";

const base = "https://graph.threads.net/v1.0";

async function call(pathname: string, params: Record<string, string>, method: "GET" | "POST" = "POST") {
  const { access } = await getToken("threads");
  const qs = new URLSearchParams({ ...params, access_token: access });
  const res = await fetch(`${base}/${pathname}${method === "GET" ? `?${qs}` : ""}`, {
    method,
    ...(method === "POST" ? { body: qs, headers: { "Content-Type": "application/x-www-form-urlencoded" } } : {}),
  });
  const j = (await res.json()) as Record<string, unknown> & { error?: { message: string } };
  if (j.error) throw new Error(`Threads ${pathname}: ${j.error.message}`);
  return j;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createAndPublish(params: Record<string, string>, waitMs: number) {
  const { id } = (await call(`${env.threadsUserId}/threads`, params)) as { id: string };
  await sleep(waitMs);
  const { id: postId } = (await call(`${env.threadsUserId}/threads_publish`, { creation_id: id })) as { id: string };
  return postId;
}

/** Main post plus optional follow-up replies chained under it. */
export async function threadsText(text: string, followUps: string[] = [], linkUrl?: string) {
  const mainId = await createAndPublish({ media_type: "TEXT", text: text.slice(0, 500), ...(linkUrl ? { link_attachment: linkUrl } : {}) }, 3000);
  let parent = mainId;
  for (const f of followUps.slice(0, 3)) {
    parent = await createAndPublish({ media_type: "TEXT", text: f.slice(0, 500), reply_to_id: parent }, 3000);
  }
  const { permalink } = (await call(mainId, { fields: "permalink" }, "GET")) as { permalink?: string };
  return { externalId: mainId, permalink: permalink ?? null };
}

export async function threadsCarousel(imageUrls: string[], text: string) {
  const children: string[] = [];
  for (const url of imageUrls.slice(0, 20)) {
    const { id } = (await call(`${env.threadsUserId}/threads`, { media_type: "IMAGE", image_url: url, is_carousel_item: "true" })) as { id: string };
    children.push(id);
  }
  await sleep(15000);
  const id = await createAndPublish({ media_type: "CAROUSEL", children: children.join(","), text: text.slice(0, 500) }, 20000);
  const { permalink } = (await call(id, { fields: "permalink" }, "GET")) as { permalink?: string };
  return { externalId: id, permalink: permalink ?? null };
}

export async function threadsMetrics(postId: string) {
  const j = (await call(`${postId}/insights`, { metric: "views,likes,replies,reposts,quotes" }, "GET")) as {
    data: { name: string; values?: { value: number }[]; total_value?: { value: number } }[];
  };
  const m = Object.fromEntries(j.data.map((d) => [d.name, d.values?.[0]?.value ?? d.total_value?.value ?? 0]));
  return { views: m.views ?? 0, likes: m.likes ?? 0, comments: m.replies ?? 0, shares: (m.reposts ?? 0) + (m.quotes ?? 0) };
}
