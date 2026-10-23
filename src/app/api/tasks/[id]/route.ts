import { NextResponse } from "next/server";
import { z } from "zod";
import { isLoggedIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/demo";

const Patch = z.object({
  status: z.enum(["backlog", "todo", "in_progress", "in_review", "done", "failed", "canceled"]).optional(),
  agent_id: z.string().uuid().nullable().optional(),
  priority: z.number().int().min(0).max(4).optional(),
  title: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — aksi dinonaktifkan" }, { status: 403 });
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });

  const { data: task } = await db().from("tasks").select("kind, draft_id").eq("id", id).single();
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });
  // draft tasks follow their draft — change those through the approval inbox instead
  if (task.kind === "draft" && parsed.data.status) return NextResponse.json({ error: "Status task draft mengikuti persetujuan di Inbox" }, { status: 409 });

  const patch: Record<string, unknown> = { ...parsed.data };
  const now = new Date().toISOString();
  if (parsed.data.status === "in_progress") patch.started_at = now;
  if (parsed.data.status && ["done", "failed", "canceled"].includes(parsed.data.status)) patch.finished_at = now;
  if (parsed.data.status === "todo") Object.assign(patch, { started_at: null, finished_at: null, error: null });
  const { error } = await db().from("tasks").update(patch).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
