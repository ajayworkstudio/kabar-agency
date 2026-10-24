import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isLoggedIn } from "@/lib/auth";
import { uploadMedia } from "@/lib/db";
import { isDemo } from "@/lib/demo";

export const maxDuration = 30;

// the browser already resized + re-encoded the photo to JPEG, so this stays well under Vercel's body limit
const Body = z.object({ dataUrl: z.string().max(4_000_000).regex(/^data:image\/(jpeg|png);base64,/) });

/** Studio: store a slide photo in the public media bucket and return its URL. */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — gambar tidak disimpan" }, { status: 403 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Gambar tidak valid (JPEG/PNG)" }, { status: 400 });
  const [head, b64] = parsed.data.dataUrl.split(",");
  const type = head.includes("png") ? "image/png" : "image/jpeg";
  const d = new Date();
  const path = `studio/${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.${type === "image/png" ? "png" : "jpg"}`;
  try {
    const url = await uploadMedia(path, new Uint8Array(Buffer.from(b64, "base64")), type);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "upload gagal" }, { status: 500 });
  }
}
