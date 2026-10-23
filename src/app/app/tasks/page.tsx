"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import ResearchResult from "@/components/ResearchResult";
import { Topbar } from "@/components/Shell";
import { ago, Avatar, I, Modal, PRIORITY, PriorityIcon, STATUS, STATUS_ORDER, StatusIcon, wib } from "@/components/ui";
import { useWorkspace, type Task } from "@/components/workspace";

export default function Page() {
  return <Suspense><Tasks /></Suspense>;
}

const KIND: Record<string, string> = { draft: "Draft konten", research: "Riset", report: "Laporan", manual: "Manual" };
const FILTERS = { active: ["in_review", "in_progress", "todo"], backlog: ["backlog"], closed: ["done", "failed", "canceled"], all: STATUS_ORDER } as const;

function Tasks() {
  const { ws, agent } = useWorkspace();
  const q = useSearchParams();
  const router = useRouter();
  const [view, setView] = useState<"list" | "board">("list");
  const [filter, setFilter] = useState<keyof typeof FILTERS>("active");
  const [who, setWho] = useState<string>(q.get("agent") ?? "all");
  const openId = q.get("t");
  const creating = q.get("new") === "1";
  const go = (params: string) => router.replace(`/app/tasks${params}`);

  if (!ws) return <><Topbar title="Tugas" /><div className="empty">Memuat…</div></>;
  const tasks = ws.tasks.filter((t) => (FILTERS[filter] as readonly string[]).includes(t.status) && (who === "all" || t.agent_id === who || (who === "none" && !t.agent_id)));
  const groups = STATUS_ORDER.filter((s) => (FILTERS[filter] as readonly string[]).includes(s)).map((s) => ({ s, items: tasks.filter((t) => t.status === s) }));
  const open = ws.tasks.find((t) => t.id === openId);

  return (
    <>
      <Topbar title="Tugas">
        <button className="btn sm primary" onClick={() => go("?new=1")}><I.plus size={14} /> Task baru</button>
      </Topbar>
      <div className="toolbar">
        <div className="seg">
          {([["active", "Aktif"], ["backlog", "Backlog"], ["closed", "Selesai"], ["all", "Semua"]] as const).map(([k, l]) => (
            <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        <select className="select" style={{ width: "auto", height: 28, padding: "0 8px" }} value={who} onChange={(e) => setWho(e.target.value)} aria-label="Filter karyawan">
          <option value="all">Semua karyawan</option>
          {ws.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          <option value="none">Belum ditugaskan</option>
        </select>
        <div className="grow" />
        <div className="seg">
          <button aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="Tampilan daftar"><I.list size={14} /></button>
          <button aria-pressed={view === "board"} onClick={() => setView("board")} aria-label="Tampilan papan"><I.board size={14} /></button>
        </div>
      </div>

      {tasks.length === 0 && <div className="empty">Tidak ada tugas di sini.</div>}

      {view === "list" ? (
        <div>
          {groups.filter((g) => g.items.length).map((g) => (
            <section key={g.s}>
              <div className="group-h"><StatusIcon status={g.s} /> {STATUS[g.s].label} <span className="n">{g.items.length}</span></div>
              {g.items.map((t) => <Row key={t.id} t={t} onOpen={() => go(`?t=${t.id}`)} />)}
            </section>
          ))}
        </div>
      ) : (
        <div className="board">
          {groups.map((g) => (
            <div key={g.s} className="col">
              <div className="col-h"><StatusIcon status={g.s} /> {STATUS[g.s].label} <span className="muted" style={{ fontWeight: 400 }}>{g.items.length}</span></div>
              {g.items.map((t) => {
                const a = agent(t.agent_id);
                return (
                  <div key={t.id} className="tcard" onClick={() => go(`?t=${t.id}`)}>
                    <div className="row muted" style={{ fontSize: 12 }}><span>AGN-{t.number}</span><span className="grow" />{a && <Avatar name={a.name} color={a.color} size={18} />}</div>
                    <div className="t">{t.title}</div>
                    <div className="row"><PriorityIcon p={t.priority} /><span className="tag">{KIND[t.kind]}</span><span className="grow" /><span className="faint" style={{ fontSize: 11.5 }}>{ago(t.created_at)}</span></div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {open && <TaskModal t={open} onClose={() => go("")} />}
      {creating && <NewTask onClose={() => go("")} defaultAgent={who !== "all" && who !== "none" ? who : ws.agents[0]?.id ?? null} />}
    </>
  );
}

function Row({ t, onOpen }: { t: Task; onOpen: () => void }) {
  const { agent } = useWorkspace();
  const a = agent(t.agent_id);
  return (
    <div className="li" onClick={onOpen}>
      <PriorityIcon p={t.priority} />
      <span className="id hide-sm">AGN-{t.number}</span>
      <StatusIcon status={t.status} />
      <span className="title">{t.title}</span>
      <span className="meta">
        {t.error && <span className="tag bad hide-sm">error</span>}
        <span className="tag hide-sm">{KIND[t.kind]}</span>
        {t.due_at && <span className="hide-sm">⏱ {ago(t.due_at)}</span>}
        <span className="hide-sm" style={{ width: 56, textAlign: "right" }}>{ago(t.created_at)}</span>
        {a ? <Avatar name={a.name} color={a.color} size={20} /> : <span className="avatar" style={{ width: 20, height: 20, border: "1px dashed var(--line-2)" }} />}
      </span>
    </div>
  );
}

function TaskModal({ t, onClose }: { t: Task; onClose: () => void }) {
  const { ws, call, agent } = useWorkspace();
  const a = agent(t.agent_id);
  const patch = (body: Record<string, unknown>) => call(`/api/tasks/${t.id}`, "PATCH", body, "Tugas diperbarui");
  const lockedStatus = t.kind === "draft";

  return (
    <Modal title={<span className="muted">AGN-{t.number} · {KIND[t.kind]}</span>} onClose={onClose}>
      <h3 style={{ fontSize: 18, margin: "12px 0 4px", fontWeight: 600, letterSpacing: -0.2 }}>{t.title}</h3>
      {t.description && <p className="muted" style={{ marginTop: 4, whiteSpace: "pre-wrap" }}>{t.description}</p>}

      <div className="props">
        <span>Status</span>
        {lockedStatus ? (
          <span className="row"><StatusIcon status={t.status} /> {STATUS[t.status]?.label} <span className="faint">· mengikuti persetujuan draft</span></span>
        ) : (
          <select className="select" value={t.status} onChange={(e) => patch({ status: e.target.value })}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
        )}
        <span>Ditugaskan ke</span>
        <select className="select" value={t.agent_id ?? ""} onChange={(e) => patch({ agent_id: e.target.value || null })}>
          <option value="">Belum ditugaskan</option>
          {ws?.agents.map((x) => <option key={x.id} value={x.id}>{x.name} — {x.role}</option>)}
        </select>
        <span>Prioritas</span>
        <select className="select" value={t.priority} onChange={(e) => patch({ priority: Number(e.target.value) })}>
          {PRIORITY.map((p, i) => <option key={i} value={i}>{p}</option>)}
        </select>
        <span>Dibuat</span><span>{wib(t.created_at)} · {t.created_by === "admin" ? "oleh admin" : a ? `oleh ${a.name}` : "oleh sistem"}</span>
        {t.due_at && (<><span>Tenggat</span><span>{wib(t.due_at)}</span></>)}
        {t.finished_at && (<><span>Selesai</span><span>{wib(t.finished_at)}</span></>)}
      </div>

      {t.error && <div className="note bad">{t.error}</div>}
      {t.kind === "research" && <ResearchResult t={t} />}
      {t.kind === "draft" && t.draft_id && (
        <Link href={`/app/inbox?i=d:${t.draft_id}`} className="btn" style={{ marginTop: 6 }}><I.inbox size={14} /> Buka draft di Inbox</Link>
      )}
      {t.kind === "report" && <Link href="/app/reports" className="btn" style={{ marginTop: 6 }}><I.report size={14} /> Buka laporan</Link>}
    </Modal>
  );
}

function NewTask({ onClose, defaultAgent }: { onClose: () => void; defaultAgent: string | null }) {
  const { ws, call } = useWorkspace();
  const [kind, setKind] = useState<"research" | "manual">("research");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [agentId, setAgentId] = useState<string | null>(defaultAgent);
  const [priority, setPriority] = useState(3);
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const r = await call("/api/tasks", "POST", {
      kind, title, description: description || undefined, query: kind === "research" ? query || title : undefined,
      agent_id: agentId, priority, due_at: due ? new Date(due).toISOString() : null,
    }, kind === "research" ? "Tugas riset dikirim — bot mengerjakannya dalam ±20 menit" : "Tugas dibuat");
    setBusy(false);
    if (r) onClose();
  }

  return (
    <Modal title="Tugas baru" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn primary" disabled={busy || title.trim().length < 2} onClick={submit}>Buat tugas</button></>}>
      <div className="seg" style={{ marginTop: 12 }}>
        <button aria-pressed={kind === "research"} onClick={() => setKind("research")}>Riset topik (dikerjakan bot)</button>
        <button aria-pressed={kind === "manual"} onClick={() => setKind("manual")}>Catatan / manual</button>
      </div>
      <input className="title-input" autoFocus placeholder={kind === "research" ? "Mis. Pantau isu harga beras di Jawa Tengah" : "Judul tugas"} value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea className="textarea" placeholder="Deskripsi (opsional)" value={description} onChange={(e) => setDescription(e.target.value)} style={{ border: 0, background: "none", padding: "4px 0" }} />
      {kind === "research" && (
        <>
          <label className="label">Kata kunci pencarian</label>
          <input className="input" placeholder={title || "harga beras jawa tengah"} value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>Bot mencari berita 3 hari terakhir, merangkum, dan mengusulkan angle konten. Hasilnya masuk ke Inbox.</div>
        </>
      )}
      <div className="grid g-3" style={{ gap: 8 }}>
        <div>
          <label className="label">Ditugaskan ke</label>
          <select className="select" value={agentId ?? ""} onChange={(e) => setAgentId(e.target.value || null)}>
            <option value="">Belum ditugaskan</option>
            {ws?.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Prioritas</label>
          <select className="select" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
            {PRIORITY.map((p, i) => <option key={i} value={i}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Tenggat</label>
          <input className="input" type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
