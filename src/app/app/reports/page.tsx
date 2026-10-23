"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { BarList } from "@/components/charts";
import { Topbar } from "@/components/Shell";
import { Avatar, CATEGORY, catColor, CatTag, I, num } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

export default function Page() {
  return <Suspense><Reports /></Suspense>;
}

function Reports() {
  const { ws, agent } = useWorkspace();
  const q = useSearchParams();
  const router = useRouter();
  if (!ws) return <><Topbar title="Laporan harian" /><div className="empty">Memuat…</div></>;
  const sel = ws.reports.find((r) => r.id === q.get("r")) ?? null;
  const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <>
      <Topbar title="Laporan harian"><span className="muted">dikirim otomatis tiap pagi</span></Topbar>
      <div className={`split ${sel ? "has-detail" : ""}`}>
        <div className="pane">
          {ws.reports.length === 0 && <div className="empty">Belum ada laporan. Karyawan mengirim laporan pertama pada jam laporannya (default 07.00 WIB), atau minta sekarang dari halaman karyawan.</div>}
          {ws.reports.map((r) => {
            const a = agent(r.agent_id);
            return (
              <div key={r.id} className="inbox-item" aria-selected={r.id === sel?.id} onClick={() => router.replace(`/app/reports?r=${r.id}`)}>
                {a && <Avatar name={a.name} color={a.color} size={26} />}
                <div className="grow">
                  <div className="row"><span className="t grow ellipsis">{a?.name ?? "Karyawan"} · {day(r.day)}</span></div>
                  <div className="s ellipsis">{r.summary.split("\n")[0]}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="pane">
          {!sel && <div className="empty" style={{ paddingTop: 120 }}><I.report size={28} /><div style={{ marginTop: 10 }}>Pilih laporan</div></div>}
          {sel && (
            <div className="detail">
              <Link href="/app/reports" className="btn ghost sm back"><I.back size={14} /> Laporan</Link>
              <h2>{sel.title}</h2>
              <div className="grid g-4" style={{ margin: "14px 0" }}>
                <div className="card stat"><div className="k">Draft ditulis</div><div className="v">{sel.data.drafts?.total ?? 0}</div></div>
                <div className="card stat"><div className="k">Terbit</div><div className="v">{sel.data.drafts?.published ?? 0}</div></div>
                <div className="card stat"><div className="k">Menunggu</div><div className="v">{sel.data.drafts?.pending ?? 0}</div></div>
                <div className="card stat"><div className="k">Views 24 jam</div><div className="v">{num(sel.data.engagement?.views ?? 0)}</div></div>
              </div>
              <div className="prose">{sel.summary}</div>

              {!!sel.data.stories?.length && (
                <>
                  <div className="section-title">Berita teratas</div>
                  <div className="card">
                    {sel.data.stories.map((s) => (
                      <div key={s.id} className="li" style={{ cursor: "default" }}>
                        <CatTag c={s.category} />
                        <span className="title">{s.headline}</span>
                        <span className="meta">{s.outlet_count} outlet{s.trend_score > 0 ? " · trending" : ""}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="grid g-2" style={{ marginTop: 12 }}>
                <div className="card card-b">
                  <div className="muted" style={{ marginBottom: 10 }}>Sebaran kategori</div>
                  <BarList items={Object.entries(sel.data.categories ?? {}).map(([k, v]) => ({ label: CATEGORY[k] ?? k, value: v, color: catColor(k) }))} />
                </div>
                <div className="card card-b">
                  <div className="muted" style={{ marginBottom: 10 }}>Dicari orang · Google Trends</div>
                  <div className="wrap-row">{(sel.data.trends ?? []).map((t) => <span key={t} className="tag">{t}</span>)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
