import { NextResponse } from "next/server";
import { actionSig, safeEqual } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { answerCallback, markMessage } from "@/lib/telegram";
import { approveDraft, rejectDraft } from "@/pipeline/approve";
import { formatWIB } from "@/pipeline/schedule";

/**
 * Telegram webhook for the one-tap buttons.
 * Register once:  https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!env.telegramWebhookSecret || !safeEqual(secret, env.telegramWebhookSecret)) return NextResponse.json({ ok: false }, { status: 401 });

  const update = (await req.json()) as {
    callback_query?: { id: string; data?: string; from: { id: number }; message?: { message_id: number; chat: { id: number } } };
  };
  const cq = update.callback_query;
  if (!cq?.data) return NextResponse.json({ ok: true });

  // only the owner's chat may act, and the button must carry a valid signature
  if (String(cq.message?.chat.id) !== env.telegramChatId) {
    await answerCallback(cq.id, "Tidak diizinkan");
    return NextResponse.json({ ok: true });
  }
  const [action, draftId, sig] = cq.data.split(":");
  if (!draftId || !sig || !safeEqual(sig, actionSig(action, draftId))) {
    await answerCallback(cq.id, "Tombol tidak valid");
    return NextResponse.json({ ok: true });
  }

  try {
    if (action === "rej") {
      await rejectDraft(draftId);
      await answerCallback(cq.id, "Ditolak");
      if (cq.message) await markMessage(cq.message.message_id, "❌ Ditolak");
    } else if (action === "now" || action === "slot") {
      const out = await approveDraft(draftId, action);
      const label =
        out.status === "ready" ? "✅ Siap diposting — unduh di dashboard" : action === "now" ? "🚀 Diposting sekarang" : `🕒 ${out.scheduledFor ? formatWIB(out.scheduledFor) : out.status}`;
      await answerCallback(cq.id, out.status === "ready" ? "Disetujui — buka dashboard untuk unduh & salin caption" : out.status === "rendering" ? "Disetujui — video sedang dirender" : "Disetujui");
      if (cq.message) await markMessage(cq.message.message_id, label);
      await db().from("drafts").update({ telegram_message_id: cq.message?.message_id ?? null }).eq("id", draftId);
    }
  } catch (e) {
    await answerCallback(cq.id, `Error: ${e instanceof Error ? e.message.slice(0, 150) : "unknown"}`);
  }
  return NextResponse.json({ ok: true });
}
