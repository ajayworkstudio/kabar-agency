"use client";
import Link from "next/link";
import { useState } from "react";
import { Topbar } from "@/components/Shell";
import { ago, CATEGORY, catColor, CatTag } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

export default function News() {
  const { ws, call } = useWorkspace();
  const [cat, setCat] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  if (!ws) return <><Topbar title="Berita & sumber" /><div className="empty">Memuat…</div></>;
  const a0 = ws.agents.find((a) => a.status === "active");
  const need = (c: string) => (c === "politik" ? a0?.settings.minSourcesPolitics ?? 3 : a0?.settings.minSources ?? 2);
  const stories = ws.stories.filter((s) => cat === "all" || s.category === cat);
  const max = Math.max(1, ...ws.stories.map((s) => s.heat));

  async function draft(id: string, outlets: number, c: string) {
    if (outlets < need(c) && !confirm(`Baru ${outlets} outlet yang memberitakan. Tetap buat draft?`)) return;
    setBusy(id);
    await call(`/api/stories/${id}/draft`, "POST", undefined, "Draft dibuat — cek Inbox");
    setBusy(null);
  }

  return (
    <>
      <Topbar title="Berita & sumber" />
      <div className="page">
        {ws.trends.length > 0 && (
          <>
            <div className="section-title" style={{ marginTop: 0 }}>Dicari orang sekarang · Google Trends</div>
            <div className="wrap-row">{ws.trends.slice(0, 24).map((t) => <span key={t.term} className="tag">{t.term}{t.traffic && <span className="faint">{t.traffic}</span>}</span>)}</div>
          </>
        )}

        <div className="section-title">
          <span>Berita terpanas · 36 jam · {stories.length}</span>
          <select className="select" style={{ width: "auto", height: 28, padding: "0 8px" }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori">
            <option value="all">Semua kategori</option>
            {Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="card">
          {stories.length === 0 && <div className="empty">Belum ada berita. Jalankan “collect” di Pengaturan.</div>}
          {stories.map((s) => (
            <div key={s.id} className="li" style={{ height: "auto", padding: "10px 14px", cursor: "default", alignItems: "flex-start" }}>
              <div style={{ width: 3, alignSelf: "stretch", borderRadius: 2, background: catColor(s.category), opacity: 0.3 + 0.7 * (s.heat / max) }} />
              <div className="grow">
                <div style={{ lineHeight: 1.4, fontWeight: 500 }}>{s.headline}</div>
                <div className="wrap-row" style={{ marginTop: 6, fontSize: 12 }}>
                  <CatTag c={s.category} />
                  <span className={`tag ${s.outlet_count >= need(s.category) ? "ok" : "warn"}`}>{s.outlet_count}/{need(s.category)} outlet</span>
                  <span className="muted">{s.article_count} artikel · {ago(s.first_seen_at)}</span>
                  {s.trend_score > 0 && <span className="tag warn">trending</span>}
                  {s.status === "drafted" && <span className="tag">sudah didraft</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 600 }}>{Math.round(s.heat)}</div>
                <div className="faint" style={{ fontSize: 10.5, letterSpacing: 1 }}>HEAT</div>
                <div style={{ display: "grid", gap: 4, marginTop: 6, justifyItems: "end" }}>
                  <Link href={`/app/studio?story=${s.id}`} className="btn sm primary" title="Langsung ke desain Dita — tanpa AI">Kirim ke Dita</Link>
                  {s.status !== "drafted" && <button className="btn sm" disabled={busy === s.id} onClick={() => draft(s.id, s.outlet_count, s.category)} title="Raka menulis dengan AI (butuh saldo Anthropic)">{busy === s.id ? "Menulis…" : "Tulis via AI"}</button>}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="section-title">Kesehatan sumber · {ws.sources.length} feed</div>
        <div className="card scroll-x">
          <table className="table">
            <thead><tr><th>Feed</th><th>Jenis</th><th>Terakhir OK</th><th className="num">Item</th><th>Error</th></tr></thead>
            <tbody>
              {ws.sources.map((s) => (
                <tr key={s.id}>
                  <td><b style={{ fontWeight: 500 }}>{s.outlet}</b><div className="faint mono">{s.id}</div></td>
                  <td className="muted">{s.kind}</td>
                  <td style={{ color: s.last_error ? "var(--bad)" : undefined }}>{ago(s.last_ok_at)}</td>
                  <td className="num">{s.last_item_count}</td>
                  <td className="muted" style={{ maxWidth: 280 }}>{s.last_error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
