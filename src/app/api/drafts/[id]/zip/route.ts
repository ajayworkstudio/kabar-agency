import { strToU8, zipSync } from "fflate";
import { isLoggedIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import type { DraftContent } from "@/lib/types";
import { captionKit } from "@/lib/captions";

export const maxDuration = 60;

/** Everything needed to post manually: slide PNGs + captions.txt, in one zip. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) return new Response("unauthorized", { status: 401 });
  if (isDemo()) return new Response("mode demo — unduh tiap slide dari pratinjau", { status: 403 });
  const { id } = await params;
  const { data: d } = await db().from("drafts").select("id, hook, content, card_urls").eq("id", id).single();
  if (!d) return new Response("not found", { status: 404 });

  const files: Record<string, Uint8Array> = {};
  const urls = (d.card_urls as string[]) ?? [];
  const imgs = await Promise.all(urls.map(async (u) => new Uint8Array(await (await fetch(u)).arrayBuffer())));
  imgs.forEach((b, i) => (files[`slide-${String(i + 1).padStart(2, "0")}.png`] = b));

  const kit = captionKit(d.content as DraftContent);
  files["captions.txt"] = strToU8(kit.map((k) => `===== ${k.label} =====\n${k.text}\n`).join("\n"));

  const zip = zipSync(files, { level: 0 }); // PNGs are already compressed
  const slug = String(d.hook).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "post";
  return new Response(zip as unknown as BodyInit, {
    headers: { "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${slug}.zip"`, "Cache-Control": "no-store" },
  });
}
