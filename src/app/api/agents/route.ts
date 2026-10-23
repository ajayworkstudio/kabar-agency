import { NextResponse } from "next/server";
import { DEFAULT_SETTINGS } from "@/lib/agents";
import { isLoggedIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { AgentInput } from "@/lib/schemas";

const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "bot";

/** Hire a new bot employee. */
export async function POST(req: Request) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (isDemo()) return NextResponse.json({ error: "mode demo — aksi dinonaktifkan" }, { status: 403 });
  const parsed = AgentInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues.map((i) => i.message).join(", ") }, { status: 400 });
  const a = parsed.data;
  const { data, error } = await db()
    .from("agents")
    .insert({
      slug: `${slugify(a.name)}-${Math.random().toString(36).slice(2, 6)}`,
      name: a.name,
      role: a.role,
      color: a.color ?? "#5E6AD2",
      status: a.status ?? "active",
      platforms: a.platforms ?? ["instagram:carousel", "threads:text"],
      categories: a.categories ?? [],
      responsibilities: a.responsibilities ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(a.settings ?? {}) },
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
