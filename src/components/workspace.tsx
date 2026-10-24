"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Agent } from "@/lib/agents";
import type { Charts } from "@/lib/charts";
import type { DraftContent, FactCheck } from "@/lib/types";

export type Task = {
  id: string; number: number; agent_id: string | null; kind: "draft" | "research" | "report" | "manual" | "design"; title: string; description: string | null;
  status: string; priority: number; draft_id: string | null; payload: Record<string, unknown>;
  result: { query?: string; summary?: string; outlets?: number; articles?: { outlet: string; title: string; url: string; publishedAt: string | null }[] } | null;
  error: string | null; created_by: string; due_at: string | null; created_at: string; started_at: string | null; finished_at: string | null;
};
export type Draft = {
  id: string; agent_id: string | null; status: string; hook: string; content: DraftContent; fact_check: FactCheck | null; card_urls: string[];
  video_url: string | null; targets: string[]; scheduled_for: string | null; error: string | null; created_at: string;
  stories: { headline: string; outlet_count: number; heat: number } | null;
};
export type Story = { id: string; headline: string; category: string; outlet_count: number; article_count: number; heat: number; trend_score: number; status: string; first_seen_at: string };
export type Post = { id: string; platform: string; format: string; status: string; permalink: string | null; error: string | null; published_at: string | null; metrics: Record<string, number>; drafts: { hook: string; agent_id: string | null } | null };
export type Report = { id: string; agent_id: string; day: string; title: string; summary: string; created_at: string;
  data: { stories?: Story[]; categories?: Record<string, number>; trends?: string[]; drafts?: { total: number; published: number; pending: number; rejected: number }; posts?: number; engagement?: { views: number; likes: number; comments: number; shares: number } } };
export type Source = { id: string; outlet: string; kind: string; enabled: boolean; last_ok_at: string | null; last_error: string | null; last_item_count: number };
export type Run = { id: number; job: string; ok: boolean; summary: string; started_at: string; duration_ms: number };

export type Workspace = {
  demo: boolean;
  brand: { name: string; handle: string };
  config: { postSlots: string[]; platforms: Record<string, boolean>; publishMode?: "manual" | "api"; contentLang?: "en" | "id" };
  agents: Agent[]; tasks: Task[]; reports: Report[]; drafts: Draft[]; stories: Story[]; posts: Post[];
  sources: Source[]; runs: Run[]; trends: { term: string; traffic: string | null }[]; charts: Charts;
};

type Ctx = {
  ws: Workspace | null;
  error: string;
  reload: () => Promise<void>;
  say: (m: string) => void;
  /** JSON call with toast on failure. Returns the parsed body or null. */
  call: <T = Record<string, unknown>>(url: string, method: string, body?: unknown, okMsg?: string) => Promise<T | null>;
  agent: (id: string | null | undefined) => Agent | undefined;
};

const C = createContext<Ctx | null>(null);

export function WorkspaceProvider({ children, initial = null }: { children: ReactNode; initial?: Workspace | null }) {
  const [ws, setWs] = useState<Workspace | null>(initial);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      if (!res.ok) { setError("Gagal memuat workspace — cek koneksi Supabase dan environment variables."); return; }
      setError("");
      setWs(await res.json());
    } catch {
      setError("Tidak bisa terhubung ke server.");
    }
  }, []);

  useEffect(() => {
    reload();
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);

  const say = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast((cur) => (cur === m ? "" : cur)), 3500);
  }, []);

  const call = useCallback(async <T,>(url: string, method: string, body?: unknown, okMsg?: string): Promise<T | null> => {
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { say(`Gagal: ${j.error ?? j.summary ?? res.status}`); return null; }
    if (okMsg) say(okMsg);
    reload();
    return j as T;
  }, [reload, say]);

  const value = useMemo<Ctx>(() => ({
    ws, error, reload, say, call,
    agent: (id) => ws?.agents.find((a) => a.id === id),
  }), [ws, error, reload, say, call]);

  return (
    <C.Provider value={value}>
      {children}
      {toast && <div className="toast" role="status">{toast}</div>}
    </C.Provider>
  );
}

export function useWorkspace() {
  const v = useContext(C);
  if (!v) throw new Error("useWorkspace outside provider");
  return v;
}
