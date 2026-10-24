"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Topbar } from "@/components/Shell";
import { Avatar, CATEGORY, I, TARGETS } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { articleToText, slidesFromText, storyToText, type BriefArticle } from "@/lib/slides";
import { DEFAULT_FORMAT, summarizeRaw, type SummaryFormat } from "@/lib/summarize";

type StudioAI = { title: string; text: string; caption: string; hashtags: string[]; credit: string };
import type { CardSlide } from "@/lib/types";
import { PALETTES, type DesignFormat } from "@/pipeline/twotone";

const KINDS: { id: CardSlide["kind"]; label: string }[] = [
  { id: "cover", label: "Cover" },
  { id: "point", label: "Poin" },
  { id: "quote", label: "Kutipan" },
  { id: "closing", label: "Penutup" },
];
const FORMATS: { id: DesignFormat; label: string; ratio: string }[] = [
  { id: "post", label: "Carousel 4:5", ratio: "4 / 5" },
  { id: "square", label: "Kotak 1:1", ratio: "1 / 1" },
  { id: "story", label: "Story 9:16", ratio: "9 / 16" },
];

const SAMPLE = `#Bundesliga
Without *Kevin Diks*, Gladbach finally win!
Gladbach beat Stuttgart 3-2 away for their first win of the season.

#Full time
Stuttgart *2-3* Gladbach
Bundesliga matchday 7 at the MHPArena.

#Kevin Diks
Out for *personal reasons*
The Indonesia national team defender was left out of the squad.

Will Diks be back next match?
Drop your prediction in the comments.`;

export default function Page() {
  return <Suspense><Studio /></Suspense>;
}

