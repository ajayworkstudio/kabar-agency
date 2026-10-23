"use client";
import { useState } from "react";

export default function Login() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) });
    setBusy(false);
    if (res.ok) window.location.href = "/";
    else setErr((await res.json()).error ?? "Gagal masuk");
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <div className="brand"><span className="dot" /> Newsroom</div>
        <p className="sub" style={{ marginTop: 10 }}>Masuk untuk meninjau dan menerbitkan draft.</p>
        <input type="password" autoComplete="current-password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
        {err && <p style={{ color: "var(--bad)", margin: "0 0 12px", fontSize: 14 }}>{err}</p>}
        <button className="btn primary" disabled={busy}>{busy ? "Memeriksa…" : "Masuk"}</button>
      </form>
    </main>
  );
}
