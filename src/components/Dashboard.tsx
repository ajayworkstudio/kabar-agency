"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { DraftContent, FactCheck } from "@/lib/types";

// ── shapes returned by /api/data ───────────────────────────
type Draft = {
  id: string; status: string; hook: string; content: DraftContent; fact_check: FactCheck | null;
  card_urls: string[]; video_url: string | null; targets: string[]; scheduled_for: string | null; error: string | null; created_at: string;
  stories: { headline: string; outlet_count: number; heat: number } | null;
};
type Story = { id: string; headline: string; category: string; outlet_count: number; article_count: number; heat: number; trend_score: number; status: string; first_seen_at: string };
type Post = { id: string; platform: string; format: string; status: string; permalink: string | null; error: string | null; published_at: string | null; metrics: Record<string, number>; drafts: { hook: string; category: string } | null };
type Source = { id: string; outlet: string; kind: string; enabled: boolean; last_ok_at: string | null; last_error: string | null; last_item_count: number };
type Run = { id: number; job: string; ok: boolean; summary: string; started_at: string; duration_ms: number };
type Data = {
  brand: { name: string; handle: string };
  config: { minSources: number; minSourcesPolitics: number; postSlots: string[]; platforms: Record<string, boolean> };
  drafts: Draft[]; stories: Story[]; posts: Post[]; sources: Source[]; runs: Run[]; trends: { term: string; traffic: string | null }[];
};

const TARGETS: { id: string; label: string }[] = [
  { id: "instagram:carousel", label: "IG Carousel" },
  { id: "instagram:reel", label: "IG Reel" },
  { id: "threads:text", label: "Threads" },
  { id: "threads:carousel", label: "Threads Carousel" },
  { id: "tiktok:video", label: "TikTok" },
  { id: "youtube:short", label: "YT Shorts" },
];

const CAT_LABEL: Record<string, string> = { politik: "Politik", olahraga: "Olahraga", hiburan: "Hiburan", ekonomi: "Ekonomi", teknologi: "Teknologi", umum: "Nasional" };
const catColor = (c: string) => `var(--${CAT_LABEL[c] ? c : "umum"})`;

