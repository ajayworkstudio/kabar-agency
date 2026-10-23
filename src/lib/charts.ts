/** Server-side aggregation for the dashboard charts (pure — also used by demo mode). */

type PostRow = { platform: string; status: string; published_at: string | null; metrics: Record<string, number> | null };
type DraftRow = { created_at: string; status: string; agent_id?: string | null };
type StoryRow = { category: string };
type TaskRow = { agent_id: string | null; status: string; finished_at?: string | null };

export type Charts = {
  daily: { day: string; drafts: number; published: number; views: number; engagement: number }[];
  platforms: { platform: string; posts: number; views: number; engagement: number }[];
  categories: { category: string; count: number }[];
  taskStatus: Record<string, number>;
  approvalRate: number | null; // published ÷ (published + rejected), last 14 days
};

const dayKey = (iso: string) => new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString().slice(0, 10); // WIB date

export function buildCharts(posts: PostRow[], drafts: DraftRow[], stories: StoryRow[], tasks: TaskRow[], days = 14, now = new Date()): Charts {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) keys.push(dayKey(new Date(now.getTime() - i * 86400_000).toISOString()));
  const daily = new Map(keys.map((k) => [k, { day: k, drafts: 0, published: 0, views: 0, engagement: 0 }]));

  for (const d of drafts) daily.get(dayKey(d.created_at)) && daily.get(dayKey(d.created_at))!.drafts++;

  const plat = new Map<string, { platform: string; posts: number; views: number; engagement: number }>();
  for (const p of posts) {
    if (p.status !== "published" || !p.published_at) continue;
    const m = p.metrics ?? {};
    const eng = (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
    const row = daily.get(dayKey(p.published_at));
    if (row) { row.published++; row.views += m.views ?? 0; row.engagement += eng; }
    const pr = plat.get(p.platform) ?? { platform: p.platform, posts: 0, views: 0, engagement: 0 };
    pr.posts++; pr.views += m.views ?? 0; pr.engagement += eng;
    plat.set(p.platform, pr);
  }

  const cats = new Map<string, number>();
  stories.forEach((s) => cats.set(s.category, (cats.get(s.category) ?? 0) + 1));

  const taskStatus: Record<string, number> = {};
  tasks.forEach((t) => (taskStatus[t.status] = (taskStatus[t.status] ?? 0) + 1));

  const pub = drafts.filter((d) => d.status === "published").length;
  const rej = drafts.filter((d) => d.status === "rejected").length;

  return {
    daily: [...daily.values()],
    platforms: [...plat.values()].sort((a, b) => b.views - a.views),
    categories: [...cats.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count),
    taskStatus,
    approvalRate: pub + rej ? Math.round((pub / (pub + rej)) * 100) : null,
  };
}
