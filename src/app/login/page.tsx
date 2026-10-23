"use client";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/ui";

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
    if (res.ok) window.location.href = "/app";
    else setErr((await res.json().catch(() => ({}))).error ?? "Gagal masuk");
  }

  return (
    <main className="login">
      <form onSubmit={submit}>
        <Link href="/" style={{ display: "inline-block" }}><Logo size={40} /></Link>
        <h1>Masuk ke Agency</h1>
        <p className="muted" style={{ margin: 0 }}>Panel admin untuk memantau dan menyetujui kerja karyawan bot.</p>
        <input className="input" type="password" autoComplete="current-password" placeholder="Password admin" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus aria-label="Password admin" />
        {err && <p style={{ color: "var(--bad)", margin: "0 0 10px", fontSize: 13 }}>{err}</p>}
        <button className="btn light" disabled={busy || !pw}>{busy ? "Memeriksa…" : "Masuk"}</button>
      </form>
    </main>
  );
}
