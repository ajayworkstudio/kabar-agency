"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Avatar, I, Logo } from "./ui";
import { useWorkspace, WorkspaceProvider } from "./workspace";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <WorkspaceProvider>
      <Frame>{children}</Frame>
    </WorkspaceProvider>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const { ws, error } = useWorkspace();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const pendingDrafts = ws?.drafts.filter((d) => d.status === "pending" || d.status === "ready").length ?? 0;
  const reviewTasks = ws?.tasks.filter((t) => t.status === "in_review" && t.kind !== "draft").length ?? 0;
  const inboxCount = pendingDrafts + reviewTasks;
  const activeTasks = ws?.tasks.filter((t) => ["todo", "in_progress", "in_review"].includes(t.status)).length ?? 0;

  const team = ["/app/overview", "/app/tasks", "/app/reports", "/app/agents"].some((p) => path.startsWith(p));
  const [teamOpen, setTeamOpen] = useState(team);
  useEffect(() => { if (team) setTeamOpen(true); }, [team]);
  const is = (href: string) => (href === "/app" ? path === "/app" || path.startsWith("/app/studio") : path.startsWith(href));
  const Item = ({ href, icon, label, count, hot }: { href: string; icon: ReactNode; label: string; count?: number; hot?: boolean }) => (
    <Link href={href} className="nav-item" aria-current={is(href) ? "page" : undefined}>
      {icon}
      <span>{label}</span>
      {!!count && <span className={`count ${hot ? "hot" : ""}`}>{count}</span>}
    </Link>
  );

  return (
    <div className={`shell ${open ? "nav-open" : ""}`}>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className="sidebar">
        <div className="ws">
          <Logo />
          <span className="grow ellipsis">Agency</span>
          <span className="faint" style={{ fontWeight: 400, fontSize: 12 }}>{ws?.brand.name}</span>
        </div>
        <div className="side-actions">
          <Link href="/app" className="btn sm primary" style={{ flex: 1 }}><I.plus size={14} /> Desain baru</Link>
        </div>

        <Item href="/app" icon={<I.spark />} label="Studio desain" />
        <Item href="/app/news" icon={<I.news />} label="Cari berita" />
        <Item href="/app/inbox" icon={<I.inbox />} label="Siap posting" count={inboxCount} hot={inboxCount > 0} />
        <Item href="/app/published" icon={<I.send />} label="Sudah diposting" />

        <details className="nav-fold" open={teamOpen} onToggle={(e) => setTeamOpen((e.target as HTMLDetailsElement).open)}>
          <summary className="nav-group"><span>Tim bot &amp; monitoring</span></summary>
          <Item href="/app/overview" icon={<I.home />} label="Ringkasan" />
          <Item href="/app/tasks" icon={<I.tasks />} label="Tugas" count={activeTasks} />
          <Item href="/app/reports" icon={<I.report />} label="Laporan harian" />
          <Item href="/app/agents" icon={<I.users />} label="Karyawan" count={ws?.agents.length} />
          {ws?.agents.map((a) => (
            <Link key={a.id} href={`/app/agents/${a.slug}`} className="nav-item sub" aria-current={path === `/app/agents/${a.slug}` ? "page" : undefined}>
              <Avatar name={a.name} color={a.color} size={18} status={a.status} />
              <span className="ellipsis">{a.name}</span>
              <span className="count">{ws.tasks.filter((t) => t.agent_id === a.id && ["todo", "in_progress"].includes(t.status)).length || ""}</span>
            </Link>
          ))}
        </details>

        <div className="side-foot">
          <Item href="/app/settings" icon={<I.gear />} label="Pengaturan" />
        </div>
      </aside>

      <div className="main">
        {ws?.demo && <div className="demo-banner">Mode demo — data contoh, tombol aksi dinonaktifkan. Matikan <span className="mono">DEMO_MODE</span> untuk data asli.</div>}
        {error && <div className="demo-banner" style={{ background: "rgba(235,87,87,.1)", borderColor: "rgba(235,87,87,.3)" }}>{error}</div>}
        <MenuButtonContext.Provider value={() => setOpen(true)}>{children}</MenuButtonContext.Provider>
      </div>
    </div>
  );
}

const MenuButtonContext = createContext<() => void>(() => {});

/** Sticky page header with breadcrumb title and right-side actions. */
export function Topbar({ title, crumb, children }: { title: ReactNode; crumb?: ReactNode; children?: ReactNode }) {
  const openMenu = useContext(MenuButtonContext);
  return (
    <header className="topbar">
      <button className="btn ghost sm menu-btn" onClick={openMenu} aria-label="Buka menu"><I.menu /></button>
      <h1>
        {crumb && <><span className="crumb">{crumb}</span><I.chevron size={12} className="faint" /></>}
        {title}
      </h1>
      <div className="spacer" />
      {children}
    </header>
  );
}
