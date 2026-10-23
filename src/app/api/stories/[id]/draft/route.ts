import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { isDemo } from "@/lib/demo";
import { logRun } from "@/lib/db";
import { generate } from "@/pipeline/generate";

export const maxDuration = 180;

/** Owner asks for a draft of a specific story right now (bypasses the source threshold — owner's call). */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — aksi dinonaktifkan", summary: "mode demo" }, { status: 403 });
  const { id } = await params;
  const out = await logRun("generate:manual", () => generate({ storyId: id }));
  return NextResponse.json(out, { status: out.ok ? 200 : 500 });
}
