"use client";
import { useState } from "react";
import { Topbar } from "@/components/Shell";
import { ago, I } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

const JOBS: [string, string][] = [
  ["collect", "Kumpulkan berita"],
  ["generate", "Tulis draft"],
  ["publish", "Terbitkan yang terjadwal"],
  ["agents", "Laporan & riset karyawan"],
  ["metrics", "Ambil statistik"],
  ["refresh-tokens", "Perbarui token"],
];

export default function Settings() {
  const { ws, call } = useWorkspace();
  const [busy, setBusy] = useState<string | null>(null);
  if (!ws) return <><Topbar title="Pengaturan" /><div className="empty">Memuat…</div></>;
  const p = ws.config.platforms;
  const conn: [string, boolean, string?][] = [
    ["AI penulis (Claude)", p.ai, p.ai ? undefined : "isi ANTHROPIC_API_KEY"],
    ["Instagram", p.instagram],
    ["Threads", p.threads],
    ["TikTok", p.tiktok, p.tiktok && !p.tiktokAudited ? "posting privat sampai audit TikTok lolos" : undefined],
    ["YouTube Shorts", p.youtube],
    ["Telegram (setuju 1-tap)", p.telegram],
    ["Worker video", p.videoWorker],
    ["Voiceover", p.voiceover, p.voiceover ? undefined : "video tanpa narasi"],
  ];

  async function run(job: string) {
    setBusy(job);
    const r = await call<{ summary?: string }>(`/api/cron/${job}`, "POST");
    if (r?.summary) alert(r.summary);
    setBusy(null);
  }

  return (
    <>
      <Topbar title="Pengaturan" />
      <div className="page" style={{ maxWidth: 900 }}>
        <div className="section-title" style={{ marginTop: 0 }}>Admin</div>
        <div className="card">
          <div className="li" style={{ cursor: "default" }}>
            <span className="avatar" style={{ width: 28, height: 28, background: "#26272b", fontSize: 12 }}>A</span>
            <div className="grow"><div style={{ fontWeight: 500 }}>Admin</div><div className="muted" style={{ fontSize: 12 }}>Akses penuh · menyetujui semua konten sebelum terbit</div></div>
            <button className="btn sm" onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; }}><I.logout size={14} /> Keluar</button>
          </div>
        </div>

        <div className="section-title">Koneksi</div>
        <div className="card">
          {conn.map(([name, ok, note]) => (
            <div key={name} className="li" style={{ cursor: "default" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ok ? "var(--ok)" : "var(--faint)" }} />
              <span className="title">{name}</span>
              <span className="meta">{note ?? (ok ? "Terhubung" : "Belum diatur")}</span>
            </div>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 12 }}>Koneksi diatur lewat Environment Variables di Vercel — lihat README untuk langkah tiap platform.</p>

        <div className="section-title">Jalankan manual</div>
        <div className="card">
          {JOBS.map(([job, label]) => {
            const last = ws.runs.find((r) => r.job === job);
            return (
              <div key={job} className="li" style={{ cursor: "default" }}>
                <I.play size={12} className="faint" />
                <span className="title">{label} <span className="faint mono">{job}</span></span>
                <span className="meta hide-sm">{last ? `${last.ok ? "OK" : "gagal"} · ${ago(last.started_at)}` : "belum pernah"}</span>
                <button className="btn sm" disabled={!!busy} onClick={() => run(job)}>{busy === job ? "Berjalan…" : "Jalankan"}</button>
              </div>
            );
          })}
        </div>

        <div className="section-title">Jadwal posting (WIB)</div>
        <div className="wrap-row">{ws.config.postSlots.map((s) => <span key={s} className="tag">{s}</span>)}</div>
        <p className="faint" style={{ fontSize: 12 }}>Ubah lewat variabel <span className="mono">POST_SLOTS</span>.</p>
      </div>
    </>
  );
}
