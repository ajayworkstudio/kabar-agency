import { db } from "./db";

export type AgentSettings = {
  minSources: number;
  minSourcesPolitics: number;
  maxDraftsPerDay: number;
  reportHour: number; // WIB hour for the daily report
};

export type Agent = {
  id: string;
  slug: string;
  name: string;
  role: string;
  kind: "writer" | "designer";
  color: string;
  status: "active" | "paused";
  platforms: string[];
  categories: string[];
  responsibilities: string[];
  settings: AgentSettings;
  created_at: string;
};

export type TaskStatus = "backlog" | "todo" | "in_progress" | "in_review" | "done" | "failed" | "canceled";
export type TaskKind = "draft" | "research" | "report" | "manual" | "design";

export const DEFAULT_SETTINGS: AgentSettings = { minSources: 2, minSourcesPolitics: 3, maxDraftsPerDay: 12, reportHour: 7 };

export function withDefaults(a: Agent): Agent {
  return { ...a, kind: a.kind ?? "writer", settings: { ...DEFAULT_SETTINGS, ...(a.settings ?? {}) } };
}

/** Active employees of one kind. News writers hunt stories; designers only work from admin text. */
export async function activeAgents(kind: Agent["kind"] = "writer"): Promise<Agent[]> {
  const { data } = await db().from("agents").select("*").eq("status", "active").eq("kind", kind).order("created_at");
  return ((data ?? []) as Agent[]).map(withDefaults);
}

/** Does this agent cover the category? Empty list = covers everything. */
export const covers = (a: Agent, category: string) => !a.categories.length || a.categories.includes(category);

/** Start of today in WIB, as a UTC ISO string. */
export function wibDayStart(now = new Date()): string {
  const wib = new Date(now.getTime() + 7 * 3600_000);
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - 7 * 3600_000).toISOString();
}

export function wibDate(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

export function wibHour(now = new Date()): number {
  return new Date(now.getTime() + 7 * 3600_000).getUTCHours();
}

export async function createTask(t: {
  agent_id: string | null;
  kind: TaskKind;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: number;
  draft_id?: string | null;
  payload?: Record<string, unknown>;
  created_by?: "system" | "admin";
  due_at?: string | null;
}) {
  const now = new Date().toISOString();
  const status = t.status ?? "todo";
  const { data, error } = await db()
    .from("tasks")
    .insert({
      ...t,
      status,
      payload: t.payload ?? {},
      created_by: t.created_by ?? "system",
      started_at: ["in_progress", "in_review", "done"].includes(status) ? now : null,
      finished_at: ["done", "failed", "canceled"].includes(status) ? now : null,
    })
    .select("id, number")
    .single();
  if (error) throw new Error(`create task: ${error.message}`);
  return data as { id: string; number: number };
}

export async function updateTask(id: string, patch: { status?: TaskStatus; result?: unknown; error?: string | null }) {
  const now = new Date().toISOString();
  const extra: Record<string, unknown> = {};
  if (patch.status === "in_progress") extra.started_at = now;
  if (patch.status && ["done", "failed", "canceled"].includes(patch.status)) extra.finished_at = now;
  await db().from("tasks").update({ ...patch, ...extra }).eq("id", id);
}

/** Keep the task attached to a draft in step with the draft's lifecycle. */
export async function syncDraftTask(draftId: string, status: TaskStatus, error?: string | null) {
  const { data } = await db().from("tasks").select("id").eq("draft_id", draftId).limit(1);
  if (data?.[0]) await updateTask(data[0].id as string, { status, error: error ?? null });
}
