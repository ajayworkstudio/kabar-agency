"use client";
import Link from "next/link";
import { AreaChart, BarList, BarsChart } from "@/components/charts";
import { Topbar } from "@/components/Shell";
import { ago, Avatar, CATEGORY, catColor, I, num, PLATFORM, PLATFORM_COLOR, STATUS, StatusIcon } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";

export default function Overview() {
  const { ws } = useWorkspace();
  if (!ws) return <><Topbar title="Ringkasan" /><div className="empty">Memuat workspace…</div></>;
  const c = ws.charts;
  const views = c.daily.reduce((a, d) => a + d.views, 0);
  const half = Math.floor(c.daily.length / 2);
  const v1 = c.daily.slice(0, half).reduce((a, d) => a + d.views, 0);
  const v2 = c.daily.slice(half).reduce((a, d) => a + d.views, 0);
  const growth = v1 ? Math.round(((v2 - v1) / v1) * 100) : null;
  const pending = ws.drafts.filter((d) => d.status === "pending").length;
  const active = ws.tasks.filter((t) => ["todo", "in_progress", "in_review"].includes(t.status)).length;
  const published = c.daily.reduce((a, d) => a + d.published, 0);
  const latestReport = ws.reports[0];

  return (
    <>
      <Topbar title="Ringkasan">
        <Link href="/app/inbox" className="btn sm primary"><I.inbox size={14} /> Tinjau {pending} draft</Link>
      </Topbar>
      <div className="page">
        <div className="grid g-4">
          <Link href="/app/inbox" className="card stat">
            <div className="k"><I.inbox size={14} /> Menunggu persetujuan</div>
            <div className="v">{pending}</div>
            <div className="d muted">{ws.tasks.filter((t) => t.kind === "research" && t.status === "in_review").length} hasil riset juga siap ditinjau</div>
          </Link>
          <Link href="/app/tasks" className="card stat">
            <div className="k"><I.tasks size={14} /> Tugas aktif</div>
            <div className="v">{active}</div>
            <div className="d muted">{c.taskStatus.failed ?? 0} gagal · {c.taskStatus.done ?? 0} selesai</div>
          </Link>
          <div className="card stat">
            <div className="k"><I.chart size={14} /> Views · 14 hari</div>
            <div className="v">{num(views)}</div>
            <div className={`d ${growth == null ? "muted" : growth >= 0 ? "up" : "down"}`}>{growth == null ? `${published} konten terbit` : `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth)}% vs pekan sebelumnya`}</div>
          </div>
          <div className="card stat">
            <div className="k"><I.check size={14} /> Tingkat persetujuan</div>
            <div className="v">{c.approvalRate == null ? "—" : `${c.approvalRate}%`}</div>
            <div className="d muted">draft disetujui vs ditolak</div>
          </div>
        </div>

        <div className="grid g-21" style={{ marginTop: 12 }}>
          <div className="card">
            <div className="card-h"><span>Views harian</span><span className="muted" style={{ fontWeight: 400 }}>semua platform</span></div>
            <div className="card-b"><AreaChart data={c.daily.map((d) => ({ day: d.day, value: d.views }))} label="Views" /></div>
          </div>
          <div className="card">
            <div className="card-h">Per platform</div>
            <div className="card-b">
              <BarList items={c.platforms.map((p) => ({ label: PLATFORM[p.platform] ?? p.platform, value: p.views, color: PLATFORM_COLOR[p.platform] ?? "#8a8f98", hint: `${num(p.views)} · ${p.posts} post` }))} />
              <div className="sep" />
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Interaksi (like, komentar, share)</div>
              <BarList items={c.platforms.map((p) => ({ label: PLATFORM[p.platform] ?? p.platform, value: p.engagement, color: PLATFORM_COLOR[p.platform] ?? "#8a8f98" }))} />
            </div>
          </div>
        </div>

        <div className="grid g-21" style={{ marginTop: 12 }}>
          <div className="card">
            <div className="card-h">Produktivitas karyawan</div>
            <div className="card-b">
              <BarsChart data={c.daily} series={[{ key: "drafts", label: "Draft ditulis", color: "#3d4170" }, { key: "published", label: "Postingan terbit", color: "#5e6ad2" }]} />
            </div>
          </div>
          <div className="card">
            <div className="card-h">Berita terpantau · 36 jam</div>
            <div className="card-b">
              <BarList items={c.categories.map((x) => ({ label: CATEGORY[x.category] ?? x.category, value: x.count, color: catColor(x.category) }))} />
              <div className="sep" />
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Status tugas</div>
              <div className="wrap-row">
                {Object.entries(c.taskStatus).map(([s, n]) => <span key={s} className="tag"><StatusIcon status={s} size={12} /> {STATUS[s]?.label ?? s} · {n}</span>)}
              </div>
            </div>
          </div>
        </div>

        <div className="grid g-2" style={{ marginTop: 12 }}>
          <div className="card">
            <div className="card-h"><span>Tim</span><Link href="/app/agents" className="btn ghost sm">Semua karyawan</Link></div>
            {ws.agents.map((a) => {
              const mine = ws.tasks.filter((t) => t.agent_id === a.id);
              const now = mine.find((t) => t.status === "in_progress") ?? mine.find((t) => t.status === "todo");
              return (
                <Link key={a.id} href={`/app/agents/${a.slug}`} className="li" style={{ height: 52 }}>
                  <Avatar name={a.name} color={a.color} size={28} status={a.status} />
                  <div className="grow">
                    <div style={{ fontWeight: 500 }}>{a.name} <span className="muted" style={{ fontWeight: 400 }}>· {a.role}</span></div>
                    <div className="muted ellipsis" style={{ fontSize: 12 }}>{a.status === "paused" ? "Sedang dinonaktifkan" : now ? `Sedang: ${now.title}` : "Memantau berita"}</div>
                  </div>
                  <span className="muted" style={{ fontSize: 12 }}>{mine.filter((t) => t.status === "done").length} selesai</span>
                </Link>
              );
            })}
          </div>
          <div className="card">
            <div className="card-h"><span>Laporan terbaru</span><Link href="/app/reports" className="btn ghost sm">Semua laporan</Link></div>
            {latestReport ? (
              <Link href={`/app/reports?r=${latestReport.id}`} className="card-b" style={{ display: "block" }}>
                <div style={{ fontWeight: 500 }}>{latestReport.title}</div>
                <div className="prose" style={{ fontSize: 12.5, marginTop: 6, maxHeight: 150, overflow: "hidden", WebkitMaskImage: "linear-gradient(#000 60%, transparent)" }}>{latestReport.summary}</div>
              </Link>
            ) : <div className="empty">Laporan harian pertama muncul besok pagi.</div>}
          </div>
        </div>

        <div className="section-title">Aktivitas sistem</div>
        <div className="card">
          {ws.runs.slice(0, 8).map((r) => (
            <div key={r.id} className="li" style={{ cursor: "default" }}>
              <span className={`tag ${r.ok ? "" : "bad"}`} style={{ width: 92, justifyContent: "center" }}>{r.job}</span>
              <span className="title" style={{ color: r.ok ? "var(--text-2)" : "var(--bad)" }}>{r.summary}</span>
              <span className="meta">{ago(r.started_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
