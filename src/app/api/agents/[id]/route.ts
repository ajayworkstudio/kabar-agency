import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS, withDefaults, type Agent } from "@/lib/agents";
import { isLoggedIn } from "@/lib/auth";
import { db, logRun } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { writeDailyReport } from "@/pipeline/agentwork";
import { generate } from "@/pipeline/generate";
import { AgentInput } from "@/lib/schemas";

export const maxDuration = 180;

async function load(id: string): Promise<Agent | null> {
  const { data } = await db().from("agents").select("*").eq("id", id).maybeSingle();
  return data ? withDefaults(data as Agent) : null;
}

/** Update an employee's profile, responsibilities or settings. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — aksi dinonaktifkan" }, { status: 403 });
  const { id } = await params;
  const current = await load(id);
  if (!current) return NextResponse.json({ error: "not found" }, { status: 404 });
  const parsed = AgentInput.partial().safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  const patch: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.settings) patch.settings = { ...DEFAULT_SETTINGS, ...current.settings, ...parsed.data.settings };
  const { data, error } = await db().from("agents").update(patch).eq("id", id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/** Ask the employee to do something right now: { action: "report" | "draft" }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — aksi dinonaktifkan", summary: "mode demo" }, { status: 403 });
  const { id } = await params;
  const agent = await load(id);
  if (!agent) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  if (action === "report") {
    const out = await logRun(`report:${agent.slug}`, async () => ({ summary: await writeDailyReport(agent) }));
    return NextResponse.json(out, { status: out.ok ? 200 : 500 });
  }
  if (action === "draft") {
    const out = await logRun(`generate:${agent.slug}`, () => generate({ agentId: agent.id }));
    return NextResponse.json(out, { status: out.ok ? 200 : 500 });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
