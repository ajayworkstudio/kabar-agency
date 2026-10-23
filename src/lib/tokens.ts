import { db } from "./db";
import { env } from "./env";
import type { Platform } from "./types";

const envSeed: Record<Platform, { access: string; refresh?: string }> = {
  instagram: { access: env.igToken },
  threads: { access: env.threadsToken },
  tiktok: { access: env.tiktokToken, refresh: env.tiktokRefreshToken },
  youtube: { access: "", refresh: env.ytRefreshToken },
};

/** Latest token: DB (kept fresh by the refresh cron) first, env vars as the initial seed. */
export async function getToken(p: Platform): Promise<{ access: string; refresh?: string }> {
  const { data } = await db().from("platform_tokens").select("access_token, refresh_token").eq("platform", p).maybeSingle();
  if (data?.access_token) return { access: data.access_token, refresh: data.refresh_token ?? envSeed[p].refresh };
  return envSeed[p];
}

export async function saveToken(p: Platform, access: string, refresh?: string | null, expiresInSec?: number) {
  await db().from("platform_tokens").upsert({
    platform: p,
    access_token: access,
    refresh_token: refresh ?? null,
    expires_at: expiresInSec ? new Date(Date.now() + expiresInSec * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  });
}

/** YouTube access tokens last 1h — exchange the refresh token on every use. */
export async function youtubeAccessToken(): Promise<string> {
  const { refresh } = await getToken("youtube");
  if (!refresh || !env.ytClientId) throw new Error("YouTube not configured");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.ytClientId, client_secret: env.ytClientSecret, refresh_token: refresh, grant_type: "refresh_token" }),
  });
  const j = (await res.json()) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error(`YouTube token: ${j.error_description ?? res.status}`);
  return j.access_token;
}

/** Daily: extend long-lived Meta tokens (60-day) and rotate TikTok's 24h access token. */
export async function refreshAll(): Promise<string[]> {
  const out: string[] = [];

  for (const p of ["instagram", "threads"] as const) {
    const { access } = await getToken(p);
    if (!access) { out.push(`${p}: not configured`); continue; }
    const url =
      p === "instagram"
        ? `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${access}`
        : `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${access}`;
    const j = (await (await fetch(url)).json()) as { access_token?: string; expires_in?: number; error?: { message: string } };
    if (j.access_token) { await saveToken(p, j.access_token, null, j.expires_in); out.push(`${p}: refreshed`); }
    else out.push(`${p}: ${j.error?.message ?? "refresh failed"}`);
  }

  const tt = await getToken("tiktok");
  if (tt.refresh && env.tiktokClientKey) {
    const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_key: env.tiktokClientKey, client_secret: env.tiktokClientSecret, grant_type: "refresh_token", refresh_token: tt.refresh }),
    });
    const j = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; error_description?: string };
    if (j.access_token) { await saveToken("tiktok", j.access_token, j.refresh_token, j.expires_in); out.push("tiktok: refreshed"); }
    else out.push(`tiktok: ${j.error_description ?? "refresh failed"}`);
  } else out.push("tiktok: not configured");

  return out;
}
