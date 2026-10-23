"use client";
import { useState } from "react";
import type { Agent, AgentSettings } from "@/lib/agents";
import { Avatar, CATEGORY, TARGETS } from "./ui";

export type AgentDraft = Pick<Agent, "name" | "role" | "color" | "status" | "platforms" | "categories" | "responsibilities"> & { settings: AgentSettings };

export const COLORS = ["#5E6AD2", "#4CB782", "#E467B4", "#F2994A", "#4EA7FC", "#EB5757", "#A78BFA", "#26B5CE"];

export const blankAgent = (): AgentDraft => ({
  name: "",
  role: "",
  color: COLORS[Math.floor(Math.random() * COLORS.length)],
  status: "active",
  platforms: ["instagram:carousel", "threads:text"],
  categories: [],
  responsibilities: ["Memantau berita terbaru di kategori yang ditugaskan", "Menulis draft konten dan mengajukannya untuk disetujui", "Mengirim laporan harian"],
  settings: { minSources: 2, minSourcesPolitics: 3, maxDraftsPerDay: 8, reportHour: 7 },
});

/** Shared form for hiring a new bot and editing an existing one. */
export default function AgentForm({ value, onChange }: { value: AgentDraft; onChange: (v: AgentDraft) => void }) {
  const [newResp, setNewResp] = useState("");
  const v = value;
  const set = <K extends keyof AgentDraft>(k: K, x: AgentDraft[K]) => onChange({ ...v, [k]: x });
  const setS = <K extends keyof AgentSettings>(k: K, x: number) => onChange({ ...v, settings: { ...v.settings, [k]: x } });
  const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  return (
    <div>
      <div className="row" style={{ marginTop: 14, gap: 12 }}>
        <Avatar name={v.name || "?"} color={v.color} size={44} status={v.status} />
        <div className="grow grid g-2" style={{ gap: 8 }}>
          <input className="input" placeholder="Nama (mis. Sinta)" value={v.name} onChange={(e) => set("name", e.target.value)} aria-label="Nama" />
          <input className="input" placeholder="Jabatan (mis. Spesialis TikTok Olahraga)" value={v.role} onChange={(e) => set("role", e.target.value)} aria-label="Jabatan" />
        </div>
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        {COLORS.map((c) => (
          <button key={c} onClick={() => set("color", c)} aria-label={`Warna ${c}`}
            style={{ width: 20, height: 20, borderRadius: "50%", background: c, border: v.color === c ? "2px solid #fff" : "2px solid transparent", cursor: "pointer" }} />
        ))}
      </div>

      <label className="label">Platform yang dipegang</label>
      <div className="chips">{TARGETS.map((t) => <button key={t.id} className="chip" aria-pressed={v.platforms.includes(t.id)} onClick={() => set("platforms", toggle(v.platforms, t.id))}>{t.label}</button>)}</div>

      <label className="label">Kategori berita <span className="faint">(kosong = semua kategori)</span></label>
      <div className="chips">{Object.entries(CATEGORY).map(([k, l]) => <button key={k} className="chip" aria-pressed={v.categories.includes(k)} onClick={() => set("categories", toggle(v.categories, k))}>{l}</button>)}</div>

      <label className="label">Tanggung jawab</label>
      <ul className="resp" style={{ marginBottom: 8 }}>
        {v.responsibilities.map((r, i) => (
          <li key={i} className="row" style={{ alignItems: "center" }}>
            <input className="input" value={r} onChange={(e) => set("responsibilities", v.responsibilities.map((x, k) => (k === i ? e.target.value : x)))} aria-label={`Tanggung jawab ${i + 1}`} />
            <button className="btn ghost sm" onClick={() => set("responsibilities", v.responsibilities.filter((_, k) => k !== i))} aria-label="Hapus">✕</button>
          </li>
        ))}
      </ul>
      <div className="row">
        <input className="input" placeholder="Tambah tanggung jawab…" value={newResp} onChange={(e) => setNewResp(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && newResp.trim()) { set("responsibilities", [...v.responsibilities, newResp.trim()]); setNewResp(""); } }} />
        <button className="btn sm" disabled={!newResp.trim()} onClick={() => { set("responsibilities", [...v.responsibilities, newResp.trim()]); setNewResp(""); }}>Tambah</button>
      </div>

      <div className="grid g-4" style={{ gap: 8 }}>
        <Num label="Min. outlet" v={v.settings.minSources} on={(x) => setS("minSources", x)} min={1} max={10} />
        <Num label="Min. outlet politik" v={v.settings.minSourcesPolitics} on={(x) => setS("minSourcesPolitics", x)} min={1} max={10} />
        <Num label="Maks. draft/hari" v={v.settings.maxDraftsPerDay} on={(x) => setS("maxDraftsPerDay", x)} min={0} max={100} />
        <Num label="Jam laporan (WIB)" v={v.settings.reportHour} on={(x) => setS("reportHour", x)} min={0} max={23} />
      </div>
    </div>
  );
}

function Num({ label, v, on, min, max }: { label: string; v: number; on: (n: number) => void; min: number; max: number }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input" type="number" min={min} max={max} value={v} onChange={(e) => on(Math.max(min, Math.min(max, Number(e.target.value) || 0)))} />
    </div>
  );
}
