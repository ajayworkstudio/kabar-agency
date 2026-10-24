"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AgentForm, { type AgentDraft } from "@/components/AgentForm";
import { AreaChart } from "@/components/charts";
import { Topbar } from "@/components/Shell";
import { ago, Avatar, CATEGORY, I, num, PriorityIcon, StatusIcon, targetLabel } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

export default function AgentPage() {
  const { slug } = useParams<{ slug: string }>();
  const { ws, call } = useWorkspace();
  const a = ws?.agents.find((x) => x.slug === slug);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<AgentDraft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => { if (a && !editing) setForm({ ...a }); }, [a, editing]);

  if (!ws) return <><Topbar title="Karyawan" /><div className="empty">Memuat…</div></>;
  if (!a) return <><Topbar title="Tidak ditemukan" crumb="Karyawan" /><div className="empty">Karyawan ini tidak ada. <Link href="/app/agents" style={{ color: "var(--accent-2)" }}>Kembali</Link></div></>;

  const draftForm: AgentDraft = form ?? { ...a };
  const tasks = ws.tasks.filter((t) => t.agent_id === a.id);
  const posts = ws.posts.filter((p) => p.drafts?.agent_id === a.id);
  const reports = ws.reports.filter((r) => r.agent_id === a.id);
  const byDay = new Map(ws.charts.daily.map((d) => [d.day, 0]));
  posts.forEach((p) => { if (p.published_at) { const k = new Date(new Date(p.published_at).getTime() + 7 * 3600_000).toISOString().slice(0, 10); if (byDay.has(k)) byDay.set(k, byDay.get(k)! + (p.metrics.views ?? 0)); } });

  async function act(action: "report" | "draft") {
    setBusy(action);
    await call(`/api/agents/${a!.id}`, "POST", { action }, action === "report" ? "Laporan dibuat — cek Laporan harian" : "Selesai — cek Inbox untuk draft baru");
    setBusy(null);
  }
  async function save() {
    setBusy("save");
    const ok = await call(`/api/agents/${a!.id}`, "PATCH", draftForm, "Profil karyawan disimpan");
    setBusy(null);
    if (ok) setEditing(false);
  }
  const toggleStatus = () => call(`/api/agents/${a.id}`, "PATCH", { status: a.status === "active" ? "paused" : "active" }, a.status === "active" ? `${a.name} dinonaktifkan` : `${a.name} aktif kembali`);

  return (
    <>
      <Topbar title={a.name} crumb={<Link href="/app/agents">Karyawan</Link>}>
        {!editing && <button className="btn sm" onClick={() => setEditing(true)}>Edit profil</button>}
      </Topbar>
      <div className="page">
        <div className="row" style={{ gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Avatar name={a.name} color={a.color} size={64} status={a.status} />
          <div className="grow" style={{ minWidth: 220 }}>
            <h2 style={{ margin: "4px 0 2px", fontSize: 24, letterSpacing: -0.5 }}>{a.name}</h2>
            <div className="muted" style={{ fontSize: 14 }}>{a.role}</div>
            <div className="wrap-row" style={{ marginTop: 10 }}>
              <span className={`tag ${a.status === "active" ? "ok" : ""}`}>{a.status === "active" ? "Aktif" : "Nonaktif"}</span>
              {a.platforms.map((p) => <span key={p} className="tag">{targetLabel(p)}</span>)}
              <span className="tag">{a.kind === "designer" ? "Desainer · 2 warna" : a.categories.length ? a.categories.map((c) => CATEGORY[c]).join(", ") : "Semua kategori"}</span>
            </div>
          </div>
          <div className="wrap-row">
            {a.kind === "designer" ? (
              <Link href="/app/studio" className="btn primary"><I.spark size={14} /> Buka Studio desain</Link>
            ) : (
              <>
                <button className="btn" disabled={!!busy || a.status !== "active"} onClick={() => act("draft")}><I.bolt size={14} /> {busy === "draft" ? "Menulis…" : "Cari & tulis draft sekarang"}</button>
                <button className="btn" disabled={!!busy} onClick={() => act("report")}><I.report size={14} /> {busy === "report" ? "Menyusun…" : "Minta laporan sekarang"}</button>
              </>
            )}
            <button className="btn ghost" onClick={toggleStatus}>{a.status === "active" ? "Nonaktifkan" : "Aktifkan"}</button>
          </div>
        </div>

        {editing ? (
          <div className="card card-b" style={{ marginTop: 18 }}>
            <AgentForm value={draftForm} onChange={setForm} />
            <div className="row" style={{ justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn ghost" onClick={() => setEditing(false)}>Batal</button>
              <button className="btn primary" disabled={busy === "save"} onClick={save}>Simpan</button>
            </div>
          </div>
        ) : (
          <div className="grid g-21" style={{ marginTop: 18 }}>
            <div className="card">
              <div className="card-h">Tanggung jawab</div>
              <div className="card-b">
                <ul className="resp">{a.responsibilities.map((r, i) => <li key={i}>{r}</li>)}</ul>
              </div>
            </div>
            <div className="card">
              <div className="card-h">Aturan kerja</div>
              <div className="card-b props" style={{ margin: 0 }}>
                <span>Jenis</span><span>{a.kind === "designer" ? "Desainer — bekerja dari teks admin di Studio" : "Penulis berita — mencari & menulis otomatis"}</span>
                {a.kind === "writer" && <><span>Fokus audiens</span><span>{a.settings.focus === "genz" ? "Gen Z — viral, K-culture, game, tech, kampus" : "Umum"}</span></>}
                {a.kind === "designer" && a.settings.palette && <><span>Palet default</span><span className="row"><span className="dot" style={{ width: 12, height: 12, borderRadius: 3, background: a.settings.palette.bg, outline: "1px solid var(--line-2)" }} /><span className="dot" style={{ width: 12, height: 12, borderRadius: 3, background: a.settings.palette.fg, outline: "1px solid var(--line-2)" }} /> {a.settings.palette.bg} / {a.settings.palette.fg}</span></>}
                <span>Min. outlet</span><span>{a.settings.minSources} (politik {a.settings.minSourcesPolitics})</span>
                <span>Kuota draft</span><span>{a.settings.maxDraftsPerDay} / hari</span>
                <span>Laporan harian</span><span>{String(a.settings.reportHour).padStart(2, "0")}.00 WIB</span>
                <span>Bergabung</span><span>{ago(a.created_at)} lalu</span>
              </div>
            </div>
          </div>
        )}

        <div className="grid g-4" style={{ marginTop: 12 }}>
          <div className="card stat"><div className="k">Tugas aktif</div><div className="v">{tasks.filter((t) => ["todo", "in_progress", "in_review"].includes(t.status)).length}</div></div>
          <div className="card stat"><div className="k">Selesai</div><div className="v">{tasks.filter((t) => t.status === "done").length}</div></div>
          <div className="card stat"><div className="k">Postingan · 14 hari</div><div className="v">{posts.length}</div></div>
          <div className="card stat"><div className="k">Views · 14 hari</div><div className="v">{num(posts.reduce((s, p) => s + (p.metrics.views ?? 0), 0))}</div></div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-h">Views dari konten {a.name}</div>
          <div className="card-b"><AreaChart data={[...byDay.entries()].map(([day, value]) => ({ day, value }))} label="Views" color={a.color} height={150} /></div>
        </div>

        <div className="section-title"><span>Tugas terbaru</span><Link href={`/app/tasks?agent=${a.id}`} className="btn ghost sm">Semua tugas</Link></div>
        <div className="card">
          {tasks.length === 0 && <div className="empty">Belum ada tugas.</div>}
          {tasks.slice(0, 10).map((t) => (
            <Link key={t.id} href={`/app/tasks?t=${t.id}`} className="li">
              <PriorityIcon p={t.priority} />
              <span className="id hide-sm">AGN-{t.number}</span>
              <StatusIcon status={t.status} />
              <span className="title">{t.title}</span>
              <span className="meta">{ago(t.created_at)}</span>
            </Link>
          ))}
        </div>

        <div className="section-title"><span>Laporan harian</span><Link href="/app/reports" className="btn ghost sm">Semua laporan</Link></div>
        <div className="card">
          {reports.length === 0 && <div className="empty">Laporan pertama dikirim pukul {String(a.settings.reportHour).padStart(2, "0")}.00 WIB.</div>}
          {reports.slice(0, 5).map((r) => (
            <Link key={r.id} href={`/app/reports?r=${r.id}`} className="li"><I.report size={14} /><span className="title">{r.title}</span><span className="meta">{r.data.drafts?.total ?? 0} draft</span></Link>
          ))}
        </div>
      </div>
    </>
  );
}
