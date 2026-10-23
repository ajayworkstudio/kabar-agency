import Link from "next/link";
import { isLoggedIn } from "@/lib/auth";
import { I, Logo } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function Landing() {
  const authed = await isLoggedIn();
  const cta = authed ? "/app" : "/login";

  return (
    <div className="lp">
      <nav className="lp-nav">
        <div className="in">
          <Link href="/" className="lp-brand"><Logo size={22} /> Agency</Link>
          <div className="lp-links">
            <a href="#karyawan">Karyawan bot</a>
            <a href="#fitur">Fitur</a>
            <a href="#alur">Cara kerja</a>
            <a href="#platform">Platform</a>
          </div>
          <div className="lp-cta">
            {!authed && <Link href="/login" className="login">Masuk</Link>}
            <Link href={cta} className="btn light">{authed ? "Buka workspace" : "Mulai"}</Link>
          </div>
        </div>
      </nav>

      <section className="hero">
        <h1>Agency adalah tim karyawan bot untuk mengelola media sosialmu</h1>
        <p>
          Bot memantau berita terbaru setiap 20 menit, memverifikasinya ke banyak outlet, lalu menulis konten untuk <b>Instagram, Threads, TikTok, dan YouTube Shorts</b>. Kamu tinggal memantau, menyetujui, dan menerima laporan tiap pagi.
        </p>
        <div className="ctas">
          <Link href={cta} className="btn light lg">{authed ? "Buka workspace" : "Masuk ke workspace"}</Link>
          <Link href={authed ? "/app/agents" : "/login"} className="link">Kenalan dengan Raka, karyawan pertamamu <span>›</span></Link>
        </div>
      </section>

      <div className="stage" aria-hidden>
        <div className="mock">
          <div>
            <div className="m-item" style={{ fontWeight: 600, color: "var(--text)" }}><Logo size={16} /> Agency</div>
            <div style={{ height: 10 }} />
            <div className="m-item on"><I.inbox size={14} /> Inbox <span style={{ marginLeft: "auto", background: "var(--accent)", color: "#fff", borderRadius: 999, padding: "0 6px", fontSize: 11 }}>3</span></div>
            <div className="m-item"><I.home size={14} /> Ringkasan</div>
            <div className="m-item"><I.tasks size={14} /> Tugas</div>
            <div className="m-item"><I.users size={14} /> Karyawan</div>
            <div className="m-item"><I.report size={14} /> Laporan harian</div>
            <div style={{ height: 14 }} />
            <div className="m-item faint" style={{ fontSize: 11.5 }}>Karyawan bot</div>
            {[["Raka", "#5E6AD2"], ["Sinta", "#4CB782"], ["Bima", "#E467B4"]].map(([n, c]) => (
              <div key={n} className="m-item"><span className="avatar" style={{ width: 16, height: 16, background: c, fontSize: 9 }}>{n[0]}</span>{n}</div>
            ))}
          </div>
          <div style={{ padding: 0 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", fontWeight: 500 }}>Inbox</div>
            {[
              ["Timnas Lolos ke Final Piala AFF!", "Draft siap disetujui · 5 outlet", "#4CB782", "2 mnt"],
              ["DPR Sahkan Revisi UU", "Draft · ada catatan fakta", "#EB5757", "1 jam"],
              ["Pantau isu harga beras Jateng", "Hasil riset · 6 outlet", "#5E6AD2", "3 jam"],
              ["Rupiah Menguat Sebulan Terakhir", "Terjadwal 19.30 WIB", "#F2C94C", "4 jam"],
              ["Laporan harian Raka", "12 berita · 4 draft · 3 terbit", "#8a8f98", "7 jam"],
            ].map(([t, s, c, w]) => (
              <div key={t} className="m-in" style={{ padding: "12px 14px" }}>
                <span className="avatar" style={{ width: 22, height: 22, background: "#5E6AD2", fontSize: 10 }}>R</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</div>
                  <div className="muted" style={{ fontSize: 12, display: "flex", gap: 6, alignItems: "center" }}><span style={{ width: 6, height: 6, borderRadius: 2, background: c }} />{s}</div>
                </div>
                <span className="faint" style={{ fontSize: 11 }}>{w}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "18px 24px", borderRight: 0 }}>
            <div className="muted" style={{ fontSize: 12 }}>Olahraga › AGN-40</div>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: -0.5, margin: "10px 0 6px" }}>Timnas Lolos ke Final Piala AFF!</div>
            <div className="muted" style={{ fontSize: 13.5, maxWidth: 480 }}>Indonesia menang 2–1 atas Vietnam. Gol penentu lahir di menit 89. Dikonfirmasi Antara, Detik, Tempo, Kompas, CNN Indonesia.</div>
            <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
              <span className="tag ok">Lolos cek fakta</span><span className="tag">IG Carousel</span><span className="tag">TikTok</span><span className="tag">YT Shorts</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {["/demo/card-1.png", "/demo/card-2.png", "/demo/card-3.png"].map((s) => <img key={s} src={s} alt="" style={{ height: 210, borderRadius: 8, border: "1px solid var(--line)" }} />)}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <span className="btn primary">Setujui & posting</span><span className="btn">Jadwalkan</span>
            </div>
          </div>
        </div>
      </div>

      <section className="features" id="fitur">
        {[
          [<I.users key="i" />, "Karyawan bot", "Rekrut bot dengan jabatan, platform, kategori berita, dan tanggung jawabnya sendiri."],
          [<I.tasks key="i" />, "Task manager", "Pantau semua pekerjaan bot dalam daftar atau papan, lengkap dengan prioritas dan status."],
          [<I.inbox key="i" />, "Persetujuan", "Tidak ada yang terbit tanpa izinmu. Setujui dari dashboard atau satu tap di Telegram."],
          [<I.report key="i" />, "Laporan harian", "Tiap pagi bot mengirim ringkasan berita terbaru dan saran konten untuk hari itu."],
        ].map(([ic, t, d]) => (
          <div key={String(t)}>
            <span className="ic">{ic}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>

      <section className="features" id="alur" style={{ paddingTop: 10 }}>
        {[
          ["01", "Kumpulkan", "20+ sumber berita nasional dan Google Trends dipantau setiap 20 menit."],
          ["02", "Verifikasi", "Berita baru ditulis setelah dikonfirmasi minimal 2 outlet (politik 3)."],
          ["03", "Tulis & desain", "Carousel, caption, Threads, dan video pendek dibuat otomatis, lalu dicek fakta."],
          ["04", "Terbitkan", "Setelah kamu setujui, konten terbit di slot terbaik dan statistiknya dipantau."],
        ].map(([n, t, d]) => (
          <div key={n} id={n === "04" ? "platform" : undefined}>
            <span className="mono faint">{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </div>
        ))}
      </section>

      <footer className="lp-foot" id="karyawan">
        <div className="in"><span>Agency — sistem manajemen agensi konten</span><span>Instagram · Threads · TikTok · YouTube Shorts</span></div>
      </footer>
    </div>
  );
}
