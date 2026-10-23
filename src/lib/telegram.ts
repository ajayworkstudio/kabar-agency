import { actionSig } from "./auth";
import { env } from "./env";

const api = (method: string) => `https://api.telegram.org/bot${env.telegramToken}/${method}`;

async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T | null> {
  if (!env.telegramToken || !env.telegramChatId) return null;
  const res = await fetch(api(method), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = (await res.json()) as { ok: boolean; result: T; description?: string };
  if (!j.ok) console.error(`telegram ${method}: ${j.description}`);
  return j.ok ? j.result : null;
}

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function keyboard(draftId: string) {
  const b = (text: string, action: string) => ({ text, callback_data: `${action}:${draftId}:${actionSig(action, draftId)}` });
  return {
    inline_keyboard: [
      [b("✅ Post sekarang", "now"), b("🕒 Slot berikutnya", "slot")],
      [b("❌ Tolak", "rej"), { text: "✏️ Buka dashboard", url: `${env.appUrl}/?draft=${draftId}` }],
    ],
  };
}

export async function notifyDraft(d: {
  id: string;
  coverUrl?: string;
  category: string;
  hook: string;
  summary: string;
  sourceCredit: string;
  outletCount: number;
  factVerdict: string;
  issues: string[];
  sensitivity: string;
}): Promise<number | null> {
  const flag = d.factVerdict === "pass" ? "🟢 lolos cek fakta" : d.factVerdict === "warn" ? "🟡 ada catatan" : "🔴 GAGAL cek fakta";
  const caption = [
    `<b>${esc(d.hook)}</b>`,
    ``,
    esc(d.summary),
    ``,
    `📂 ${d.category.toUpperCase()} · ${d.outletCount} outlet · sensitivitas ${d.sensitivity}`,
    `🔎 ${flag}`,
    ...d.issues.slice(0, 3).map((i) => `  • ${esc(i)}`),
    `📰 ${esc(d.sourceCredit)}`,
  ].join("\n").slice(0, 1020);

  const msg = d.coverUrl
    ? await tg<{ message_id: number }>("sendPhoto", { chat_id: env.telegramChatId, photo: d.coverUrl, caption, parse_mode: "HTML", reply_markup: keyboard(d.id) })
    : await tg<{ message_id: number }>("sendMessage", { chat_id: env.telegramChatId, text: caption, parse_mode: "HTML", reply_markup: keyboard(d.id) });
  return msg?.message_id ?? null;
}

export async function answerCallback(id: string, text: string) {
  await tg("answerCallbackQuery", { callback_query_id: id, text });
}

export async function markMessage(messageId: number, status: string) {
  await tg("editMessageReplyMarkup", {
    chat_id: env.telegramChatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [[{ text: status, url: `${env.appUrl}/` }]] },
  });
}

export async function sendText(text: string) {
  await tg("sendMessage", { chat_id: env.telegramChatId, text, parse_mode: "HTML", disable_web_page_preview: true });
}
