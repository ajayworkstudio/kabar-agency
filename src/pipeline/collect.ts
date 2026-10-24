import { randomUUID } from "node:crypto";
import Parser from "rss-parser";
import { SOURCES, type SourceDef } from "@/config/sources";
import { db } from "@/lib/db";
import type { RawItem } from "@/lib/types";
import { canonicalOutlet, cleanTitle, guessCategory, heat, isSameStory, keywords, matchesTrend } from "./cluster";

const UA = "Mozilla/5.0 (compatible; KabarAgencyBot/0.1; +news aggregation, links back to source)";

type GItem = { title?: string; link?: string; contentSnippet?: string; content?: string; isoDate?: string; pubDate?: string; source?: unknown; approxTraffic?: string };

const parser: Parser<object, GItem> = new Parser({
  timeout: 15000,
  headers: { "User-Agent": UA },
  customFields: { item: [["source", "source"], ["ht:approx_traffic", "approxTraffic"]] },
});

function outletOf(item: GItem, src: SourceDef): string {
  if (src.kind !== "google_news") return src.outlet;
  const s = item.source as { _: string } | string | undefined;
  const name = typeof s === "string" ? s : s?._;
  if (name) return name.trim();
  const m = item.title?.match(/ - ([^-]+)$/);
  return m ? m[1].trim() : "Google News";
}

/** Turn a parsed feed into our item shape (exported for tests). */
export function itemsFromFeed(feed: { items: GItem[] }, src: SourceDef): { items: RawItem[]; trends: { term: string; traffic?: string }[] } {
  if (src.kind === "trends") {
    return { items: [], trends: feed.items.filter((i) => i.title).map((i) => ({ term: i.title!.trim(), traffic: i.approxTraffic })) };
  }
  const items: RawItem[] = feed.items
    .filter((i) => i.title && i.link)
    .slice(0, 40)
    .map((i) => {
      const outlet = outletOf(i, src);
      return {
        sourceId: src.id,
        outlet,
        url: i.link!,
        title: cleanTitle(i.title!, outlet),
        snippet: (i.contentSnippet ?? "").replace(/\s+/g, " ").slice(0, 400),
        category: src.category,
        publishedAt: i.isoDate ? new Date(i.isoDate) : i.pubDate ? new Date(i.pubDate) : null,
      };
    });
  return { items, trends: [] };
}

export const parseFeedString = (xml: string) => parser.parseString(xml);

