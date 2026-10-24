"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import DraftDetail from "@/components/DraftDetail";
import ResearchResult from "@/components/ResearchResult";
import { Topbar } from "@/components/Shell";
import { ago, Avatar, catColor, I } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

export default function Page() {
  return <Suspense><Inbox /></Suspense>;
}

type Item = { key: string; kind: "draft" | "research"; title: string; sub: string; at: string; agentId: string | null; color: string; unread: boolean };

function Inbox() {
  const { ws, agent, call } = useWorkspace();
  const q = useSearchParams();
  const router = useRouter();
  const sel = q.get("i");

  if (!ws) return <><Topbar title="Inbox" /><div className="empty">Memuat…</div></>;

  const items: Item[] = [
    ...ws.drafts.filter((d) => d.status === "pending" || d.status === "failed").map((d) => ({
      key: `d:${d.id}`, kind: "draft" as const, title: d.hook, at: d.created_at, agentId: d.agent_id, color: d.content.design ? d.content.design.palette.bg : catColor(d.content.category), unread: d.status === "pending",
      sub: d.status === "failed" ? `Gagal terbit · ${d.error ?? ""}` : d.content.design ? `Desain dari Studio · ${d.card_urls.length} slide · siap disetujui` : `Draft siap disetujui · ${d.stories?.outlet_count ?? "?"} outlet · ${d.fact_check?.verdict === "pass" ? "lolos cek fakta" : d.fact_check?.verdict === "warn" ? "ada catatan" : "perlu dicek"}`,
    })),
    ...ws.tasks.filter((t) => t.kind === "research" && t.status === "in_review").map((t) => ({
      key: `t:${t.id}`, kind: "research" as const, title: t.title, at: t.finished_at ?? t.started_at ?? t.created_at, agentId: t.agent_id, color: "var(--accent)", unread: true,
      sub: `Hasil riset · ${t.result?.outlets ?? 0} outlet`,
    })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  const current = items.find((i) => i.key === sel) ?? null;
  const draft = current?.kind === "draft" ? ws.drafts.find((d) => `d:${d.id}` === current.key) : undefined;
  const task = current?.kind === "research" ? ws.tasks.find((t) => `t:${t.id}` === current.key) : undefined;

  return (
    <>
      <Topbar title="Inbox"><span className="muted">{items.length} perlu tindakan</span></Topbar>
      <div className={`split ${current ? "has-detail" : ""}`}>
        <div className="pane">
          {items.length === 0 && <div className="empty"><I.check size={22} /><div style={{ marginTop: 8 }}>Semua beres. Draft baru akan muncul di sini begitu karyawan menulisnya.</div></div>}
          {items.map((it) => {
            const a = agent(it.agentId);
            return (
              <div key={it.key} className="inbox-item" aria-selected={it.key === sel} onClick={() => router.replace(`/app/inbox?i=${it.key}`)}>
                {a ? <Avatar name={a.name} color={a.color} size={26} /> : <span style={{ width: 26 }} />}
                <div className="grow">
                  <div className="row">
                    <span className="t grow ellipsis">{it.title}</span>
                    <span className="when">{ago(it.at)}</span>
                  </div>
                  <div className="s row"><span style={{ width: 6, height: 6, borderRadius: 2, background: it.color, flex: "none" }} /><span className="ellipsis">{it.sub}</span></div>
                </div>
                {it.unread && <span className="unread" />}
              </div>
            );
          })}
        </div>
        <div className="pane">
          {current && (
            <div style={{ padding: "10px 14px 0" }}>
              <Link href="/app/inbox" className="btn ghost sm back"><I.back size={14} /> Inbox</Link>
            </div>
          )}
          {!current && <div className="empty" style={{ paddingTop: 120 }}><I.inbox size={28} /><div style={{ marginTop: 10 }}>Pilih item untuk ditinjau</div></div>}
          {draft && <DraftDetail key={draft.id} d={draft} />}
          {task && (
            <div className="detail">
              <span className="tag">Riset · AGN-{task.number}</span>
              <h2>{task.title}</h2>
              <ResearchResult t={task} />
              <div className="action-bar">
                <button className="btn primary" onClick={() => call(`/api/tasks/${task.id}`, "PATCH", { status: "done" }, "Ditandai selesai")}><I.check size={14} /> Tandai selesai</button>
                <button className="btn" onClick={() => call(`/api/tasks/${task.id}`, "PATCH", { status: "todo" }, "Riset diulang pada putaran berikutnya")}>Riset ulang</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