function Studio() {
  const { ws, call, say } = useWorkspace();
  const designers = ws?.agents.filter((a) => a.kind === "designer") ?? [];
  const [agentId, setAgentId] = useState<string | null>(null);
  const [raw, setRaw] = useState(SAMPLE);
  const [slides, setSlides] = useState<CardSlide[]>(() => slidesFromText(SAMPLE));
  const [palette, setPalette] = useState({ bg: PALETTES[0].bg, fg: PALETTES[0].fg });
  const [format, setFormat] = useState<DesignFormat>("post");
  const [title, setTitle] = useState("Stuttgart vs Gladbach");
  const [category, setCategory] = useState("olahraga");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("#Bundesliga #KevinDiks #Gladbach #Indonesia");
  const [credit, setCredit] = useState("Source: detikSport");
  const storyId = useSearchParams().get("story");
  const [fromStory, setFromStory] = useState<{ headline: string; from: string; ai?: boolean } | null>(null);
  const [src, setSrc] = useState<"raw" | "link" | "hot">("raw");
  const [rawNews, setRawNews] = useState("");
  const [fmt, setFmt] = useState<SummaryFormat>(DEFAULT_FORMAT);
  const [extra, setExtra] = useState("");
  const [link, setLink] = useState("");
  const [fetching, setFetching] = useState(false);
  const lang = ws?.config.contentLang === "id" ? "id" : "en";

  const fill = (built: { text: string; credit: string; caption: string }, headline: string, from: string, cat?: string, ai = false) => {
    setRaw(built.text);
    setSlides(slidesFromText(built.text));
    setTitle(headline.slice(0, 120));
    if (cat) setCategory(cat);
    setCredit(built.credit);
    setCaption(built.caption);
    setMode("text");
    setFromStory({ headline, from, ai });
  };

  // Raw pasted text → Dita summarises in the chosen format
  function summarizeLocal(note?: string) {
    const out = summarizeRaw(rawNews, fmt, lang);
    if (!out) return say("Teks tidak bisa diringkas — pastikan berisi kalimat lengkap");
    fill(out, out.title, note ?? "ringkasan cepat");
  }
  async function summarizeAI() {
    setFetching(true);
    const res = await fetch("/api/design/summarize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ raw: rawNews, format: fmt, lang, extra }) }).catch(() => null);
    setFetching(false);
    const j = (await res?.json().catch(() => null)) as (StudioAI & { error?: string }) | null;
    if (!res?.ok || !j || j.error) {
      say(`${j?.error ?? "AI gagal"} — pakai ringkasan cepat`);
      return summarizeLocal("ringkasan cepat — AI tidak tersedia");
    }
    fill(j, j.title, "diringkas Dita via AI", undefined, true);
    if (j.hashtags?.length) setTags(j.hashtags.join(" "));
  }

  // Pick a hot story (or arrive via "Kirim ke Dita"): pre-fill from the story's articles, no AI needed
  async function loadStory(id: string) {
    if (!id) return;
    setFetching(true);
    const res = await fetch(`/api/stories/${id}/brief`, { cache: "no-store" }).catch(() => null);
    setFetching(false);
    if (!res?.ok) return say("Gagal mengambil berita");
    const { story, articles } = (await res.json()) as { story: { headline: string; category: string; outlet_count: number }; articles: BriefArticle[] };
    fill(storyToText(story, articles, lang, CATEGORY[story.category] ?? "News"), story.headline, `${story.outlet_count} outlet`, story.category);
  }

  // Paste a news link: read the article and pre-fill
  async function loadLink() {
    if (!link.trim()) return;
    setFetching(true);
    const res = await fetch("/api/design/from-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: link.trim() }) }).catch(() => null);
    setFetching(false);
    const j = (await res?.json().catch(() => null)) as { title: string; text: string; outlet: string; error?: string } | null;
    if (!res?.ok || !j || j.error) return say(j?.error ?? "Gagal membaca link");
    fill(articleToText(j, lang), j.title, j.outlet);
    setLink("");
  }

  useEffect(() => {
    if (storyId) loadStory(storyId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);
  const [targets, setTargets] = useState<string[]>(["instagram:carousel", "threads:carousel"]);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"text" | "slides">("text");


  const applyText = (t: string) => { setRaw(t); setSlides(slidesFromText(t)); };
  const setSlide = (i: number, patch: Partial<CardSlide>) => setSlides((ss) => ss.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => setSlides((ss) => { const n = [...ss]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function submit() {
    if (!slides.length) return say("Tambahkan minimal 1 slide");
    setBusy(true);
    const r = await call<{ id: string }>("/api/design", "POST", {
      agent_id: designer?.id ?? null, title, category, slides, palette, format, caption, sourceCredit: credit, targets,
      hashtags: tags.split(/\s+/).filter(Boolean),
    }, "Desain dikirim ke Inbox untuk disetujui");
    setBusy(false);
    if (r?.id) window.location.href = `/app/inbox?i=d:${r.id}`;
  }

  const designer = designers.find((d) => d.id === agentId) ?? designers[0];
  return (
    <>
      <Topbar title="Studio desain">
        {designer && <span className="row muted"><Avatar name={designer.name} color={designer.color} size={18} /> {designer.name} siap mendesain</span>}
      </Topbar>
      <div className="studio">
        <div className="studio-form">
          {designers.length === 0 && (
            <div className="note warn" style={{ marginBottom: 12 }}>
              Belum ada karyawan desainer. <Link href="/app/agents?hire=1" style={{ color: "var(--accent-2)" }}>Rekrut satu</Link> dan pilih jenis “Desainer”.
            </div>
          )}

          <div className="card card-b source-box">
            <div className="seg" style={{ marginBottom: 8 }}>
              <button aria-pressed={src === "raw"} onClick={() => setSrc("raw")}>Teks mentah</button>
              <button aria-pressed={src === "link"} onClick={() => setSrc("link")}>Link</button>
              <button aria-pressed={src === "hot"} onClick={() => setSrc("hot")}>Berita terpanas</button>
            </div>

            {src === "raw" && (
              <>
                <textarea className="textarea" rows={6} placeholder="Tempel teks berita apa adanya — judul di baris pertama, lalu isi artikel. Dita yang meringkas." value={rawNews} onChange={(e) => setRawNews(e.target.value)} aria-label="Teks berita mentah" />
                <div className="grid g-2" style={{ gap: 8, marginTop: 8 }}>
                  <div><label className="label" style={{ marginTop: 0 }}>Jumlah slide</label>
                    <div className="seg">{[4, 5, 6, 8].map((n) => <button key={n} aria-pressed={fmt.slides === n} onClick={() => setFmt({ ...fmt, slides: n })}>{n}</button>)}</div>
                  </div>
                  <div><label className="label" style={{ marginTop: 0 }}>Penutup</label>
                    <select className="select" value={fmt.closing} onChange={(e) => setFmt({ ...fmt, closing: e.target.value as SummaryFormat["closing"] })}>
                      <option value="question">Pertanyaan ke audiens</option>
                      <option value="follow">Ajakan follow</option>
                      <option value="none">Tanpa penutup</option>
                    </select>
                  </div>
                </div>
                <div className="row" style={{ marginTop: 8, fontSize: 12.5, gap: 14 }}>
                  <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={fmt.quote} onChange={(e) => setFmt({ ...fmt, quote: e.target.checked })} /> Slide kutipan</label>
                  <label className="row" style={{ gap: 6 }}><input type="checkbox" checked={fmt.labels === "numbered"} onChange={(e) => setFmt({ ...fmt, labels: e.target.checked ? "numbered" : "none" })} /> Label kecil</label>
                </div>
                <input className="input" style={{ marginTop: 8 }} placeholder="Instruksi tambahan untuk AI (opsional), mis. fokus ke angka penonton" value={extra} onChange={(e) => setExtra(e.target.value)} aria-label="Instruksi tambahan" />
                <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
                  <button className="btn sm primary" disabled={fetching || rawNews.trim().length < 80} onClick={summarizeAI}>{fetching ? "Dita meringkas…" : `Ringkas + ${lang === "en" ? "terjemahkan " : ""}via AI`}</button>
                  <button className="btn sm" disabled={rawNews.trim().length < 80} onClick={() => summarizeLocal()}>Ringkas cepat (tanpa AI)</button>
                </div>
              </>
            )}

            {src === "link" && (
              <div className="row">
                <input className="input" placeholder="Tempel link berita" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadLink()} aria-label="Link berita" />
                <button className="btn sm" disabled={fetching || !link.trim()} onClick={loadLink}>{fetching ? "Membaca…" : "Ambil"}</button>
              </div>
            )}

            {src === "hot" && (
              <select className="select" value="" disabled={fetching} onChange={(e) => loadStory(e.target.value)} aria-label="Pilih berita terpanas">
                <option value="">🔥 Pilih dari berita terpanas…</option>
                {(ws?.stories ?? []).slice(0, 20).map((st) => <option key={st.id} value={st.id}>{st.headline.slice(0, 90)}</option>)}
              </select>
            )}

            <div className="row" style={{ marginTop: 6, fontSize: 12 }}>
              <button className="btn ghost sm" onClick={() => { applyText(""); setFromStory(null); setCaption(""); setTitle("Desain baru"); }}>Kosongkan slide</button>
              <button className="btn ghost sm" onClick={() => { applyText(SAMPLE); setFromStory(null); }}>Contoh format</button>
            </div>
          </div>

          {fromStory && (
            <div className="note" style={{ marginBottom: 12 }}>
              Diisi dari <b>“{fromStory.headline}”</b> ({fromStory.from}).
              {fromStory.ai ? " Sudah diringkas Dita — cek angka & nama, lalu unduh." : ws?.config.contentLang === "id" ? " Rapikan seperlunya, lalu unduh." : " Teks masih bahasa sumber — terjemahkan ke Inggris & rapikan, lalu unduh."}
            </div>
          )}
          <div className="seg" style={{ marginBottom: 6 }}>
            <button aria-pressed={mode === "text"} onClick={() => setMode("text")}>Tempel teks</button>
            <button aria-pressed={mode === "slides"} onClick={() => setMode("slides")}>Edit per slide ({slides.length})</button>
          </div>

          {mode === "text" ? (
            <>
              <textarea className="textarea mono" rows={14} value={raw} onChange={(e) => applyText(e.target.value)} aria-label="Teks desain" style={{ fontSize: 12.5 }} />
              <div className="faint" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>
                Baris kosong = slide baru · baris pertama = judul, sisanya isi · <span className="mono">#Label</span> = label kecil ·{" "}
                <span className="mono">&gt; teks</span> = kutipan · <span className="mono">*kata*</span> = sorotan blok warna
              </div>
            </>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {slides.map((s, i) => (
                <div key={i} className="card card-b" style={{ padding: 10 }}>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <b style={{ width: 22 }}>{i + 1}</b>
                    <select className="select" style={{ width: "auto", height: 26, padding: "0 6px" }} value={s.kind} onChange={(e) => setSlide(i, { kind: e.target.value as CardSlide["kind"] })} aria-label="Jenis slide">
                      {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
                    </select>
                    <input className="input" style={{ height: 26, padding: "0 8px" }} placeholder="Label kecil" value={s.kicker ?? ""} onChange={(e) => setSlide(i, { kicker: e.target.value || undefined })} />
                    <button className="btn ghost sm" onClick={() => move(i, -1)} aria-label="Naik">↑</button>
                    <button className="btn ghost sm" onClick={() => move(i, 1)} aria-label="Turun">↓</button>
                    <button className="btn ghost sm" onClick={() => setSlides((ss) => ss.filter((_, k) => k !== i))} aria-label="Hapus">✕</button>
                  </div>
                  <textarea className="textarea" rows={2} placeholder="Judul — pakai *kata* untuk sorotan" value={s.title} onChange={(e) => setSlide(i, { title: e.target.value })} style={{ minHeight: 0 }} />
                  <textarea className="textarea" rows={2} placeholder="Isi (opsional)" value={s.body ?? ""} onChange={(e) => setSlide(i, { body: e.target.value || undefined })} style={{ minHeight: 0, marginTop: 6 }} />
                </div>
              ))}
              <button className="btn" onClick={() => setSlides((ss) => [...ss, { kind: "point", title: "Judul slide baru" }])}><I.plus size={14} /> Tambah slide</button>
            </div>
          )}

          <label className="label">Palet 2 warna</label>
          <div className="palettes">
            {PALETTES.map((p) => (
              <button key={p.name} className="swatch" title={p.name} aria-pressed={palette.bg === p.bg && palette.fg === p.fg} onClick={() => setPalette({ bg: p.bg, fg: p.fg })}>
                <span style={{ background: p.bg }} /><span style={{ background: p.fg }} />
              </button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <label className="row color-pick">Latar <input type="color" value={palette.bg} onChange={(e) => setPalette((p) => ({ ...p, bg: e.target.value.toUpperCase() }))} /> <span className="mono faint">{palette.bg}</span></label>
            <label className="row color-pick">Teks <input type="color" value={palette.fg} onChange={(e) => setPalette((p) => ({ ...p, fg: e.target.value.toUpperCase() }))} /> <span className="mono faint">{palette.fg}</span></label>
            <button className="btn ghost sm" onClick={() => setPalette((p) => ({ bg: p.fg, fg: p.bg }))}>⇄ Tukar</button>
          </div>
          <Contrast bg={palette.bg} fg={palette.fg} />

          <label className="label">Format</label>
          <div className="seg">{FORMATS.map((f) => <button key={f.id} aria-pressed={format === f.id} onClick={() => setFormat(f.id)}>{f.label}</button>)}</div>

          <details className="fold" style={{ marginTop: 16 }} open>
            <summary>Detail posting</summary>
            <div className="grid g-2" style={{ gap: 8 }}>
              <div><label className="label">Nama desain</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div><label className="label">Kategori</label>
                <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{Object.entries(CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </div>
            </div>
            <label className="label">Sumber (tampil di kartu)</label>
            <input className="input" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="Source: …" />
            <label className="label">Caption <span className="faint">(kosong = dibuat dari judul slide)</span></label>
            <textarea className="textarea" rows={4} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <label className="label">Hashtag</label>
            <input className="input" value={tags} onChange={(e) => setTags(e.target.value)} />
            <label className="label">Platform</label>
            <div className="chips">{TARGETS.map((t) => <button key={t.id} className="chip" aria-pressed={targets.includes(t.id)} onClick={() => setTargets((ts) => (ts.includes(t.id) ? ts.filter((x) => x !== t.id) : [...ts, t.id]))}>{t.label}</button>)}</div>
            {designers.length > 1 && (
              <>
                <label className="label">Dikerjakan oleh</label>
                <select className="select" value={designer?.id ?? ""} onChange={(e) => setAgentId(e.target.value || null)}>{designers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
              </>
            )}
          </details>

          <div className="action-bar">
            <button className="btn" disabled={busy || !slides.length} onClick={submit} title="Opsional — kamu juga bisa langsung unduh PNG & salin caption di panel pratinjau"><I.inbox size={14} /> {busy ? "Menyimpan…" : "Simpan ke Siap posting"}</button>
          </div>
        </div>

        <Preview slides={slides} palette={palette} format={format} credit={credit} ratio={FORMATS.find((f) => f.id === format)!.ratio}
          caption={`${(caption.trim() || slides.map((s) => s.title.replace(/\*/g, "")).slice(0, 2).join(" — "))}${tags.trim() ? `\n\n${tags.trim()}` : ""}`} onCopied={() => say("Caption disalin")} />
      </div>
    </>
  );
}

/** WCAG contrast ratio between the two colours, so text stays readable. */
function Contrast({ bg, fg }: { bg: string; fg: string }) {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [a, b] = [lum(bg), lum(fg)].sort((x, y) => y - x);
  const ratio = (a + 0.05) / (b + 0.05);
  const ok = ratio >= 4.5;
  return <div className={`tag ${ok ? "ok" : "warn"}`} style={{ marginTop: 8 }}>Kontras {ratio.toFixed(1)}:1 · {ok ? "mudah dibaca" : "kurang kontras — teks kecil sulit dibaca"}</div>;
}

function Preview({ slides, palette, format, credit, ratio, caption, onCopied }: { slides: CardSlide[]; palette: { bg: string; fg: string }; format: DesignFormat; credit: string; ratio: string; caption: string; onCopied: () => void }) {
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const key = useMemo(() => JSON.stringify({ slides, palette, format, credit }), [slides, palette, format, credit]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef<string[]>([]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setLoading(true);
      const out = await Promise.all(
        slides.map(async (slide, index) => {
          if (!slide.title.trim()) return null;
          const res = await fetch("/api/design/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slide, palette, format, index, total: slides.length, sourceCredit: credit }),
          }).catch(() => null);
          return res?.ok ? URL.createObjectURL(await res.blob()) : null;
        })
      );
      live.current.forEach((u) => URL.revokeObjectURL(u));
      live.current = out.filter((u): u is string => !!u);
      setUrls(out);
      setLoading(false);
    }, 450);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function downloadAll() {
    urls.forEach((u, i) => {
      if (!u) return;
      const a = document.createElement("a");
      a.href = u;
      a.download = `desain-${String(i + 1).padStart(2, "0")}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }

  return (
    <div className="studio-preview">
      <div className="row" style={{ marginBottom: 10 }}>
        <span className="muted">{slides.length} slide {loading && "· merender…"}</span>
        <span className="grow" />
        <button className="btn sm" onClick={() => navigator.clipboard.writeText(caption).then(onCopied)}>Salin caption</button>
        <button className="btn sm primary" disabled={!urls.some(Boolean)} onClick={downloadAll}>Unduh semua PNG</button>
      </div>
      <div className={`preview-grid ${format}`}>
        {slides.map((_, i) => (
          <div key={i} className="preview-item">
            <div className="preview-frame" style={{ aspectRatio: ratio, background: palette.bg }}>
              {urls[i] && <img src={urls[i]!} alt={`Slide ${i + 1}`} />}
            </div>
            <div className="row" style={{ marginTop: 4, fontSize: 12 }}>
              <span className="faint">Slide {i + 1}</span><span className="grow" />
              {urls[i] && <a className="faint" href={urls[i]!} download={`desain-${String(i + 1).padStart(2, "0")}.png`}>Unduh</a>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