/** Ad-hoc Google News search, used by research tasks. */
export async function searchGoogleNews(query: string, days = 2): Promise<RawItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=id&gl=ID&ceid=ID:id`;
  return itemsFromFeed(await parser.parseURL(url), { id: "gn-research", outlet: "Google News", url, kind: "google_news" }).items;
}

async function fetchSource(src: SourceDef) {
  return itemsFromFeed(await parser.parseURL(src.url), src);
}

/** Pull every feed, store new articles, group them into stories, re-rank. */
export async function collect() {
  const supa = db();

  // keep the sources table in sync with config
  await supa.from("sources").upsert(
    SOURCES.map((s) => ({ id: s.id, outlet: s.outlet, url: s.url, kind: s.kind, category: s.category ?? null })),
    { onConflict: "id", ignoreDuplicates: false }
  );
  const { data: enabledRows } = await supa.from("sources").select("id").eq("enabled", true);
  const enabled = new Set((enabledRows ?? []).map((r) => r.id as string));

  const active = SOURCES.filter((s) => enabled.has(s.id));
  const results = await Promise.allSettled(active.map((s) => fetchSource(s)));

  const items: RawItem[] = [];
  const trendTerms: { term: string; traffic?: string }[] = [];
  let failed = 0;
  await Promise.all(
    results.map(async (r, idx) => {
      const s = active[idx];
      if (r.status === "fulfilled") {
        items.push(...r.value.items);
        trendTerms.push(...r.value.trends);
        await supa.from("sources").update({ last_ok_at: new Date().toISOString(), last_error: null, last_item_count: r.value.items.length + r.value.trends.length }).eq("id", s.id);
      } else {
        failed++;
        await supa.from("sources").update({ last_error: String(r.reason?.message ?? r.reason).slice(0, 300) }).eq("id", s.id);
      }
    })
  );

  // trends
  const seenAt = new Date(Math.floor(Date.now() / 3600_000) * 3600_000).toISOString(); // bucket per hour
  if (trendTerms.length) {
    await supa.from("trends").upsert(trendTerms.map((t) => ({ term: t.term, traffic: t.traffic ?? null, seen_at: seenAt })), { onConflict: "term,seen_at", ignoreDuplicates: true });
  }

  // drop stale items (> 36h) and dedupe by URL
  const cutoff = Date.now() - 36 * 3600_000;
  const fresh = [...new Map(items.filter((i) => !i.publishedAt || i.publishedAt.getTime() > cutoff).map((i) => [i.url, i])).values()];

  // which are new?
  const urls = fresh.map((i) => i.url);
  const existing = new Set<string>();
  for (let k = 0; k < urls.length; k += 200) {
    const { data } = await supa.from("articles").select("url").in("url", urls.slice(k, k + 200));
    data?.forEach((d) => existing.add(d.url as string));
  }
  const newItems = fresh.filter((i) => !existing.has(i.url));

  // load open stories from the last 48h
  const { data: storyRows } = await supa
    .from("stories")
    .select("id, headline, category, keywords, first_seen_at, last_seen_at, status")
    .gte("last_seen_at", new Date(Date.now() - 48 * 3600_000).toISOString());
  type S = { id: string; headline: string; category: string; keywords: string[]; first_seen_at: string; last_seen_at: string; status: string };
  const stories: S[] = (storyRows ?? []).map((s) => ({ ...(s as S), keywords: s.keywords as string[] }));

  // ── 1. cluster in memory (no DB round trips per article) ──
  const nowIso = new Date().toISOString();
  const touched = new Set<string>();
  const created: S[] = [];
  const articleRows: Record<string, unknown>[] = [];
  for (const it of newItems) {
    const titleKw = keywords(it.title);
    const category = guessCategory(`${it.title} ${it.snippet}`, it.category);
    let story = stories.find((st) => isSameStory(titleKw, st.keywords));
    if (!story) {
      story = { id: randomUUID(), headline: it.title, category, keywords: titleKw, first_seen_at: nowIso, last_seen_at: nowIso, status: "developing" };
      stories.push(story);
      created.push(story);
    } else {
      // widen the story's vocabulary a little so later headlines still match
      story.keywords = [...new Set([...story.keywords, ...titleKw])].slice(0, 40);
    }
    touched.add(story.id);
    articleRows.push({
      source_id: it.sourceId,
      outlet: it.outlet,
      url: it.url,
      title: it.title,
      snippet: it.snippet,
      category,
      published_at: it.publishedAt?.toISOString() ?? null,
      story_id: story.id,
    });
  }

  // ── 2. write in bulk: new stories, then their articles ──
  for (let k = 0; k < created.length; k += 500) {
    const { error } = await supa.from("stories").insert(
      created.slice(k, k + 500).map((st) => ({ id: st.id, headline: st.headline, category: st.category, keywords: st.keywords, first_seen_at: st.first_seen_at, last_seen_at: st.last_seen_at }))
    );
    if (error) throw new Error(`insert stories: ${error.message}`);
  }
  for (let k = 0; k < articleRows.length; k += 500) {
    // ignoreDuplicates: an overlapping run may have stored the same URL a moment ago
    const { error } = await supa.from("articles").upsert(articleRows.slice(k, k + 500), { onConflict: "url", ignoreDuplicates: true });
    if (error) throw new Error(`insert articles: ${error.message}`);
  }

  // ── 3. re-rank touched stories + open ones active in the last 6h (so heat decays) ──
  const { data: recentTrends } = await supa.from("trends").select("term").gte("seen_at", new Date(Date.now() - 12 * 3600_000).toISOString());
  const terms = [...new Set((recentTrends ?? []).map((t) => t.term as string))];
  const sixH = Date.now() - 6 * 3600_000;
  const toRank = stories
    .filter((st) => touched.has(st.id) || (["developing", "confirmed"].includes(st.status) && new Date(st.last_seen_at).getTime() > sixH))
    .slice(0, 600);

  const byStory = new Map<string, { outlet: string; published_at: string | null; fetched_at: string }[]>();
  for (let k = 0; k < toRank.length; k += 150) {
    const ids = toRank.slice(k, k + 150).map((st) => st.id);
    const { data } = await supa.from("articles").select("story_id, outlet, published_at, fetched_at").in("story_id", ids);
    (data ?? []).forEach((a) => {
      const list = byStory.get(a.story_id as string) ?? [];
      list.push(a as { outlet: string; published_at: string | null; fetched_at: string });
      byStory.set(a.story_id as string, list);
    });
  }

  const updates: Record<string, unknown>[] = [];
  const orphans: string[] = [];
  for (const st of toRank) {
    const arts = byStory.get(st.id);
    if (!arts?.length) {
      if (created.includes(st)) orphans.push(st.id); // its only article was taken by an overlapping run
      continue;
    }
    const outlets = new Set(arts.map((a) => canonicalOutlet(a.outlet)).filter((o) => !o.startsWith("google")));
    const recent = arts.filter((a) => Date.now() - new Date(a.published_at ?? a.fetched_at).getTime() < 2 * 3600_000).length;
    const trendHits = terms.filter((t) => matchesTrend(st.keywords, t)).length;
    const ageHours = (Date.now() - new Date(st.first_seen_at).getTime()) / 3600_000;
    updates.push({
      id: st.id,
      headline: st.headline,
      category: st.category,
      keywords: st.keywords,
      first_seen_at: st.first_seen_at,
      last_seen_at: touched.has(st.id) ? nowIso : st.last_seen_at,
      status: st.status === "developing" && outlets.size >= 2 ? "confirmed" : st.status,
      outlet_count: outlets.size,
      article_count: arts.length,
      trend_score: trendHits,
      heat: heat({ outletCount: outlets.size, articleCount: arts.length, recentArticles: recent, trendHits, ageHours }),
    });
  }
  for (let k = 0; k < updates.length; k += 500) {
    const { error } = await supa.from("stories").upsert(updates.slice(k, k + 500), { onConflict: "id" });
    if (error) throw new Error(`update stories: ${error.message}`);
  }
  if (orphans.length) await supa.from("stories").delete().in("id", orphans);

  return {
    summary: `${results.length - failed}/${results.length} feeds ok, ${newItems.length} new articles, ${touched.size} stories updated, ${trendTerms.length} trend terms`,
  };
}
