import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { demoData, isDemo } from "@/lib/demo";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Everything the dashboard shows, in one round trip. */
export async function GET() {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json(demoData());
  const supa = db();
  const since = new Date(Date.now() - 36 * 3600_000).toISOString();
  const [drafts, stories, posts, sources, runs, trends, tokens] = await Promise.all([
    supa.from("drafts").select("*, stories(headline, outlet_count, heat)").in("status", ["pending", "approved", "rendering", "scheduled", "publishing", "failed"]).order("created_at", { ascending: false }).limit(40),
    supa.from("stories").select("id, headline, category, outlet_count, article_count, heat, trend_score, status, first_seen_at, last_seen_at").gte("last_seen_at", since).order("heat", { ascending: false }).limit(60),
    supa.from("posts").select("*, drafts(hook, content->category)").order("published_at", { ascending: false, nullsFirst: false }).limit(60),
    supa.from("sources").select("*").order("outlet"),
    supa.from("runs").select("*").order("started_at", { ascending: false }).limit(30),
    supa.from("trends").select("term, traffic, seen_at").gte("seen_at", new Date(Date.now() - 6 * 3600_000).toISOString()).order("seen_at", { ascending: false }).limit(40),
    supa.from("platform_tokens").select("platform, expires_at, updated_at"),
  ]);
  return NextResponse.json({
    brand: { name: env.brandName, handle: env.brandHandle },
    config: {
      minSources: env.minSources,
      minSourcesPolitics: env.minSourcesPolitics,
      postSlots: env.postSlots,
      platforms: {
        instagram: !!env.igUserId,
        threads: !!env.threadsUserId,
        tiktok: !!env.tiktokClientKey,
        tiktokAudited: env.tiktokAudited,
        youtube: !!env.ytClientId,
        telegram: !!env.telegramToken,
        videoWorker: !!env.githubDispatchToken,
        voiceover: !!env.googleTtsKey,
      },
    },
    drafts: drafts.data ?? [],
    stories: stories.data ?? [],
    posts: posts.data ?? [],
    sources: sources.data ?? [],
    runs: runs.data ?? [],
    trends: [...new Map((trends.data ?? []).map((t) => [t.term, t])).values()],
    tokens: tokens.data ?? [],
  });
}
