import { db, uploadMedia } from "@/lib/db";
import { env } from "@/lib/env";
import { notifyDraft } from "@/lib/telegram";
import type { DraftContent } from "@/lib/types";
import { renderCarousel } from "./cards";
import { canonicalOutlet } from "./cluster";
import { extractArticle } from "./extract";
import { factCheck, writeDraft, type SourceDoc } from "./writer";

type StoryRow = { id: string; headline: string; category: string; outlet_count: number; heat: number; trend_score: number };

/** Turn the hottest confirmed stories into draft packages waiting for approval. */
export async function generate(opts: { storyId?: string } = {}) {
  const supa = db();

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
      .limit(25);
    candidates = ((data ?? []) as StoryRow[]).filter((s) => s.outlet_count >= (s.category === "politik" ? env.minSourcesPolitics : env.minSources));
  }

  const made: string[] = [];
  const errors: string[] = [];
  for (const s of candidates.slice(0, env.maxDraftsPerRun)) {
    // claim the story so a parallel run can't draft it twice
    const { data: claimed } = await supa.from("stories").update({ status: "drafted" }).eq("id", s.id).in("status", ["confirmed", "developing"]).select("id");
    if (!claimed?.length && !opts.storyId) continue;

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

      const content: DraftContent = await writeDraft(docs, { category: s.category, trending: s.trend_score > 0 });
      const check = await factCheck(docs, content);

      const { data: draft, error } = await supa
        .from("drafts")
        .insert({ story_id: s.id, hook: content.hook, content, fact_check: check, status: "pending" })
        .select("id")
        .single();
      if (error || !draft) throw new Error(error?.message ?? "insert draft failed");

      const pngs = await renderCarousel(content.carousel, { category: content.category, brandName: env.brandName, brandHandle: env.brandHandle, sourceCredit: content.sourceCredit });
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
      made.push(content.hook);
    } catch (e) {
      await supa.from("stories").update({ status: "confirmed" }).eq("id", s.id); // release for a retry next run
      errors.push(`${s.headline.slice(0, 50)}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  if (!made.length && errors.length) throw new Error(errors.join(" | "));
  const summary = made.length ? `${made.length} draft(s): ${made.map((h) => `“${h}”`).join("; ")}` : "no new stories above threshold";
  return { summary: errors.length ? `${summary} — ${errors.length} failed: ${errors.join(" | ")}` : summary };
}
