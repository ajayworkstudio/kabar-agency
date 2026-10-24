import { NextResponse } from "next/server";
import { isLoggedIn } from "@/lib/auth";
import { db } from "@/lib/db";
import { isDemo } from "@/lib/demo";
import { canonicalOutlet } from "@/pipeline/cluster";

export const dynamic = "force-dynamic";

/** Raw material for designing a story without AI: headline + one article per outlet. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isLoggedIn())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (isDemo()) {
    return NextResponse.json({
      story: { id, headline: "Timnas Indonesia Kalahkan Vietnam, Lolos ke Final Piala AFF", category: "olahraga", outlet_count: 3 },
      articles: [
        { outlet: "Antara", title: "Timnas Indonesia lolos ke final Piala AFF", snippet: "Indonesia menang 2-1 atas Vietnam di leg kedua semifinal.", url: "#" },
        { outlet: "Detik", title: "Gol menit 89 bawa Garuda ke final", snippet: "Sundulan dari tendangan sudut memastikan kemenangan.", url: "#" },
        { outlet: "Tempo", title: "Final digelar dua leg pekan depan", snippet: "Leg kedua akan berlangsung di Jakarta.", url: "#" },
      ],
    });
  }
  const supa = db();
  const { data: story } = await supa.from("stories").select("id, headline, category, outlet_count").eq("id", id).single();
  if (!story) return NextResponse.json({ error: "not found" }, { status: 404 });
  const { data: arts } = await supa
    .from("articles")
    .select("outlet, title, snippet, url, published_at")
    .eq("story_id", id)
    .order("published_at", { ascending: false })
    .limit(20);
  const perOutlet = [...new Map((arts ?? []).map((a) => [canonicalOutlet(a.outlet as string), a])).values()].slice(0, 6);
  return NextResponse.json({ story, articles: perOutlet });
}
