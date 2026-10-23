import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isDemo } from "./demo";
import { env } from "./env";

const COOKIE = "ka_session";

export function sign(value: string): string {
  if (!env.sessionSecret) throw new Error("SESSION_SECRET not set");
  return createHmac("sha256", env.sessionSecret).update(value).digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a), B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

/** Session token = expiry.signature — no DB needed for a single-owner dashboard. */
export function makeSession(days = 30): string {
  const exp = String(Date.now() + days * 86400_000);
  return `${exp}.${sign(`session:${exp}`)}`;
}

export function verifySession(token: string | undefined): boolean {
  if (!token) return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return safeEqual(sig, sign(`session:${exp}`));
}

export async function isLoggedIn(): Promise<boolean> {
  if (isDemo()) return true;
  const jar = await cookies();
  return verifySession(jar.get(COOKIE)?.value);
}

export async function setSessionCookie() {
  const jar = await cookies();
  jar.set(COOKIE, makeSession(), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. A logged-in owner may also trigger jobs manually. */
export async function isCronOrOwner(req: Request): Promise<boolean> {
  if (isDemo()) return false; // no jobs in demo mode
  const auth = req.headers.get("authorization") ?? "";
  if (env.cronSecret && safeEqual(auth, `Bearer ${env.cronSecret}`)) return true;
  return isLoggedIn();
}

/** Short signature for Telegram callback buttons: "a:<draftId>:<sig>". */
export function actionSig(action: string, id: string): string {
  return sign(`tg:${action}:${id}`).slice(0, 16);
}
