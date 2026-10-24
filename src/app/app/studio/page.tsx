"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Topbar } from "@/components/Shell";
import { Avatar, CATEGORY, I, TARGETS } from "@/components/ui";
import { useWorkspace } from "@/components/workspace";
import { articleToText, BULLET, slidesFromText, slidesToText, storyToText, type BriefArticle } from "@/lib/slides";
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

export default function Page() {
  return <Suspense><Studio /></Suspense>;
}

function Studio() {
  const { ws, call, say } = useWorkspace();
  const designers = ws?.agents.filter((a) => a.kind === "designer") ?? [];
  const [agentId, setAgentId] = useState<string | null>(null);
  const [raw, setRaw] = useState("");
  const [slides, setSlides] = useState<CardSlide[]>([]);
  const [palette, setPalette] = useState({ bg: PALETTES[0].bg, fg: PALETTES[0].fg });
  const [format, setFormat] = useState<DesignFormat>("post");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("umum");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [credit, setCredit] = useState("");
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


  // re-parsing text keeps each slide's photo (matched by position)
  const applyText = (t: string) => {
    setRaw(t);
    setSlides((prev) => slidesFromText(t).map((x, i) => (prev[i]?.image ? { ...x, image: prev[i].image, imageLayout: prev[i].imageLayout } : x)));
  };
  const reset = () => { applyText(""); setFromStory(null); setCaption(""); setTitle(""); setCredit(""); setTags(""); setRawNews(""); setLink(""); setExtra(""); };
  // while typing in the bullets box, blank lines are kept — strip them before preview / save
  const clean = useMemo(() => slides.map((x) => { const b = x.bullets?.map((y) => y.trim()).filter(Boolean); return { ...x, bullets: b?.length ? b : undefined }; }), [slides]);
  const setSlide = (i: number, patch: Partial<CardSlide>) => setSlides((ss) => ss.map((s, k) => (k === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: -1 | 1) => setSlides((ss) => { const n = [...ss]; const j = i + d; if (j < 0 || j >= n.length) return n; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function submit() {
    if (!slides.length) return say("Tambahkan minimal 1 slide");
    setBusy(true);
    const r = await call<{ id: string }>("/api/design", "POST", {
      agent_id: designer?.id ?? null, title: (title.trim() || clean[0]?.title.replace(/\*/g, "") || "Desain").slice(0, 200).padEnd(2, "."), category, slides: clean, palette, format, caption, sourceCredit: credit, targets,
      hashtags: tags.split(/\s+/).filter(Boolean),
    }, "Desain dikirim ke Inbox untuk disetujui");
    setBusy(false);
    if (r?.id) window.location.href = `/app/inbox?i=d:${r.id}`;
  }

  const designer = designers.find((d) => d.id === agentId) ?? designers[0];
  return (
    <>
      <Topbar title="Studio desain">
        {designer && <span className="row muted"><Avatar name={designer.name} color={designer.color} size={18} /> <span className="hide-sm">{designer.name} siap mendesain</span></span>}
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
              <button className="btn ghost sm" onClick={reset}>Kosongkan semua</button>
            </div>
          </div>

          {fromStory && (
            <div className="note" style={{ marginBottom: 12 }}>
              Diisi dari <b>“{fromStory.headline}”</b> ({fromStory.from}).
              {fromStory.ai ? " Sudah diringkas Dita — cek angka & nama, lalu unduh." : ws?.config.contentLang === "id" ? " Rapikan seperlunya, lalu unduh." : " Teks masih bahasa sumber — terjemahkan ke Inggris & rapikan, lalu unduh."}
            </div>
          )}
          <div className="seg" style={{ marginBottom: 6 }}>
            <button aria-pressed={mode === "text"} onClick={() => { if (mode === "slides") setRaw(slidesToText(slides.map((x) => ({ ...x, bullets: x.bullets?.filter((b) => b.trim()) })))); setMode("text"); }}>Tempel teks</button>
            <button aria-pressed={mode === "slides"} onClick={() => setMode("slides")}>Edit per slide ({slides.length})</button>
          </div>

          {mode === "text" ? (
            <>
              <textarea className="textarea mono" rows={14} value={raw} onChange={(e) => applyText(e.target.value)} aria-label="Teks desain" style={{ fontSize: 12.5 }}
                placeholder={"Tulis atau tempel teks slide di sini.\n\nJudul slide 1\nIsi singkat\n\n#Label\nJudul slide 2\n- Poin: nilai"} />
              <div className="faint" style={{ fontSize: 12, lineHeight: 1.6, marginTop: 6 }}>
                Baris kosong = slide baru · baris pertama = judul, sisanya isi · <span className="mono">#Label</span> = label kecil ·{" "}
                <span className="mono">&gt; teks</span> = kutipan · <span className="mono">*kata*</span> = sorotan blok warna ·{" "}
                <span className="mono">- Label: nilai</span> = poin / daftar harga
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
                  <textarea className="textarea" rows={Math.min(8, Math.max(2, (s.bullets?.length ?? 0) + 1))} placeholder={"Poin (opsional) — satu per baris\niPhone Duo 256 GB: Rp 45.678.910"} value={(s.bullets ?? []).join("\n")}
                    onChange={(e) => { const b = e.target.value.split("\n").map((x) => x.replace(BULLET, "")); setSlide(i, { bullets: b.some((x) => x.trim()) ? b : undefined }); }}
                    style={{ minHeight: 0, marginTop: 6 }} aria-label={`Poin slide ${i + 1}`} />
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
              <div><label className="label">Nama desain</label><input className="input" value={title} placeholder="Otomatis dari judul slide 1" onChange={(e) => setTitle(e.target.value)} /></div>
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

        <Preview slides={clean} palette={palette} format={format} credit={credit} ratio={FORMATS.find((f) => f.id === format)!.ratio}
          onImage={(i, patch) => setSlides((ss) => ss.map((x, k) => (k === i ? (patch ? { ...x, ...patch } : { ...x, image: undefined, imageLayout: undefined }) : x)))}
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

const LAYOUTS: { id: NonNullable<CardSlide["imageLayout"]>; label: string }[] = [
  { id: "top", label: "Atas" },
  { id: "bottom", label: "Bawah" },
  { id: "left", label: "Kiri" },
  { id: "right", label: "Kanan" },
  { id: "full", label: "Penuh" },
];

/** Resize to ≤1600px and re-encode as JPEG in the browser (phones' 5–10MB photos → ~300KB). */
async function compressImage(file: File, max = 1600, quality = 0.85): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise<HTMLImageElement>((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url; });
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(im.naturalWidth * k);
    c.height = Math.round(im.naturalHeight * k);
    c.getContext("2d")!.drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Preview({ slides, palette, format, credit, ratio, caption, onCopied, onImage }: {
  slides: CardSlide[]; palette: { bg: string; fg: string }; format: DesignFormat; credit: string; ratio: string; caption: string; onCopied: () => void;
  onImage: (index: number, patch: Partial<CardSlide> | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [urls, setUrls] = useState<(string | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const key = useMemo(() => JSON.stringify({ slides, palette, format, credit }), [slides, palette, format, credit]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const live = useRef<string[]>([]);
  const track = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => { if (active > slides.length - 1) go(Math.max(0, slides.length - 1)); }, [slides.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // which slide is centred in the swipe track
  function onScroll() {
    const el = track.current;
    if (!el) return;
    const items = Array.from(el.children) as HTMLElement[];
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    items.forEach((c, i) => { if (Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid) < Math.abs(items[best].offsetLeft + items[best].offsetWidth / 2 - mid)) best = i; });
    if (best !== active) setActive(best);
  }
  function go(i: number) {
    const el = track.current;
    const c = el?.children[i] as HTMLElement | undefined;
    if (!el || !c) return;
    el.scrollTo({ left: c.offsetLeft - (el.clientWidth - c.offsetWidth) / 2, behavior: "smooth" });
    setActive(i);
  }

  const name = (i: number) => `desain-${String(i + 1).padStart(2, "0")}.png`;
  function downloadAll() {
    urls.forEach((u, i) => {
      if (!u) return;
      const a = document.createElement("a");
      a.href = u;
      a.download = name(i);
      document.body.appendChild(a);
      a.click();
      a.remove();
    });
  }
  const copy = () => navigator.clipboard.writeText(caption).then(onCopied);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    const at = active;
    setImgError(null);
    setUploading(true);
    try {
      const dataUrl = await compressImage(file);
      // store it so drafts keep a small URL; demo / no storage → keep the compressed image inline
      const res = await fetch("/api/design/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }) }).catch(() => null);
      const j = (await res?.json().catch(() => null)) as { url?: string } | null;
      onImage(at, { image: res?.ok && j?.url ? j.url : dataUrl, imageLayout: slides[at]?.imageLayout ?? "top" });
    } catch {
      setImgError("Gambar tidak bisa dibaca — coba JPG atau PNG");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  const cur = slides[active];

  return (
    <div className="studio-preview">
      <div className="row preview-head">
        <span className="muted">{slides.length ? `${active + 1} / ${slides.length}` : "0 slide"} {loading && <span className="faint">· merender…</span>}</span>
        {urls[active] && <a className="btn ghost sm one-dl" href={urls[active]!} download={name(active)}>↓ Slide ini</a>}
        <span className="grow" />
        <button className="btn sm" onClick={copy}>Salin caption</button>
        <button className="btn sm primary" disabled={!urls.some(Boolean)} onClick={downloadAll}>Unduh semua</button>
      </div>

      {slides.length === 0 && (
        <div className="preview-empty" style={{ aspectRatio: ratio }}>
          <div>Belum ada slide</div>
          <span>Tempel teks berita atau tulis slide di kolom teks — pratinjau muncul di sini.</span>
        </div>
      )}

      <div className={`swipe ${format}`} hidden={slides.length === 0}>
        <button className="swipe-nav prev" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Slide sebelumnya">‹</button>
        <div className="swipe-track" ref={track} onScroll={onScroll}>
          {slides.map((_, i) => (
            <div key={i} className="swipe-item" aria-current={i === active}>
              <div className="preview-frame" style={{ aspectRatio: ratio, background: palette.bg }}>
                {urls[i] ? <img src={urls[i]!} alt={`Slide ${i + 1}`} draggable={false} /> : <div className="frame-loading" />}
              </div>
            </div>
          ))}
        </div>
        <button className="swipe-nav next" onClick={() => go(active + 1)} disabled={active >= slides.length - 1} aria-label="Slide berikutnya">›</button>
      </div>

      {cur && (
        <div className="img-tools">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickImage(e.target.files?.[0])} />
          <button className="btn sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
            {uploading ? "Mengunggah…" : cur.image ? "Ganti gambar" : `+ Gambar di slide ${active + 1}`}
          </button>
          {cur.image && (
            <>
              <div className="seg" role="group" aria-label="Posisi gambar">
                {LAYOUTS.map((l) => <button key={l.id} aria-pressed={(cur.imageLayout ?? "top") === l.id} onClick={() => onImage(active, { imageLayout: l.id })}>{l.label}</button>)}
              </div>
              <button className="btn ghost sm" onClick={() => onImage(active, null)} aria-label="Hapus gambar">Hapus</button>
            </>
          )}
          {imgError && <span className="faint" style={{ color: "var(--bad)", fontSize: 12 }}>{imgError}</span>}
        </div>
      )}

      {slides.length > 1 && (
        <div className="dots" role="tablist">
          {slides.map((_, i) => <button key={i} role="tab" aria-selected={i === active} aria-label={`Ke slide ${i + 1}`} onClick={() => go(i)} />)}
        </div>
      )}

      <div className="thumbs">
        {slides.map((_, i) => (
          <button key={i} className="thumb" aria-pressed={i === active} onClick={() => go(i)} style={{ aspectRatio: ratio, background: palette.bg }} aria-label={`Slide ${i + 1}`}>
            {urls[i] && <img src={urls[i]!} alt="" />}
          </button>
        ))}
      </div>

      {/* phone: big thumb-reachable actions */}
      {slides.length > 0 && <div className="mobile-actions">
        <button className="btn" onClick={copy}>Salin caption</button>
        <button className="btn primary" disabled={!urls.some(Boolean)} onClick={downloadAll}>{`Unduh ${slides.length} slide`}</button>
      </div>}
    </div>
  );
}