const ago = (iso: string | null) => {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  if (m < 48 * 60) return `${Math.round(m / 60)} jam lalu`;
  return `${Math.round(m / 1440)} hari lalu`;
};
const wib = (iso: string) => new Date(iso).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", hour: "2-digit", minute: "2-digit" });
const n = (v: number | undefined) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}rb` : String(v));

export default function Dashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"queue" | "trending" | "published" | "system">("queue");
  const [toast, setToast] = useState("");
  const [loadErr, setLoadErr] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.status === 401) { window.location.href = "/login"; return; }
    if (!res.ok) { setLoadErr("Gagal memuat data — cek koneksi Supabase."); return; }
    setLoadErr("");
    setData(await res.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  const pending = data?.drafts.filter((d) => d.status === "pending" || d.status === "failed") ?? [];
  const inFlight = data?.drafts.filter((d) => ["rendering", "scheduled", "publishing"].includes(d.status)) ?? [];

  return (
    <>
      <header className="top">
        <div className="wrap">
          <div className="brand"><span className="dot" /> {data?.brand.name ?? "Newsroom"}</div>
          <nav className="tabs" role="tablist">
            {([
              ["queue", "Antrian", pending.length],
              ["trending", "Trending", data?.stories.length ?? 0],
              ["published", "Terbit", data?.posts.filter((p) => p.status === "published").length ?? 0],
              ["system", "Sistem", data?.runs.filter((r) => !r.ok).length ? "!" : "✓"],
            ] as const).map(([id, label, badge]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>
                <b>{badge}</b>{label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap">
        {loadErr && <div className="issues fail" style={{ marginTop: 16 }}>{loadErr}</div>}
        {!data && !loadErr && <div className="empty">Memuat…</div>}
        {data && tab === "queue" && <Queue pending={pending} inFlight={inFlight} reload={load} say={say} />}
        {data && tab === "trending" && <Trending data={data} reload={load} say={say} />}
        {data && tab === "published" && <Published posts={data.posts} />}
        {data && tab === "system" && <System data={data} reload={load} say={say} />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

// ── Queue ──────────────────────────────────────────────────

function Queue({ pending, inFlight, reload, say }: { pending: Draft[]; inFlight: Draft[]; reload: () => void; say: (m: string) => void }) {
  return (
    <>
      <h2 className="section">Menunggu persetujuan · {pending.length}</h2>
      {pending.length === 0 && <div className="card empty">Belum ada draft. Bot menulis draft otomatis begitu sebuah berita dikonfirmasi beberapa outlet.</div>}
      {pending.map((d) => <DraftCard key={d.id} d={d} reload={reload} say={say} />)}

      {inFlight.length > 0 && (
        <>
          <h2 className="section">Dijadwalkan / diproses · {inFlight.length}</h2>
          <div className="card">
            {inFlight.map((d) => (
              <div key={d.id} className="story">
                <div className="bar" style={{ background: catColor(d.content.category) }} />
                <div>
                  <div className="t">{d.hook}</div>
                  <div className="m">
                    {d.status === "rendering" ? "🎬 Render video…" : d.status === "publishing" ? "📤 Sedang diposting…" : `🕒 ${d.scheduled_for ? wib(d.scheduled_for) : ""}`} · {d.targets.map((t) => TARGETS.find((x) => x.id === t)?.label ?? t).join(", ")}
                  </div>
                </div>
                <div />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function DraftCard({ d, reload, say }: { d: Draft; reload: () => void; say: (m: string) => void }) {
  const c = d.content;
  const fc = d.fact_check;
  const [targets, setTargets] = useState<string[]>(d.targets);
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<DraftContent>(c);
  const dirty = useMemo(() => JSON.stringify(edit) !== JSON.stringify(c), [edit, c]);

  async function act(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    const res = await fetch(`/api/drafts/${d.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) { say(`Gagal: ${j.error ?? res.status}`); return false; }
    say(msg);
    reload();
    return true;
  }

  async function saveEdits() {
    const changed: Partial<DraftContent> = {};
    for (const k of Object.keys(edit) as (keyof DraftContent)[]) {
      if (JSON.stringify(edit[k]) !== JSON.stringify(c[k])) (changed as Record<string, unknown>)[k] = edit[k];
    }
    return act({ action: "edit", content: changed }, "Perubahan disimpan");
  }

  async function approve(when: "now" | "slot") {
    if (dirty && !(await saveEdits())) return;
    if (fc?.verdict === "fail" && !confirm("Pemeriksa fakta menandai masalah serius. Tetap terbitkan?")) return;
    await act({ action: "approve", when, targets }, when === "now" ? "Diposting sekarang" : "Dijadwalkan ke slot berikutnya");
  }

  const toggle = (t: string) => setTargets((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
  const set = <K extends keyof DraftContent>(k: K, v: DraftContent[K]) => setEdit((e) => ({ ...e, [k]: v }));

  return (
    <article className="card" id={`draft-${d.id}`}>
      {d.card_urls.length > 0 && (
        <div className="slides">
          {d.card_urls.map((u, i) => <img key={u} src={u} alt={`Slide ${i + 1}`} loading="lazy" />)}
        </div>
      )}
      <div className="card-body">
        <div className="row">
          <span className="pill cat" style={{ background: catColor(c.category) }}>{CAT_LABEL[c.category] ?? c.category}</span>
          <span className="pill">{d.stories?.outlet_count ?? "?"} outlet</span>
          {fc && <span className={`pill ${fc.verdict === "pass" ? "ok" : fc.verdict === "warn" ? "warn" : "bad"}`}>{fc.verdict === "pass" ? "Fakta ✓" : fc.verdict === "warn" ? "Ada catatan" : "Cek fakta gagal"}</span>}
          {c.sensitivity === "high" && <span className="pill bad">Sensitif</span>}
          {d.status === "failed" && <span className="pill bad">Gagal</span>}
          <span className="sub" style={{ marginLeft: "auto", fontSize: 12 }}>{ago(d.created_at)}</span>
        </div>

        <div className="hook">{c.hook}</div>
        <p className="sub" style={{ margin: 0 }}>{c.summary}</p>
        <p className="sub" style={{ margin: "6px 0 0", fontSize: 13 }}>{c.sourceCredit}</p>

        {d.error && <div className="issues fail">{d.error}</div>}
        {fc && fc.issues.length > 0 && (
          <ul className={`issues ${fc.verdict === "fail" ? "fail" : ""}`}>
            {fc.issues.map((i, k) => <li key={k}><b>“{i.text}”</b> — {i.problem}</li>)}
          </ul>
        )}

        <details className="edit">
          <summary>Fakta yang dipakai ({c.keyFacts.length})</summary>
          <ul style={{ fontSize: 13, paddingLeft: 18 }}>
            {c.keyFacts.map((f, i) => <li key={i}>{f.claim} <span className="sub">— {f.sources.join(", ")}</span></li>)}
          </ul>
        </details>

        <details className="edit">
          <summary>Edit teks {dirty && "• belum disimpan"}</summary>
          <Field label="Hook" value={edit.hook} onChange={(v) => set("hook", v)} rows={2} />
          {edit.carousel.map((s, i) => (
            <div key={i} style={{ borderLeft: "2px solid var(--line)", paddingLeft: 10, marginTop: 12 }}>
              <Field label={`Slide ${i + 1} · judul`} value={s.title} onChange={(v) => set("carousel", edit.carousel.map((x, k) => (k === i ? { ...x, title: v } : x)))} rows={2} />
              <Field label={`Slide ${i + 1} · isi`} value={s.body ?? ""} onChange={(v) => set("carousel", edit.carousel.map((x, k) => (k === i ? { ...x, body: v } : x)))} rows={2} />
            </div>
          ))}
          <Field label="Caption Instagram" value={edit.instagramCaption} onChange={(v) => set("instagramCaption", v)} rows={6} max={2200} />
          <Field label="Threads" value={edit.threadsPost} onChange={(v) => set("threadsPost", v)} rows={4} max={500} />
          <Field label="Caption TikTok" value={edit.tiktokCaption} onChange={(v) => set("tiktokCaption", v)} rows={3} max={2200} />
          <Field label="Judul YouTube Shorts" value={edit.video.title} onChange={(v) => set("video", { ...edit.video, title: v })} rows={1} max={100} />
          {edit.video.scenes.map((s, i) => (
            <Field key={i} label={`Adegan ${i + 1} · teks layar / narasi`} value={`${s.onScreen}\n---\n${s.voiceover}`} rows={3}
              onChange={(v) => {
                const [on, vo] = v.split(/\n---\n/);
                set("video", { ...edit.video, scenes: edit.video.scenes.map((x, k) => (k === i ? { ...x, onScreen: on ?? "", voiceover: vo ?? "" } : x)) });
              }} />
          ))}
          <Field label="Hashtag (pisahkan spasi)" value={edit.hashtags.join(" ")} onChange={(v) => set("hashtags", v.split(/\s+/).filter(Boolean))} rows={1} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn small" disabled={!dirty || busy} onClick={saveEdits}>Simpan & render ulang kartu</button>
            <button className="btn small" disabled={!dirty || busy} onClick={() => setEdit(c)}>Batalkan</button>
          </div>
        </details>

        <div className="chips" aria-label="Platform">
          {TARGETS.map((t) => <button key={t.id} className="chip" aria-pressed={targets.includes(t.id)} onClick={() => toggle(t.id)}>{t.label}</button>)}
        </div>

        <div className="actions">
          <button className="btn primary" disabled={busy || !targets.length} onClick={() => approve("now")}>Post sekarang</button>
          <button className="btn" disabled={busy || !targets.length} onClick={() => approve("slot")}>Slot berikutnya</button>
          {d.status === "failed"
            ? <button className="btn" disabled={busy} onClick={() => act({ action: "retry" }, "Dicoba ulang")}>Ulangi</button>
            : <button className="btn danger" disabled={busy} onClick={() => act({ action: "reject" }, "Ditolak")}>Tolak</button>}
        </div>
      </div>
    </article>
  );
}

function Field({ label, value, onChange, rows = 3, max }: { label: string; value: string; onChange: (v: string) => void; rows?: number; max?: number }) {
  return (
    <label className="field">
      <span>{label}{max && <em className="count" style={{ color: value.length > max ? "var(--bad)" : undefined }}>{value.length}/{max}</em>}</span>
      {rows === 1 ? <input value={value} onChange={(e) => onChange(e.target.value)} /> : <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

// ── Trending ───────────────────────────────────────────────

function Trending({ data, reload, say }: { data: Data; reload: () => void; say: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("all");
  const stories = data.stories.filter((s) => cat === "all" || s.category === cat);
  const max = Math.max(1, ...data.stories.map((s) => s.heat));
  const need = (s: Story) => (s.category === "politik" ? data.config.minSourcesPolitics : data.config.minSources);

  async function draft(s: Story) {
    if (s.outlet_count < need(s) && !confirm(`Baru ${s.outlet_count} outlet yang memberitakan. Tetap buat draft?`)) return;
    setBusy(s.id);
    const res = await fetch(`/api/stories/${s.id}/draft`, { method: "POST" });
    setBusy(null);
    const j = await res.json().catch(() => ({}));
    say(res.ok ? "Draft dibuat — cek tab Antrian" : `Gagal: ${j.summary ?? res.status}`);
    reload();
  }

  return (
    <>
      {data.trends.length > 0 && (
        <>
          <h2 className="section">Dicari orang sekarang · Google Trends</h2>
          <div className="trend-cloud">
            {data.trends.slice(0, 20).map((t) => <span key={t.term}>{t.term}{t.traffic && <em>{t.traffic}</em>}</span>)}
          </div>
        </>
      )}

      <div className="spread">
        <h2 className="section">Berita terpanas · 36 jam</h2>
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="btn small" aria-label="Kategori">
          <option value="all">Semua</option>
          {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="card">
        {stories.length === 0 && <div className="empty">Belum ada berita. Jalankan "collect" di tab Sistem.</div>}
        {stories.map((s) => (
          <div key={s.id} className="story">
            <div className="bar" style={{ background: catColor(s.category), opacity: 0.35 + 0.65 * (s.heat / max) }} />
            <div>
              <div className="t">{s.headline}</div>
              <div className="m">
                {CAT_LABEL[s.category] ?? s.category} · <b style={{ color: s.outlet_count >= need(s) ? "var(--ok)" : "var(--warn)" }}>{s.outlet_count}/{need(s)} outlet</b> · {s.article_count} artikel
                {s.trend_score > 0 && " · 🔥 trending"} · {ago(s.first_seen_at)}
                {s.status === "drafted" && " · sudah didraft"}
              </div>
            </div>
            <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
              <div className="heat">{Math.round(s.heat)}<small>HEAT</small></div>
              {s.status !== "drafted" && <button className="btn small" disabled={busy === s.id} onClick={() => draft(s)}>{busy === s.id ? "Menulis…" : "Draft"}</button>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── Published ──────────────────────────────────────────────

function Published({ posts }: { posts: Post[] }) {
  const pub = posts.filter((p) => p.status === "published");
  const failed = posts.filter((p) => p.status === "failed");
  const totals = pub.reduce((a, p) => ({ views: a.views + (p.metrics.views ?? 0), likes: a.likes + (p.metrics.likes ?? 0), comments: a.comments + (p.metrics.comments ?? 0), shares: a.shares + (p.metrics.shares ?? 0) }), { views: 0, likes: 0, comments: 0, shares: 0 });

  return (
    <>
      <h2 className="section">Ringkasan 7 hari</h2>
      <div className="status-grid">
        {Object.entries({ Views: totals.views, Likes: totals.likes, Komentar: totals.comments, Share: totals.shares }).map(([k, v]) => (
          <div key={k}><span className="sub">{k}</span><b style={{ fontSize: 22 }}>{n(v)}</b></div>
        ))}
      </div>

      <h2 className="section">Postingan</h2>
      <div className="card scroll-x">
        {pub.length === 0 ? <div className="empty">Belum ada yang terbit.</div> : (
          <table>
            <thead><tr><th>Konten</th><th>Platform</th><th className="num">Views</th><th className="num">Likes</th><th className="num">Kom.</th><th className="num">Share</th></tr></thead>
            <tbody>
              {pub.map((p) => (
                <tr key={p.id}>
                  <td>{p.permalink ? <a href={p.permalink} target="_blank" rel="noreferrer">{p.drafts?.hook ?? "—"}</a> : p.drafts?.hook}<div className="sub" style={{ fontSize: 12 }}>{ago(p.published_at)}</div></td>
                  <td>{TARGETS.find((t) => t.id === `${p.platform}:${p.format}`)?.label ?? p.platform}</td>
                  <td className="num">{n(p.metrics.views)}</td>
                  <td className="num">{n(p.metrics.likes)}</td>
                  <td className="num">{n(p.metrics.comments)}</td>
                  <td className="num">{n(p.metrics.shares)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {failed.length > 0 && (
        <>
          <h2 className="section">Gagal terbit</h2>
          <div className="card">
            {failed.map((p) => <div key={p.id} className="card-body" style={{ borderBottom: "1px solid var(--line)" }}><b>{p.platform}:{p.format}</b> — {p.drafts?.hook}<div className="sub">{p.error}</div></div>)}
          </div>
        </>
      )}
    </>
  );
}

// ── System ─────────────────────────────────────────────────

function System({ data, reload, say }: { data: Data; reload: () => void; say: (m: string) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const p = data.config.platforms;

  async function runJob(job: string) {
    setBusy(job);
    const res = await fetch(`/api/cron/${job}`, { method: "POST" });
    setBusy(null);
    const j = await res.json().catch(() => ({}));
    say(j.summary ?? (res.ok ? "Selesai" : "Gagal"));
    reload();
  }

  const status: [string, boolean, string?][] = [
    ["Instagram", p.instagram],
    ["Threads", p.threads],
    ["TikTok", p.tiktok, p.tiktok && !p.tiktokAudited ? "privat sampai audit lolos" : undefined],
    ["YouTube", p.youtube],
    ["Telegram", p.telegram, "persetujuan 1-tap"],
    ["Video worker", p.videoWorker],
    ["Voiceover", p.voiceover, p.voiceover ? undefined : "video tanpa narasi"],
  ];

  return (
    <>
      <h2 className="section">Koneksi</h2>
      <div className="status-grid">
        {status.map(([name, ok, note]) => (
          <div key={name}><b>{name}</b><span style={{ color: ok ? "var(--ok)" : "var(--muted)" }}>{ok ? "Terhubung" : "Belum diatur"}</span>{note && <div className="sub" style={{ fontSize: 12 }}>{note}</div>}</div>
        ))}
      </div>

      <h2 className="section">Jalankan manual</h2>
      <div className="row">
        {["collect", "generate", "publish", "metrics", "refresh-tokens"].map((j) => (
          <button key={j} className="btn small" disabled={!!busy} onClick={() => runJob(j)}>{busy === j ? "…" : j}</button>
        ))}
      </div>
      <p className="sub" style={{ fontSize: 13 }}>
        Ambang konfirmasi: {data.config.minSources} outlet (politik {data.config.minSourcesPolitics}). Slot posting WIB: {data.config.postSlots.join(", ")}.
      </p>

      <h2 className="section">Sumber berita</h2>
      <div className="card scroll-x">
        <table>
          <thead><tr><th>Feed</th><th>Terakhir OK</th><th className="num">Item</th><th>Error</th></tr></thead>
          <tbody>
            {data.sources.map((s) => (
              <tr key={s.id}>
                <td><b>{s.outlet}</b><div className="sub" style={{ fontSize: 12 }}>{s.id}</div></td>
                <td style={{ color: s.last_error ? "var(--bad)" : undefined }}>{ago(s.last_ok_at)}</td>
                <td className="num">{s.last_item_count}</td>
                <td className="sub" style={{ fontSize: 12, maxWidth: 260 }}>{s.last_error ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section">Log</h2>
      <div className="card scroll-x">
        <table>
          <tbody>
            {data.runs.map((r) => (
              <tr key={r.id}>
                <td style={{ whiteSpace: "nowrap" }}><span className={`pill ${r.ok ? "ok" : "bad"}`}>{r.job}</span><div className="sub" style={{ fontSize: 12, marginTop: 4 }}>{ago(r.started_at)} · {(r.duration_ms / 1000).toFixed(1)}s</div></td>
                <td style={{ fontSize: 13 }}>{r.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="row" style={{ marginTop: 24 }}>
        <button className="btn small" onClick={async () => { await fetch("/api/logout", { method: "POST" }); window.location.href = "/login"; }}>Keluar</button>
      </div>
    </>
  );
}
