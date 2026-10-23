import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let client: SupabaseClient | null = null;

/** Server-side Supabase client (service role). Never import this into client components. */
export function db(): SupabaseClient {
  if (!client) {
    if (!env.supabaseUrl || !env.supabaseKey) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    client = createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false } });
  }
  return client;
}

/** Upload bytes to the public media bucket and return a public URL. */
export async function uploadMedia(path: string, bytes: Uint8Array, contentType: string): Promise<string> {
  const { error } = await db().storage.from(env.mediaBucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return db().storage.from(env.mediaBucket).getPublicUrl(path).data.publicUrl;
}

/** Wrap a job so its outcome lands in the `runs` table for the dashboard. */
export async function logRun<T>(job: string, fn: () => Promise<{ summary: string; data?: T }>) {
  const t0 = Date.now();
  try {
    const out = await fn();
    await db().from("runs").insert({ job, ok: true, summary: out.summary, duration_ms: Date.now() - t0 });
    return { ok: true as const, ...out };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await db().from("runs").insert({ job, ok: false, summary: msg.slice(0, 1000), duration_ms: Date.now() - t0 }).then(() => {}, () => {});
    return { ok: false as const, summary: msg };
  }
}
