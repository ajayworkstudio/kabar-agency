"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import AgentForm, { blankAgent } from "@/components/AgentForm";
import { Topbar } from "@/components/Shell";
import { Avatar, CATEGORY, I, Modal, num, targetLabel } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

export default function Page() {
  return <Suspense><Agents /></Suspense>;
}

function Agents() {
  const { ws } = useWorkspace();
  const q = useSearchParams();
  const router = useRouter();
  const hiring = q.get("hire") === "1";

  if (!ws) return <><Topbar title="Karyawan" /><div className="empty">Memuat…</div></>;

  return (
    <>
      <Topbar title="Karyawan">
        <button className="btn sm primary" onClick={() => router.replace("/app/agents?hire=1")}><I.plus size={14} /> Rekrut karyawan bot</button>
      </Topbar>
      <div className="page">
        <p className="muted" style={{ marginTop: 0, maxWidth: 640 }}>
          Setiap karyawan bot punya platform, kategori berita, dan tanggung jawab sendiri. Draft yang mereka tulis masuk ke Inbox untuk kamu setujui, dan tiap pagi mereka mengirim laporan berita terbaru.
        </p>
        <div className="grid g-3">
          {ws.agents.map((a) => {
            const mine = ws.tasks.filter((t) => t.agent_id === a.id);
            const views = ws.posts.filter((p) => p.drafts?.agent_id === a.id).reduce((s, p) => s + (p.metrics.views ?? 0), 0);
            return (
              <Link key={a.id} href={`/app/agents/${a.slug}`} className="card agent-card">
                <div className="agent-head">
                  <Avatar name={a.name} color={a.color} size={40} status={a.status} />
                  <div className="grow">
                    <div className="n">{a.name}</div>
                    <div className="muted">{a.role}</div>
                  </div>
                  <span className={`tag ${a.status === "active" ? "ok" : ""}`}>{a.status === "active" ? "Aktif" : "Nonaktif"}</span>
                </div>
                <div className="wrap-row">
                  {a.platforms.map((p) => <span key={p} className="tag">{targetLabel(p)}</span>)}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {a.categories.length ? a.categories.map((c) => CATEGORY[c]).join(", ") : "Semua kategori"} · laporan {String(a.settings.reportHour).padStart(2, "0")}.00 WIB
                </div>
                <div className="mini-stats">
                  <div><b>{mine.filter((t) => ["todo", "in_progress", "in_review"].includes(t.status)).length}</b><span>tugas aktif</span></div>
                  <div><b>{mine.filter((t) => t.status === "done").length}</b><span>selesai</span></div>
                  <div><b>{num(views)}</b><span>views 14 hari</span></div>
                </div>
              </Link>
            );
          })}
          <button className="card hire" onClick={() => router.replace("/app/agents?hire=1")}>
            <div style={{ textAlign: "center" }}><I.plus size={20} /><div style={{ marginTop: 6 }}>Rekrut karyawan bot baru</div></div>
          </button>
        </div>
      </div>
      {hiring && <Hire onClose={() => router.replace("/app/agents")} />}
    </>
  );
}

function Hire({ onClose }: { onClose: () => void }) {
  const { call } = useWorkspace();
  const router = useRouter();
  const [v, setV] = useState(blankAgent);
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    const r = await call<{ slug: string }>("/api/agents", "POST", v, `${v.name} bergabung ke tim`);
    setBusy(false);
    if (r?.slug) router.push(`/app/agents/${r.slug}`);
  }
  return (
    <Modal title="Rekrut karyawan bot" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Batal</button><button className="btn primary" disabled={busy || v.name.trim().length < 2 || v.role.trim().length < 2} onClick={submit}>Rekrut</button></>}>
      <AgentForm value={v} onChange={setV} />
    </Modal>
  );
}
