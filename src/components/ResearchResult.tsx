"use client";
import { ago } from "./ui";
import type { Task } from "./workspace";

export default function ResearchResult({ t }: { t: Task }) {
  const r = t.result;
  if (!r) return <div className="note">Belum ada hasil — bot akan mengerjakan riset ini pada putaran berikutnya (±20 menit).</div>;
  return (
    <>
      <div className="note" style={{ marginTop: 6 }}>
        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Topik: <b style={{ color: "var(--text)" }}>{r.query}</b> · {r.outlets ?? 0} outlet</div>
        <div className="prose">{r.summary}</div>
      </div>
      {!!r.articles?.length && (
        <>
          <div className="section-title">Sumber yang ditemukan · {r.articles.length}</div>
          <div className="card">
            {r.articles.map((a, i) => (
              <a key={i} href={a.url} target="_blank" rel="noreferrer" className="li" style={{ height: "auto", padding: "10px 14px", alignItems: "flex-start" }}>
                <div className="grow">
                  <div style={{ lineHeight: 1.4 }}>{a.title}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{a.outlet} · {ago(a.publishedAt)} lalu</div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
