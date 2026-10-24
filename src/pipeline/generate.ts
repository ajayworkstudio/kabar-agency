import { genzScore } from "@/config/genz";
import { activeAgents, covers, createTask, wibDayStart, type Agent } from "@/lib/agents";
import { db, uploadMedia } from "@/lib/db";
import { env } from "@/lib/env";
import { notifyDraft } from "@/lib/telegram";
import type { DraftContent } from "@/lib/types";
import { renderCarousel } from "./cards";
import { PALETTES } from "./twotone";

const DEFAULT_PALETTE = { bg: PALETTES[0].bg, fg: PALETTES[0].fg };
import { canonicalOutlet } from "./cluster";
import { extractArticle } from "./extract";
import { factCheck, writeDraft, type SourceDoc } from "./writer";

type StoryRow = { id: string; headline: string; category: string; outlet_count: number; heat: number; trend_score: number };

/**
 * Turn the hottest confirmed stories into draft packages waiting for approval.
 * Each draft is handled by the bot employee whose categories cover the story,
 * using that bot's thresholds, platforms and daily quota.
 */
export async function generate(opts: { storyId?: string; agentId?: string } = {}) {
  const supa = db();
  const agents = await activeAgents();
  if (!agents.length) return { summary: "no active bot employees" };

  // drafts each agent already made today (quota)
  const { data: todays } = await supa.from("drafts").select("agent_id").gte("created_at", wibDayStart());
  const used = new Map<string, number>();
  (todays ?? []).forEach((d) => d.agent_id && used.set(d.agent_id as string, (used.get(d.agent_id as string) ?? 0) + 1));

  const pick = (s: StoryRow, force: boolean): Agent | undefined =>
    agents.find(
      (a) =>
        (!opts.agentId || a.id === opts.agentId) &&
        covers(a, s.category) &&
        (force || ((used.get(a.id) ?? 0) < a.settings.maxDraftsPerDay &&
          s.outlet_count >= (s.category === "politik" ? a.settings.minSourcesPolitics : a.settings.minSources)))
    );

  let candidates: StoryRow[];
  if (opts.storyId) {
    const { data } = await supa.from("stories").select("id, headline, category, outlet_count, heat, trend_score").eq("id", opts.storyId);
    candidates = (data ?? []) as StoryRow[];
  } else {
    const { data } = await supa
      .from("stories")
      .select("id, headline, category, outlet_count, heat, trend_score")
      .eq("status", "confirmed")
      .gte("last_seen_at", new Date(Date.now() - 12 * 3600_000).toISOString())
      .order("heat", { ascending: false })
      .limit(60);
    candidates = (data ?? []) as StoryRow[];
    // Gen Z-focused writers: lift stories young, digitally-native readers care about
    if (agents.some((a) => a.settings.focus === "genz")) {
      const score = (s: StoryRow) => s.heat * (1 + 0.6 * Math.min(2, genzScore(s.headline)));
      candidates.sort((a, b) => score(b) - score(a));
    }
  }
  const work = candidates
    .map((s) => ({ s, agent: pick(s, !!opts.storyId) ?? (opts.storyId ? agents[0] : undefined) }))
    .filter((x): x is { s: StoryRow; agent: Agent } => !!x.agent)
    .slice(0, env.maxDraftsPerRun);

  const made: string[] = [];
  const errors: string[] = [];
  const t0 = Date.now();
  for (const { s, agent } of work) {
    // each draft takes ~20–40s (two AI calls + rendering); stop early rather than hit the platform timeout
    if (Date.now() - t0 > 45_000 && made.length) break;
    // claim the story so a parallel run can't draft it twice
    const { data: claimed } = await supa.from("stories").update({ status: "drafted" }).eq("id", s.id).in("status", ["confirmed", "developing"]).select("id");
    if (!claimed?.length && !opts.storyId) continue;
    used.set(agent.id, (used.get(agent.id) ?? 0) + 1);

    try {
      const { data: arts } = await supa
        .from("articles")
        .select("outlet, title, url, snippet, body_excerpt, published_at")
        .eq("story_id", s.id)
        .order("published_at", { ascending: false })
        .limit(12);
      if (!arts?.length) throw new Error("no articles");

      // one article per outlet, fetch body text for up to 5
      const perOutlet = [...new Map(arts.map((a) => [canonicalOutlet(a.outlet as string), a])).values()].slice(0, 6);
      const docs: SourceDoc[] = [];
      for (const [i, a] of perOutlet.entries()) {
        let text = (a.body_excerpt as string | null) ?? null;
        if (!text && i < 5) {
          text = await extractArticle(a.url as string);
          if (text) await supa.from("articles").update({ body_excerpt: text }).eq("url", a.url);
        }
        docs.push({ outlet: a.outlet as string, title: a.title as string, url: a.url as string, publishedAt: a.published_at as string | null, text: text ?? (a.snippet as string) ?? "" });
      }

      const content: DraftContent = await writeDraft(docs, { category: s.category, trending: s.trend_score > 0, audience: agent.settings.focus ?? "general" });

      // Hand-off: the first active designer lays the draft out in her two-colour style
      const designer = (await activeAgents("designer"))[0];
      if (designer) content.design = { palette: designer.settings.palette ?? DEFAULT_PALETTE, format: designer.settings.format ?? "post" };
      const check = await factCheck(docs, content);

      const { data: draft, error } = await supa
        .from("drafts")
        .insert({ story_id: s.id, agent_id: agent.id, targets: agent.platforms, hook: content.hook, content, fact_check: check, status: "pending" })
        .select("id")
        .single();
      if (error || !draft) throw new Error(error?.message ?? "insert draft failed");

      const pngs = await renderCarousel(
        content.carousel,
        { category: content.category, brandName: env.brandName, brandHandle: env.brandHandle, sourceCredit: content.sourceCredit, palette: content.design?.palette ?? null },
        content.design?.format ?? "post"
      );
      const urls = await Promise.all(pngs.map((p, i) => uploadMedia(`drafts/${draft.id}/card-${i + 1}.png`, p, "image/png")));
      await supa.from("drafts").update({ card_urls: urls }).eq("id", draft.id);

      const msgId = await notifyDraft({
        id: draft.id,
        coverUrl: urls[0],
        category: content.category,
        hook: content.hook,
        summary: content.summary,
        sourceCredit: content.sourceCredit,
        outletCount: s.outlet_count,
        factVerdict: check.verdict,
        issues: check.issues.map((i) => `${i.text.slice(0, 60)} — ${i.problem}`),
        sensitivity: content.sensitivity,
      });
      if (msgId) await supa.from("drafts").update({ telegram_message_id: msgId }).eq("id", draft.id);

      // the draft becomes a task "in review" for the admin
      await createTask({
        agent_id: agent.id,
        kind: "draft",
        title: content.hook,
        description: content.summary,
        status: "in_review",
        priority: content.sensitivity === "high" ? 2 : s.trend_score > 0 ? 2 : 3,
        draft_id: draft.id,
        payload: { storyId: s.id, outlets: s.outlet_count, category: content.category, factCheck: check.verdict },
      });
      if (designer) {
        await createTask({
          agent_id: designer.id,
          kind: "design",
          title: `Desain: ${content.hook}`,
          description: `${pngs.length} slide untuk draft ${agent.name} · ${content.design!.palette.bg} / ${content.design!.palette.fg}`,
          status: "done",
          priority: 4,
          payload: { draftId: draft.id, fromAgent: agent.slug },
        });
      }
      made.push(`${agent.name}${designer ? ` + ${designer.name}` : ""}: ${content.hook}`);
    } catch (e) {
      await supa.from("stories").update({ status: "confirmed" }).eq("id", s.id); // release for a retry next run
      errors.push(`${s.headline.slice(0, 50)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!made.length && errors.length) throw new Error(errors.join(" | "));
  const summary = made.length ? `${made.length} draft(s): ${made.map((h) => `“${h}”`).join("; ")}` : "no new stories above threshold";
  return { summary: errors.length ? `${summary} — ${errors.length} failed: ${errors.join(" | ")}` : summary };
}
