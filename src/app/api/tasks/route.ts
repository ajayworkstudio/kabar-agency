import { NextResponse } from "next/server";
import { z } from "zod";
import { createTask } from "@/lib/agents";
import { isLoggedIn } from "@/lib/auth";
import { isDemo } from "@/lib/demo";

const TaskInput = z.object({
  kind: z.enum(["manual", "research"]),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(4000).optional(),
  agent_id: z.string().uuid().nullable(),
  priority: z.number().int().min(0).max(4).default(0),
  status: z.enum(["backlog", "todo"]).default("todo"),
  query: z.string().trim().max(200).optional(), // research topic
  due_at: z.string().datetime().nullable().optional(),
});

/** Admin assigns a task to a bot employee. Research tasks are picked up by the bot automatically. */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — aksi dinonaktifkan" }, { status: 403 });
  const parsed = TaskInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  const t = parsed.data;
  const out = await createTask({
    agent_id: t.agent_id,
    kind: t.kind,
    title: t.title,
    description: t.description ?? null,
    priority: t.priority,
    status: t.status,
    created_by: "admin",
    due_at: t.due_at ?? null,
    payload: t.kind === "research" ? { query: t.query || t.title } : {},
  });
  return NextResponse.json(out);
}
