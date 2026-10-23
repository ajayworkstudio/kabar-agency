"use client";
import { useEffect, type ReactNode } from "react";
import { I } from "./icons";

export { I, Logo } from "./icons";

// ── avatar ─────────────────────────────────────────────────
export function Avatar({ name, color, size = 20, status }: { name: string; color: string; size?: number; status?: "active" | "paused" }) {
  return (
    <span className="avatar" style={{ width: size, height: size, background: color, fontSize: Math.max(9, size * 0.44) }} title={name}>
      {name.slice(0, 1).toUpperCase()}
      {status && <span className={`presence ${status === "paused" ? "paused" : ""}`} />}
    </span>
  );
}

// ── task status / priority ─────────────────────────────────
export const STATUS: Record<string, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "#62666d" },
  todo: { label: "Todo", color: "#d0d6e0" },
  in_progress: { label: "Dikerjakan", color: "#f2c94c" },
  in_review: { label: "Perlu ditinjau", color: "#4cb782" },
  done: { label: "Selesai", color: "#5e6ad2" },
  failed: { label: "Gagal", color: "#eb5757" },
  canceled: { label: "Dibatalkan", color: "#62666d" },
};
export const STATUS_ORDER = ["in_review", "in_progress", "todo", "backlog", "failed", "done", "canceled"];

export function StatusIcon({ status, size = 14 }: { status: string; size?: number }) {
  const c = STATUS[status]?.color ?? "#8a8f98";
  const r = 5.5;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-label={STATUS[status]?.label} style={{ flex: "none" }}>
      {status === "backlog" && <circle cx="7" cy="7" r={r} fill="none" stroke={c} strokeWidth="1.5" strokeDasharray="1.6 1.8" />}
      {status === "todo" && <circle cx="7" cy="7" r={r} fill="none" stroke={c} strokeWidth="1.5" />}
      {status === "in_progress" && (<><circle cx="7" cy="7" r={r} fill="none" stroke={c} strokeWidth="1.5" /><path d="M7 3.5A3.5 3.5 0 0 1 7 10.5Z" fill={c} /></>)}
      {status === "in_review" && (<><circle cx="7" cy="7" r={r} fill="none" stroke={c} strokeWidth="1.5" /><path d="M7 3.5A3.5 3.5 0 1 1 3.5 7H7Z" fill={c} /></>)}
      {status === "done" && (<><circle cx="7" cy="7" r="6.2" fill={c} /><path d="m4.4 7.2 1.8 1.8 3.5-3.7" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></>)}
      {status === "failed" && (<><circle cx="7" cy="7" r="6.2" fill={c} /><path d="M7 4v3.5M7 9.6v.1" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" /></>)}
      {status === "canceled" && (<><circle cx="7" cy="7" r="6.2" fill={c} /><path d="m5 5 4 4M9 5 5 9" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" /></>)}
    </svg>
  );
}

export const PRIORITY = ["Tanpa prioritas", "Mendesak", "Tinggi", "Sedang", "Rendah"];
export function PriorityIcon({ p, size = 14 }: { p: number; size?: number }) {
  if (p === 1)
    return (
      <svg width={size} height={size} viewBox="0 0 14 14" aria-label="Mendesak" style={{ flex: "none" }}>
        <rect x="1" y="1" width="12" height="12" rx="3" fill="#f2994a" />
        <path d="M7 3.8v4M7 9.9v.2" stroke="#08090a" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  const on = p === 2 ? 3 : p === 3 ? 2 : p === 4 ? 1 : 0;
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-label={PRIORITY[p]} style={{ flex: "none" }}>
      {p === 0 ? (
        <path d="M2.5 7h2M6 7h2M9.5 7h2" stroke="#62666d" strokeWidth="1.5" strokeLinecap="round" />
      ) : (
        [0, 1, 2].map((i) => <rect key={i} x={1.5 + i * 4} y={9 - i * 3} width="3" height={3 + i * 3} rx="1" fill={i < on ? "#d0d6e0" : "#3a3c40"} />)
      )}
    </svg>
  );
}

// ── categories & platforms ─────────────────────────────────
export const CATEGORY: Record<string, string> = { politik: "Politik", olahraga: "Olahraga", hiburan: "Hiburan", ekonomi: "Ekonomi", teknologi: "Teknologi", umum: "Nasional" };
export const catColor = (c: string) => `var(--${CATEGORY[c] ? c : "umum"})`;
export const TARGETS: { id: string; label: string }[] = [
  { id: "instagram:carousel", label: "IG Carousel" },
  { id: "instagram:reel", label: "IG Reel" },
  { id: "threads:text", label: "Threads" },
  { id: "threads:carousel", label: "Threads Carousel" },
  { id: "tiktok:video", label: "TikTok" },
  { id: "youtube:short", label: "YT Shorts" },
];
export const PLATFORM: Record<string, string> = { instagram: "Instagram", threads: "Threads", tiktok: "TikTok", youtube: "YouTube" };
export const PLATFORM_COLOR: Record<string, string> = { instagram: "#e467b4", threads: "#d0d6e0", tiktok: "#4ea7fc", youtube: "#eb5757" };
export const targetLabel = (t: string) => TARGETS.find((x) => x.id === t)?.label ?? t;

export function CatTag({ c }: { c: string }) {
  return (
    <span className="tag">
      <span className="dot" style={{ background: catColor(c) }} />
      {CATEGORY[c] ?? c}
    </span>
  );
}

// ── formatting ─────────────────────────────────────────────
export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 0) {
    const f = -m;
    return f < 60 ? `${f} mnt lagi` : f < 2880 ? `${Math.round(f / 60)} jam lagi` : `${Math.round(f / 1440)} hari lagi`;
  }
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt`;
  if (m < 48 * 60) return `${Math.round(m / 60)} jam`;
  return `${Math.round(m / 1440)} hari`;
}
export const wib = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const num = (v: number | undefined | null) => (v == null ? "—" : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}jt` : v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}rb` : String(v));

// ── modal ──────────────────────────────────────────────────
export function Modal({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="modal-h">
          <div className="grow">{title}</div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Tutup"><I.x size={14} /></button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}
