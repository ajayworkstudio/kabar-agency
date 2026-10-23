/**
 * Work the bot employees do on their own, beyond drafting:
 *  - a daily report of the latest news in their beat (at their configured WIB hour)
 *  - research tasks the admin assigns ("pantau isu X")
 */
import { activeAgents, covers, createTask, updateTask, wibDate, wibHour, type Agent } from "@/lib/agents";
import { db } from "@/lib/db";
import { sendText } from "@/lib/telegram";
import { canonicalOutlet } from "./cluster";
import { searchGoogleNews } from "./collect";
import { brief } from "./writer";

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export async function writeDailyReport(agent: Agent) {
  const supa = db();
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();

  const [stories, trends, drafts, posts] = await Promise.all([
    supa.from("stories").select("id, headline, category, outlet_count, heat, trend_score").gte("last_seen_at", since).order("heat", { ascending: false }).limit(60),
    supa.from("trends").select("term, traffic").gte("seen_at", since).order("seen_at", { ascending: false }).limit(40),
    supa.from("drafts").select("id, status, hook").eq("agent_id", agent.id).gte("created_at", since),
    supa.from("posts").select("platform, metrics, drafts!inner(agent_id)").eq("drafts.agent_id", agent.id).eq("status", "published").gte("published_at", since),
  ]);

  const mine = (stories.data ?? []).filter((s) => covers(agent, s.category as string));
  const top = mine.slice(0, 10);
  const byCat: Record<string, number> = {};
  mine.forEach((s) => (byCat[s.category as string] = (byCat[s.category as string] ?? 0) + 1));
  const trendTerms = [...new Set((trends.data ?? []).map((t) => t.term as string))].slice(0, 12);
  const d = drafts.data ?? [];
  const engagement = (posts.data ?? []).reduce(
    (a, p) => {
      const m = (p.metrics ?? {}) as Record<string, number>;
      return { views: a.views + (m.views ?? 0), likes: a.likes + (m.likes ?? 0), comments: a.comments + (m.comments ?? 0), shares: a.shares + (m.shares ?? 0) };
    },
    { views: 0, likes: 0, comments: 0, shares: 0 }
  );

  const material = top.map((s, i) => `${i + 1}. [${s.category}] ${s.headline} — ${s.outlet_count} outlet${(s.trend_score as number) > 0 ? ", trending" : ""}`).join("\n");
  const aiSummary = top.length
    ? await brief(
        "Buat briefing pagi untuk admin agensi: 1 paragraf pembuka (2 kalimat) tentang suasana berita 24 jam terakhir, lalu 5 poin berita paling layak dijadikan konten hari ini beserta alasan singkat (≤ 15 kata). Akhiri dengan 1 kalimat saran fokus konten.",
        `${material}\n\nKata kunci trending: ${trendTerms.join(", ")}`
      ).catch(() => null)
    : null;

  const summary =
    aiSummary ??
    (top.length
      ? `${mine.length} berita terpantau dalam 24 jam terakhir. Teratas: ${top.slice(0, 3).map((s) => s.headline).join("; ")}.`
      : "Belum ada berita baru yang terpantau dalam 24 jam terakhir.");

  const day = wibDate();
  const data = {
    stories: top,
    categories: byCat,
    trends: trendTerms,
    drafts: { total: d.length, published: d.filter((x) => x.status === "published").length, pending: d.filter((x) => x.status === "pending").length, rejected: d.filter((x) => x.status === "rejected").length },
    posts: (posts.data ?? []).length,
    engagement,
  };
  const title = `Laporan harian ${agent.name} — ${new Date(`${day}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}`;

  const { data: rep, error } = await supa.from("reports").upsert({ agent_id: agent.id, day, title, summary, data }, { onConflict: "agent_id,day" }).select("id").single();
  if (error) throw new Error(`report: ${error.message}`);
  await createTask({ agent_id: agent.id, kind: "report", title, status: "done", priority: 4, payload: { reportId: rep?.id } });

  await sendText(
    [`📋 <b>${esc(title)}</b>`, "", esc(summary.slice(0, 2500)), "", `Draft 24 jam: ${data.drafts.total} · terbit ${data.drafts.published} · menunggu ${data.drafts.pending}`].join("\n")
  );
  return title;
}

/** Hourly: every active agent whose report hour has passed and hasn't reported today. */
export async function dueReports(): Promise<string[]> {
  const supa = db();
  const hour = wibHour();
  const out: string[] = [];
  for (const a of await activeAgents()) {
    if (hour < a.settings.reportHour) continue;
    const { data } = await supa.from("reports").select("id").eq("agent_id", a.id).eq("day", wibDate()).limit(1);
    if (data?.length) continue;
    out.push(await writeDailyReport(a));
  }
  return out;
}

/** Research tasks: the admin gives a topic, the bot searches, summarises and hands back sources. */
export async function runResearchTasks(): Promise<string[]> {
  const supa = db();
  const { data: tasks } = await supa.from("tasks").select("id, title, payload, agent_id").eq("kind", "research").eq("status", "todo").order("created_at").limit(3);
  const out: string[] = [];
  for (const t of tasks ?? []) {
    await updateTask(t.id as string, { status: "in_progress" });
    try {
      const query = String((t.payload as { query?: string })?.query ?? t.title);
      const items = await searchGoogleNews(query, 3);
      const articles = items.slice(0, 15).map((i) => ({ outlet: i.outlet, title: i.title, url: i.url, publishedAt: i.publishedAt?.toISOString() ?? null }));
      const outlets = [...new Set(items.map((i) => canonicalOutlet(i.outlet)))];
      const summary = articles.length
        ? (await brief(
            `Topik riset: "${query}". Rangkum perkembangan terbaru dalam 3–5 poin, sebutkan outlet untuk tiap poin, tandai hal yang baru dilaporkan satu outlet. Lalu usulkan 3 angle konten untuk Instagram/TikTok.`,
            articles.map((a) => `- ${a.title} (${a.outlet}, ${a.publishedAt ?? "?"})`).join("\n")
          ).catch(() => null)) ?? `${articles.length} artikel dari ${outlets.length} outlet ditemukan.`
        : "Tidak ada artikel baru tentang topik ini dalam 3 hari terakhir.";
      await updateTask(t.id as string, { status: "in_review", result: { query, summary, articles, outlets: outlets.length } });
      out.push(query);
    } catch (e) {
      await updateTask(t.id as string, { status: "failed", error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}

export async function agentWork() {
  const reports = await dueReports();
  const research = await runResearchTasks();
  return { summary: `${reports.length} laporan harian, ${research.length} riset${research.length ? `: ${research.join(", ")}` : ""}` };
}
