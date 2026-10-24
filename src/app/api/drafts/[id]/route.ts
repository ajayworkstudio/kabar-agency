import { NextResponse } from "next/server";
import { z } from "zod";
import { isLoggedIn } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { db, uploadMedia } from "@/lib/db";
import { env } from "@/lib/env";
import { markMessage } from "@/lib/telegram";
import type { DraftContent } from "@/lib/types";
import { ALL_TARGETS, approveDraft, markPosted, rejectDraft } from "@/pipeline/approve";
import { renderCarousel } from "@/pipeline/cards";
import { formatWIB } from "@/pipeline/schedule";

export const maxDuration = 120;

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), when: z.union([z.literal("now"), z.literal("slot"), z.string().datetime()]), targets: z.array(z.enum(ALL_TARGETS)).optional() }),
  z.object({ action: z.literal("reject") }),
  z.object({ action: z.literal("retry") }),
  z.object({ action: z.literal("posted"), permalinks: z.record(z.string(), z.string().url()).optional() }),
  z.object({ action: z.literal("edit"), content: z.record(z.string(), z.unknown()) }),
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — aksi dinonaktifkan", summary: "mode demo" }, { status: 403 });
  const { id } = await params;
  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  const a = parsed.data;
  const supa = db();
  const { data: d } = await supa.from("drafts").select("id, content, telegram_message_id, status").eq("id", id).single();
  if (!d) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (a.action === "approve") {
    const out = await approveDraft(id, a.when === "now" || a.when === "slot" ? a.when : new Date(a.when), a.targets);
    if (d.telegram_message_id) {
      await markMessage(d.telegram_message_id, out.status === "ready" ? "✅ Disetujui — siap diposting manual" : !out.scheduledFor ? "✅ Disetujui" : a.when === "now" ? "🚀 Diposting sekarang" : `🕒 ${formatWIB(out.scheduledFor)}`);
    }
    return NextResponse.json(out);
  }
  if (a.action === "posted") {
    await markPosted(id, a.permalinks ?? {});
    if (d.telegram_message_id) await markMessage(d.telegram_message_id, "✅ Sudah diposting");
    return NextResponse.json({ status: "published" });
  }
  if (a.action === "reject") {
    await rejectDraft(id);
    if (d.telegram_message_id) await markMessage(d.telegram_message_id, "❌ Ditolak");
    return NextResponse.json({ status: "rejected" });
  }
  if (a.action === "retry") {
    // failed targets only — posts already published are skipped by the publisher
    const { data: dd } = await supa.from("drafts").select("video_url, targets").eq("id", id).single();
    const needsVideo = (dd?.targets as string[]).some((t) => ["instagram:reel", "tiktok:video", "youtube:short"].includes(t)) && !dd?.video_url;
    await supa.from("drafts").update({ status: needsVideo ? "rendering" : "scheduled", scheduled_for: new Date().toISOString(), error: null }).eq("id", id).eq("status", "failed");
    return NextResponse.json({ status: needsVideo ? "rendering" : "scheduled" });
  }

  // edit: merge fields, re-render cards if slides changed
  if (!["pending", "failed", "ready"].includes(d.status as string)) return NextResponse.json({ error: "only pending/ready drafts can be edited" }, { status: 409 });
  const merged = { ...(d.content as DraftContent), ...(a.content as Partial<DraftContent>) } as DraftContent;
  const update: Record<string, unknown> = { content: merged, hook: merged.hook, updated_at: new Date().toISOString() };
  if (a.content.carousel || a.content.sourceCredit || a.content.category) {
    const pngs = await renderCarousel(
      merged.carousel,
      { category: merged.category, brandName: env.brandName, brandHandle: env.brandHandle, sourceCredit: merged.sourceCredit, palette: merged.design?.palette ?? null },
      merged.design?.format === "square" ? "square" : "post"
    );
    const v = Date.now();
    update.card_urls = await Promise.all(pngs.map((p, i) => uploadMedia(`drafts/${id}/card-${i + 1}-${v}.png`, p, "image/png")));
  }
  if (a.content.video) update.video_url = null; // script changed → re-render on approval
  await supa.from("drafts").update(update).eq("id", id);
  return NextResponse.json({ ok: true, card_urls: update.card_urls });
}
