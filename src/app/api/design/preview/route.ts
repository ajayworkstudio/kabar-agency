import { isLoggedIn } from "@/lib/auth";
import { PreviewInput } from "@/lib/design";
import { env } from "@/lib/env";
import { renderCard } from "@/pipeline/cards";

export const maxDuration = 30;

/** Render one slide to PNG for the studio's live preview (works in demo mode too — nothing is stored). */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) return new Response("unauthorized", { status: 401 });
  const parsed = PreviewInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  const p = parsed.data;
  const png = await renderCard(p.slide, {
    category: "umum",
    brandName: env.brandName,
    brandHandle: env.brandHandle,
    sourceCredit: p.sourceCredit ?? "",
    index: p.index,
    total: p.total,
    format: p.format,
    palette: p.palette,
  });
  return new Response(png as unknown as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}
