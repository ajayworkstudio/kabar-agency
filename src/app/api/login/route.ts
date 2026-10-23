import { NextResponse } from "next/server";
import { safeEqual, setSessionCookie } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: Request) {
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  await new Promise((r) => setTimeout(r, 400)); // slow down guessing
  if (!env.adminPassword || !password || !safeEqual(password, env.adminPassword)) {
    return NextResponse.json({ error: "Password salah" }, { status: 401 });
  }
  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
