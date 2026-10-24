import { NextResponse } from "next/server";
import { withDefaults, type Agent } from "@/lib/agents";
import { isLoggedIn } from "@/lib/auth";
import { buildCharts } from "@/lib/charts";
import { db } from "@/lib/db";
import { demoWorkspace, isDemo } from "@/lib/demo";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Everything the admin app shows, in one round trip. */
export async function GET() {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json(demoWorkspace());

  const supa = db();
  const d14 = new Date(Date.now() - 14 * 86400_000).toISOString();
  const h36 = new Date(Date.now() - 36 * 3600_000).toISOString();
  const [agents, tasks, reports, drafts, recentDrafts, stories, posts, sources, runs, trends] = await Promise.all([
    supa.from("agents").select("*").order("created_at"),
    supa.from("tasks").select("*").order("created_at", { ascending: false }).limit(250),
    supa.from("reports").select("*").order("day", { ascending: false }).limit(30),
    supa.from("drafts").select("*, stories(headline, outlet_count, heat)").in("status", ["pending", "ready", "rendering", "scheduled", "publishing", "failed"]).order("created_at", { ascending: false }).limit(50),
    supa.from("drafts").select("created_at, status, agent_id").gte("created_at", d14),
    supa.from("stories").select("id, headline, category, outlet_count, article_count, heat, trend_score, status, first_seen_at, last_seen_at").gte("last_seen_at", h36).order("heat", { ascending: false }).limit(80),
    supa.from("posts").select("id, draft_id, platform, format, status, permalink, error, published_at, metrics, drafts(hook, agent_id)").gte("published_at", d14).order("published_at", { ascending: false }).limit(300),
    supa.from("sources").select("*").order("outlet"),
    supa.from("runs").select("*").order("started_at", { ascending: false }).limit(40),
    supa.from("trends").select("term, traffic, seen_at").gte("seen_at", new Date(Date.now() - 6 * 3600_000).toISOString()).order("seen_at", { ascending: false }).limit(40),
  ]);

  return NextResponse.json({
    demo: false,
    brand: { name: env.brandName, handle: env.brandHandle },
    config: {
      postSlots: env.postSlots,
      publishMode: env.publishMode,
      contentLang: env.contentLang,
      platforms: {
        instagram: !!env.igUserId,
        threads: !!env.threadsUserId,
        tiktok: !!env.tiktokClientKey,
        tiktokAudited: env.tiktokAudited,
        youtube: !!env.ytClientId,
        telegram: !!env.telegramToken,
        videoWorker: !!env.githubDispatchToken,
        voiceover: !!env.googleTtsKey,
        ai: !!env.anthropicKey,
      },
    },
    agents: ((agents.data ?? []) as Agent[]).map(withDefaults),
    tasks: tasks.data ?? [],
    reports: reports.data ?? [],
    drafts: drafts.data ?? [],
    stories: stories.data ?? [],
    posts: posts.data ?? [],
    sources: sources.data ?? [],
    runs: runs.data ?? [],
    trends: [...new Map((trends.data ?? []).map((t) => [t.term, t])).values()],
    charts: buildCharts(posts.data ?? [], recentDrafts.data ?? [], stories.data ?? [], tasks.data ?? []),
  });
}
