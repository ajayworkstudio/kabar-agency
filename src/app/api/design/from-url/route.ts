import { NextResponse } from "next/server";
import { z } from "zod";
import { isLoggedIn } from "@/lib/auth";
import { extractArticleFull } from "@/pipeline/extract";

export const maxDuration = 30;

const Body = z.object({ url: z.string().url().refine((u) => /^https?:\/\//.test(u), "harus http(s)") });

/** Studio: paste a news link, get its title + text back to fill the slides. */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Link tidak valid" }, { status: 400 });
  const a = await extractArticleFull(parsed.data.url);
  if (!a) return NextResponse.json({ error: "Artikel tidak bisa dibaca dari link ini — salin teksnya manual" }, { status: 422 });
  return NextResponse.json(a);
}
