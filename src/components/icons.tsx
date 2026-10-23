/** Icons + logo. No "use client" — safe to render from server and client components. */
import type { ReactNode } from "react";

// ── icons (16px, 1.5 stroke) ───────────────────────────────
type IconProps = { size?: number; className?: string };
const svg = (d: ReactNode, vb = "0 0 16 16") =>
  function Icon({ size = 16, className }: IconProps) {
    return (
      <svg width={size} height={size} viewBox={vb} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
        {d}
      </svg>
    );
  };

export const I = {
  inbox: svg(<><path d="M2.5 9.5h3l1 2h3l1-2h3" /><path d="M3.8 3.5h8.4l1.3 6v3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-3z" /></>),
  home: svg(<><path d="M2.5 7 8 2.5 13.5 7v6a.5.5 0 0 1-.5.5H10V10H6v3.5H3a.5.5 0 0 1-.5-.5z" /></>),
  tasks: svg(<><circle cx="8" cy="8" r="5.5" /><path d="m5.8 8 1.6 1.6 3-3.2" /></>),
  users: svg(<><circle cx="6" cy="5.5" r="2.3" /><path d="M1.8 13c.4-2.2 2.1-3.5 4.2-3.5s3.8 1.3 4.2 3.5" /><path d="M10.5 3.4a2.2 2.2 0 0 1 0 4.2M12 9.8c1.2.4 2 1.5 2.2 3.2" /></>),
  report: svg(<><path d="M4 1.8h5.5L12.5 5v8.7a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V2.3a.5.5 0 0 1 .5-.5Z" /><path d="M9.3 2v3.2h3M6 8.5h4.5M6 11h3" /></>),
  news: svg(<><path d="M2.5 3.5h9v9a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z" /><path d="M11.5 6h2v6.5a1 1 0 0 1-2 0M4.5 6h5M4.5 8.5h5M4.5 11h3" /></>),
  send: svg(<><path d="M14 2 7 9M14 2l-4.5 12-2.5-5-5-2.5z" /></>),
  gear: svg(<><circle cx="8" cy="8" r="2" /><path d="M8 1.5v1.8M8 12.7v1.8M14.5 8h-1.8M3.3 8H1.5M12.6 3.4l-1.3 1.3M4.7 11.3l-1.3 1.3M12.6 12.6l-1.3-1.3M4.7 4.7 3.4 3.4" /></>),
  plus: svg(<path d="M8 3v10M3 8h10" />),
  search: svg(<><circle cx="7" cy="7" r="4.5" /><path d="m13.5 13.5-3.2-3.2" /></>),
  chevron: svg(<path d="m6 4 4 4-4 4" />),
  back: svg(<path d="M10 3.5 5.5 8l4.5 4.5" />),
  menu: svg(<path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />),
  x: svg(<path d="m4 4 8 8M12 4l-8 8" />),
  bolt: svg(<path d="M8.8 1.5 3.5 9h4l-.8 5.5L12.5 7h-4z" />),
  chart: svg(<><path d="M2.5 13.5h11" /><path d="M4.5 11V8M7.5 11V4.5M10.5 11V6.5" /></>),
  check: svg(<path d="m3.5 8.5 3 3 6-7" />),
  list: svg(<path d="M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01" />),
  board: svg(<><rect x="2" y="2.5" width="3.5" height="11" rx="1" /><rect x="6.3" y="2.5" width="3.5" height="7" rx="1" /><rect x="10.5" y="2.5" width="3.5" height="9" rx="1" /></>),
  logout: svg(<><path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6M10.5 11 13.5 8l-3-3M13.5 8H6" /></>),
  external: svg(<path d="M9.5 2.5h4v4M13.5 2.5 7.5 8.5M12 9.5V13a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 3 13V5a.5.5 0 0 1 .5-.5H7" />),
  play: svg(<path d="M5 3.5v9l7-4.5z" />),
  spark: svg(<path d="M8 1.8 9.3 6.7 14.2 8 9.3 9.3 8 14.2 6.7 9.3 1.8 8l4.9-1.3z" />),
};

export function Logo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b8aff" />
          <stop offset="1" stopColor="#4a52c4" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#lg)" />
      <path d="M6 17.5 12 5l6 12.5" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="13.6" r="1.6" fill="#fff" />
    </svg>
  );
}

