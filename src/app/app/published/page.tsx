"use client";
import { useState } from "react";
import { Topbar } from "@/components/Shell";
import { ago, Avatar, I, num, PLATFORM, PLATFORM_COLOR, targetLabel } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

export default function Published() {
  const { ws, agent } = useWorkspace();
  const [plat, setPlat] = useState("all");
  if (!ws) return <><Topbar title="Sudah diposting" /><div className="empty">Memuat…</div></>;
  const posts = ws.posts.filter((p) => plat === "all" || p.platform === plat);
  const pub = posts.filter((p) => p.status === "published");
  const failed = posts.filter((p) => p.status === "failed");
  const sum = (k: string) => pub.reduce((s, p) => s + (p.metrics[k] ?? 0), 0);

  return (
    <>
      <Topbar title="Sudah diposting" />
      <div className="toolbar">
        <div className="seg">
          <button aria-pressed={plat === "all"} onClick={() => setPlat("all")}>Semua</button>
          {Object.entries(PLATFORM).map(([k, l]) => <button key={k} aria-pressed={plat === k} onClick={() => setPlat(k)}>{l}</button>)}
        </div>
      </div>
      <div className="page">
        <div className="grid g-4">
          {[["Views", "views"], ["Likes", "likes"], ["Komentar", "comments"], ["Share", "shares"]].map(([l, k]) => (
            <div key={k} className="card stat"><div className="k">{l} · 14 hari</div><div className="v">{num(sum(k))}</div></div>
          ))}
        </div>
        <div className="section-title">{pub.length} postingan</div>
        <div className="card scroll-x">
          {pub.length === 0 ? <div className="empty">Belum ada yang terbit.</div> : (
            <table className="table">
              <thead><tr><th>Konten</th><th>Platform</th><th>Oleh</th><th className="num">Views</th><th className="num">Likes</th><th className="num">Kom.</th><th className="num">Share</th></tr></thead>
              <tbody>
                {pub.slice(0, 120).map((p) => {
                  const a = agent(p.drafts?.agent_id);
                  return (
                    <tr key={p.id}>
                      <td style={{ minWidth: 220 }}>
                        {p.permalink ? <a href={p.permalink} target="_blank" rel="noreferrer" className="row">{p.drafts?.hook} <I.external size={12} /></a> : p.drafts?.hook}
                        <div className="faint" style={{ fontSize: 11.5 }}>{ago(p.published_at)} lalu</div>
                      </td>
                      <td><span className="tag"><span className="dot" style={{ background: PLATFORM_COLOR[p.platform] }} />{targetLabel(`${p.platform}:${p.format}`)}</span></td>
                      <td>{a && <Avatar name={a.name} color={a.color} size={20} />}</td>
                      <td className="num">{num(p.metrics.views)}</td>
                      <td className="num">{num(p.metrics.likes)}</td>
                      <td className="num">{num(p.metrics.comments)}</td>
                      <td className="num">{num(p.metrics.shares)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {failed.length > 0 && (
          <>
            <div className="section-title">Gagal terbit · {failed.length}</div>
            <div className="card">{failed.map((p) => <div key={p.id} className="li" style={{ cursor: "default" }}><span className="tag bad">{p.platform}</span><span className="title">{p.drafts?.hook}</span><span className="meta">{p.error}</span></div>)}</div>
          </>
        )}
      </div>
    </>
  );
}
