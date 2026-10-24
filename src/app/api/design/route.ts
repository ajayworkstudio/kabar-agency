import { NextResponse } from "next/server";
import { createTask } from "@/lib/agents";
import { isLoggedIn } from "@/lib/auth";
import { db, uploadMedia } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { DesignInput } from "@/lib/design";
import { env } from "@/lib/env";
import { notifyDraft } from "@/lib/telegram";
import type { DraftContent } from "@/lib/types";
import { renderCarousel } from "@/pipeline/cards";

export const maxDuration = 120;

const plain = (s: string) => s.replace(/\*/g, "");

/**
 * The design bot turns the admin's text into a two-colour design package and files it
 * in the Inbox as a normal draft, so approval, scheduling and publishing all work as usual.
 */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — desain bisa dipratinjau & diunduh, tapi tidak disimpan" }, { status: 403 });
  const parsed = DesignInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  const d = parsed.data;
  const supa = db();

  const hashtags = d.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, ""));
  const caption = d.caption || [plain(d.slides[0].title), ...d.slides.slice(1).map((s) => `• ${plain(s.title)}`)].join("\n");
  const content: DraftContent = {
    category: d.category,
    hook: plain(d.slides[0].title),
    summary: d.title,
    keyFacts: [],
    carousel: d.slides,
    instagramCaption: caption,
    threadsPost: caption.slice(0, 480),
    threadsFollowUps: [],
    video: {
      title: plain(d.slides[0].title).slice(0, 90),
      description: caption.slice(0, 1000),
      scenes: d.slides.slice(0, 8).map((s) => ({ onScreen: plain(s.title), voiceover: plain(`${s.title}. ${s.body ?? ""}`).trim(), seconds: 3.5 })),
    },
    tiktokCaption: `${plain(d.slides[0].title)} ${hashtags.slice(0, 5).join(" ")}`.trim(),
    hashtags,
    sourceCredit: d.sourceCredit,
    sensitivity: d.category === "politik" ? "high" : "low",
    design: { palette: d.palette, format: d.format },
  };

  const { data: draft, error } = await supa
    .from("drafts")
    .insert({ story_id: null, agent_id: d.agent_id, targets: d.targets, hook: content.hook, content, fact_check: null, status: "pending" })
    .select("id")
    .single();
  if (error || !draft) return NextResponse.json({ error: error?.message ?? "gagal menyimpan" }, { status: 500 });

  const pngs = await renderCarousel(
    d.slides,
    { category: d.category, brandName: env.brandName, brandHandle: env.brandHandle, sourceCredit: d.sourceCredit, palette: d.palette },
    d.format
  );
  const urls = await Promise.all(pngs.map((p, i) => uploadMedia(`drafts/${draft.id}/card-${i + 1}.png`, p, "image/png")));
  await supa.from("drafts").update({ card_urls: urls }).eq("id", draft.id);

  await createTask({
    agent_id: d.agent_id,
    kind: "design",
    title: d.title,
    description: `${d.slides.length} slide · ${d.format} · ${d.palette.bg} / ${d.palette.fg}`,
    status: "in_review",
    priority: 3,
    draft_id: draft.id,
    created_by: "admin",
    payload: { slides: d.slides.length, format: d.format, palette: d.palette },
  });

  const msgId = await notifyDraft({
    id: draft.id, coverUrl: urls[0], category: d.category, hook: content.hook, summary: `Desain ${d.slides.length} slide dari Studio`,
    sourceCredit: d.sourceCredit || "-", outletCount: 0, factVerdict: "warn", issues: ["Konten manual — pastikan faktanya sudah kamu cek"], sensitivity: content.sensitivity,
  }).catch(() => null);
  if (msgId) await supa.from("drafts").update({ telegram_message_id: msgId }).eq("id", draft.id);

  return NextResponse.json({ id: draft.id, card_urls: urls });
}
