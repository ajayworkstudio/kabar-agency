import { NextResponse } from "next/server";
import { z } from "zod";
import { isLoggedIn } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { env } from "@/lib/env";
import { summarizeForStudio } from "@/pipeline/writer";

export const maxDuration = 60;

const Body = z.object({
  raw: z.string().min(80, "Teks terlalu pendek").max(30000),
  lang: z.enum(["en", "id"]).optional(),
  extra: z.string().max(300).optional(),
  format: z.object({
    slides: z.number().int().min(3).max(10),
    quote: z.boolean(),
    closing: z.enum(["question", "follow", "none"]),
    labels: z.enum(["numbered", "none"]),
  }),
});

/** Studio: Dita turns pasted raw news text into slides (AI). Client falls back to the local summariser on error. */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — AI dinonaktifkan" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  const b = parsed.data;
  try {
    return NextResponse.json(await summarizeForStudio(b.raw, b.format, b.lang ?? env.contentLang, b.extra ?? ""));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const credit = /credit balance/i.test(msg);
    return NextResponse.json({ error: credit ? "Saldo Anthropic habis" : msg.slice(0, 200), noCredit: credit }, { status: credit ? 402 : 500 });
  }
}
