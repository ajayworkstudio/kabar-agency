"use client";
import { useState } from "react";
import { num } from "./ui";

const shortDay = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" });

/** Smooth area chart for one series over days, with hover readout. */
export function AreaChart({ data, color = "#5e6ad2", height = 180, label }: { data: { day: string; value: number }[]; color?: string; height?: number; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = height, pl = 34, pr = 8, pt = 12, pb = 22;
  const max = Math.max(1, ...data.map((d) => d.value));
  const nice = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / nice) * nice;
  const x = (i: number) => pl + (i * (W - pl - pr)) / Math.max(1, data.length - 1);
  const y = (v: number) => pt + (1 - v / top) * (H - pt - pb);
  const pts = data.map((d, i) => [x(i), y(d.value)] as const);
  const line = pts.map((p, i) => {
    if (i === 0) return `M${p[0]},${p[1]}`;
    const [px, py] = pts[i - 1];
    const cx = (px + p[0]) / 2;
    return `C${cx},${py} ${cx},${p[1]} ${p[0]},${p[1]}`;
  }).join(" ");
  const area = `${line} L${x(data.length - 1)},${H - pb} L${x(0)},${H - pb} Z`;
  const id = `g${color.replace("#", "")}`;
  const h = hover != null ? data[hover] : null;

  return (
    <div style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(((px - pl) / (W - pl - pr)) * (data.length - 1)))));
        }}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.35" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="grid-line" x1={pl} x2={W - pr} y1={y(top * f)} y2={y(top * f)} />
            <text x={pl - 6} y={y(top * f) + 3} textAnchor="end">{num(top * f)}</text>
          </g>
        ))}
        {data.map((d, i) => (i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && <text key={d.day} x={x(i)} y={H - 6} textAnchor="middle">{shortDay(d.day)}</text>)}
        <path d={area} fill={`url(#${id})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2" />
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pt} y2={H - pb} stroke="rgba(255,255,255,0.18)" />
            <circle cx={x(hover)} cy={y(data[hover].value)} r="4" fill={color} stroke="#08090a" strokeWidth="2" />
          </g>
        )}
      </svg>
      {h && (
        <div className="note" style={{ position: "absolute", top: 0, right: 0, padding: "4px 8px", fontSize: 12 }}>
          {shortDay(h.day)} · <b>{num(h.value)}</b> {label.toLowerCase()}
        </div>
      )}
    </div>
  );
}

/** Grouped daily bars (e.g. drafts written vs. published). */
export function BarsChart({ data, series, height = 180 }: { data: Record<string, number | string>[]; series: { key: string; label: string; color: string }[]; height?: number }) {
  const W = 640, H = height, pl = 24, pr = 4, pt = 10, pb = 22;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => Number(d[s.key]) || 0)));
  const slot = (W - pl - pr) / data.length;
  const bw = Math.min(10, (slot - 6) / series.length);
  const y = (v: number) => pt + (1 - v / max) * (H - pt - pb);
  return (
    <>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={series.map((s) => s.label).join(" vs ")}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line className="grid-line" x1={pl} x2={W - pr} y1={y(max * f)} y2={y(max * f)} />
            <text x={pl - 6} y={y(max * f) + 3} textAnchor="end">{Math.round(max * f)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = pl + slot * i + slot / 2;
          return (
            <g key={String(d.day)}>
              {series.map((s, k) => {
                const v = Number(d[s.key]) || 0;
                const x0 = cx - (bw * series.length + 2 * (series.length - 1)) / 2 + k * (bw + 2);
                return <rect key={s.key} x={x0} y={y(v)} width={bw} height={Math.max(0, H - pb - y(v))} rx="2" fill={s.color}><title>{`${s.label}: ${v}`}</title></rect>;
              })}
              {(i % Math.ceil(data.length / 7) === 0 || i === data.length - 1) && <text x={cx} y={H - 6} textAnchor="middle">{shortDay(String(d.day))}</text>}
            </g>
          );
        })}
      </svg>
      <div className="legend" style={{ marginTop: 6 }}>{series.map((s) => <span key={s.key}><i style={{ background: s.color }} />{s.label}</span>)}</div>
    </>
  );
}

export function BarList({ items }: { items: { label: string; value: number; color: string; hint?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <div className="muted" style={{ fontSize: 12.5 }}>Belum ada data.</div>;
  return (
    <div className="barlist">
      {items.map((i) => (
        <div className="b" key={i.label}>
          <span className="ellipsis">{i.label}</span>
          <div className="track"><div className="fill" style={{ width: `${(i.value / max) * 100}%`, background: i.color }} /></div>
          <span className="muted" style={{ fontVariantNumeric: "tabular-nums" }}>{i.hint ?? num(i.value)}</span>
        </div>
      ))}
    </div>
  );
}
