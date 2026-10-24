"use client";
import { useState } from "react";
import { captionKit } from "@/lib/captions";
import { I } from "./ui";
import { useWorkspace, type Draft } from "./workspace";

/** Manual posting: download the slides, copy the caption, post it yourself, then mark it as posted. */
export default function PostKit({ d }: { d: Draft }) {
  const { call, say, ws } = useWorkspace();
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const kit = captionKit(d.content);

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove();
    }
    setCopied(id);
    say("Caption disalin");
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
  }

  /** Cross-origin images can't use <a download>, so fetch → blob → save. */
  async function saveSlide(url: string, i: number) {
    const res = await fetch(url);
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `slide-${String(i + 1).padStart(2, "0")}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function posted() {
    setBusy(true);
    await call(`/api/drafts/${d.id}`, "POST", { action: "posted" }, "Ditandai sudah diposting");
    setBusy(false);
  }

  return (
    <div className="postkit">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="tag ok"><I.check size={12} /> Disetujui — siap diposting</span>
        <span className="grow" />
        {ws?.demo ? (
          <span className="faint" style={{ fontSize: 12 }}>Unduh ZIP nonaktif di mode demo</span>
        ) : (
          <a className="btn primary" href={`/api/drafts/${d.id}/zip`}><I.send size={14} /> Unduh semua (ZIP)</a>
        )}
      </div>

      <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>1 · Unduh slide (urutan = urutan carousel)</div>
      <div className="slides">
        {d.card_urls.map((u, i) => (
          <button key={u} className="slide-dl" onClick={() => saveSlide(u, i)} title={`Unduh slide ${i + 1}`}>
            <img src={u} alt={`Slide ${i + 1}`} loading="lazy" />
            <span>Unduh {i + 1}</span>
          </button>
        ))}
      </div>

      <div className="muted" style={{ fontSize: 12, margin: "14px 0 6px" }}>2 · Salin caption</div>
      <div className="grid" style={{ gap: 8 }}>
        {kit.map((k) => (
          <div key={k.id} className="caption-box">
            <div className="row" style={{ marginBottom: 6 }}>
              <b style={{ fontSize: 12.5 }}>{k.label}</b>
              <span className="faint" style={{ fontSize: 11.5 }}>{k.text.length} karakter</span>
              <span className="grow" />
              <button className="btn sm" onClick={() => copy(k.id, k.text)}>{copied === k.id ? <><I.check size={12} /> Tersalin</> : "Salin"}</button>
            </div>
            <pre>{k.text}</pre>
          </div>
        ))}
      </div>

      <div className="muted" style={{ fontSize: 12, margin: "14px 0 6px" }}>3 · Setelah kamu posting</div>
      <button className="btn" disabled={busy} onClick={posted}><I.check size={14} /> Tandai sudah diposting</button>
    </div>
  );
}
