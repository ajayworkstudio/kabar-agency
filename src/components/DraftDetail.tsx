"use client";
import { useMemo, useState } from "react";
import type { DraftContent } from "@/lib/types";
import { ago, Avatar, CatTag, I, TARGETS, wib } from "./ui";
import { useWorkspace, type Draft } from "./workspace";

/** Full review of a draft: slides, fact-check, claims, editable copy, platform choice, approve/reject. */
export default function DraftDetail({ d }: { d: Draft }) {
  const { call, agent } = useWorkspace();
  const c = d.content;
  const fc = d.fact_check;
  const a = agent(d.agent_id);
  const [targets, setTargets] = useState<string[]>(d.targets);
  const [edit, setEdit] = useState<DraftContent>(c);
  const [busy, setBusy] = useState(false);
  const dirty = useMemo(() => JSON.stringify(edit) !== JSON.stringify(c), [edit, c]);
  const set = <K extends keyof DraftContent>(k: K, v: DraftContent[K]) => setEdit((e) => ({ ...e, [k]: v }));
  const canAct = d.status === "pending" || d.status === "failed";

  async function run(body: Record<string, unknown>, msg: string) {
    setBusy(true);
    const r = await call(`/api/drafts/${d.id}`, "POST", body, msg);
    setBusy(false);
    return r;
  }
  async function save() {
    const changed: Record<string, unknown> = {};
    for (const k of Object.keys(edit) as (keyof DraftContent)[]) if (JSON.stringify(edit[k]) !== JSON.stringify(c[k])) changed[k] = edit[k];
    return run({ action: "edit", content: changed }, "Perubahan disimpan, kartu dirender ulang");
  }
  async function approve(when: "now" | "slot") {
    if (dirty && !(await save())) return;
    if (fc?.verdict === "fail" && !confirm("Pemeriksa fakta menandai masalah serius. Tetap terbitkan?")) return;
    await run({ action: "approve", when, targets }, when === "now" ? "Disetujui — diposting sekarang" : "Disetujui — dijadwalkan ke slot berikutnya");
  }

  return (
    <div className="detail">
      <div className="wrap-row">
        <CatTag c={c.category} />
        <span className="tag">{d.stories?.outlet_count ?? "?"} outlet</span>
        {fc && <span className={`tag ${fc.verdict === "pass" ? "ok" : fc.verdict === "warn" ? "warn" : "bad"}`}>{fc.verdict === "pass" ? "Lolos cek fakta" : fc.verdict === "warn" ? "Ada catatan fakta" : "Cek fakta gagal"}</span>}
        {c.sensitivity === "high" && <span className="tag bad">Sensitif</span>}
        {d.status !== "pending" && <span className="tag">{d.status === "scheduled" && d.scheduled_for ? `Terjadwal ${wib(d.scheduled_for)}` : d.status}</span>}
      </div>
      <h2>{c.hook}</h2>
      <p className="lead" style={{ margin: 0 }}>{c.summary}</p>

      <div className="props">
        <span>Ditulis oleh</span>
        <span className="row">{a ? <><Avatar name={a.name} color={a.color} size={18} /> {a.name}</> : "—"} <span className="faint">· {ago(d.created_at)} lalu</span></span>
        <span>Sumber</span><span>{c.sourceCredit.replace(/^Sumber:\s*/, "")}</span>
        <span>Platform</span>
        <span className="chips">
          {TARGETS.map((t) => (
            <button key={t.id} className="chip" aria-pressed={targets.includes(t.id)} disabled={!canAct}
              onClick={() => setTargets((ts) => (ts.includes(t.id) ? ts.filter((x) => x !== t.id) : [...ts, t.id]))}>{t.label}</button>
          ))}
        </span>
      </div>

      {d.card_urls.length > 0 && <div className="slides">{d.card_urls.map((u, i) => <img key={u} src={u} alt={`Slide ${i + 1}`} loading="lazy" />)}</div>}

      {d.error && <div className="note bad" style={{ marginTop: 10 }}>{d.error}</div>}
      {fc && fc.issues.length > 0 && (
        <div className={`note ${fc.verdict === "fail" ? "bad" : "warn"}`} style={{ marginTop: 10 }}>
          <b>Catatan pemeriksa fakta</b>
          <ul>{fc.issues.map((i, k) => <li key={k}><b>“{i.text}”</b> — {i.problem}</li>)}</ul>
        </div>
      )}

      <details className="fold" style={{ marginTop: 14 }}>
        <summary>Fakta yang dipakai · {c.keyFacts.length}</summary>
        <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>{c.keyFacts.map((f, i) => <li key={i} style={{ margin: "4px 0" }}>{f.claim} <span className="muted">— {f.sources.join(", ")}</span></li>)}</ul>
      </details>

      <details className="fold">
        <summary>Edit teks {dirty && <span className="tag warn">belum disimpan</span>}</summary>
        <Field label="Hook" v={edit.hook} on={(v) => set("hook", v)} rows={2} />
        {edit.carousel.map((s, i) => (
          <div key={i} className="grid g-2" style={{ gap: 8 }}>
            <Field label={`Slide ${i + 1} · judul`} v={s.title} on={(v) => set("carousel", edit.carousel.map((x, k) => (k === i ? { ...x, title: v } : x)))} rows={2} />
            <Field label={`Slide ${i + 1} · isi`} v={s.body ?? ""} on={(v) => set("carousel", edit.carousel.map((x, k) => (k === i ? { ...x, body: v } : x)))} rows={2} />
          </div>
        ))}
        <Field label="Caption Instagram" v={edit.instagramCaption} on={(v) => set("instagramCaption", v)} rows={6} max={2200} />
        <Field label="Threads" v={edit.threadsPost} on={(v) => set("threadsPost", v)} rows={4} max={500} />
        <Field label="Caption TikTok" v={edit.tiktokCaption} on={(v) => set("tiktokCaption", v)} rows={3} max={2200} />
        <Field label="Judul YouTube Shorts" v={edit.video.title} on={(v) => set("video", { ...edit.video, title: v })} rows={1} max={100} />
        {edit.video.scenes.map((s, i) => (
          <Field key={i} label={`Adegan ${i + 1} · teks layar / --- / narasi`} v={`${s.onScreen}\n---\n${s.voiceover}`} rows={3}
            on={(v) => { const [on, vo] = v.split(/\n---\n/); set("video", { ...edit.video, scenes: edit.video.scenes.map((x, k) => (k === i ? { ...x, onScreen: on ?? "", voiceover: vo ?? "" } : x)) }); }} />
        ))}
        <Field label="Hashtag" v={edit.hashtags.join(" ")} on={(v) => set("hashtags", v.split(/\s+/).filter(Boolean))} rows={1} />
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn sm" disabled={!dirty || busy} onClick={save}>Simpan & render ulang</button>
          <button className="btn ghost sm" disabled={!dirty || busy} onClick={() => setEdit(c)}>Batalkan</button>
        </div>
      </details>

      {canAct && (
        <div className="action-bar">
          <button className="btn primary" disabled={busy || !targets.length} onClick={() => approve("now")}><I.check size={14} /> Setujui & posting sekarang</button>
          <button className="btn" disabled={busy || !targets.length} onClick={() => approve("slot")}>Jadwalkan slot berikutnya</button>
          <div className="grow" />
          {d.status === "failed"
            ? <button className="btn" disabled={busy} onClick={() => run({ action: "retry" }, "Dicoba ulang")}>Ulangi yang gagal</button>
            : <button className="btn ghost danger" disabled={busy} onClick={() => run({ action: "reject" }, "Draft ditolak")}>Tolak</button>}
        </div>
      )}
    </div>
  );
}

function Field({ label, v, on, rows = 3, max }: { label: string; v: string; on: (v: string) => void; rows?: number; max?: number }) {
  return (
    <label style={{ display: "block" }}>
      <span className="label row">{label}<span className="grow" />{max && <span style={{ color: v.length > max ? "var(--bad)" : "var(--faint)" }}>{v.length}/{max}</span>}</span>
      {rows === 1 ? <input className="input" value={v} onChange={(e) => on(e.target.value)} /> : <textarea className="textarea" rows={rows} value={v} onChange={(e) => on(e.target.value)} />}
    </label>
  );
}
