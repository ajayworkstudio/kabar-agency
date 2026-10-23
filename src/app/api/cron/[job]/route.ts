import { NextResponse } from "next/server";
import { isCronOrOwner } from "@/lib/auth";
import { logRun } from "@/lib/db";
import { refreshAll } from "@/lib/tokens";
import { collect } from "@/pipeline/collect";
import { generate } from "@/pipeline/generate";
import { collectMetrics, publishDue } from "@/pipeline/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOBS: Record<string, () => Promise<{ summary: string }>> = {
  collect,
  generate: () => generate(),
  publish: publishDue,
  metrics: collectMetrics,
  "refresh-tokens": async () => ({ summary: (await refreshAll()).join(", ") }),
};

async function handle(req: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!(await isCronOrOwner(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { job } = await params;
  const fn = JOBS[job];
  if (!fn) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  const out = await logRun(job, fn);
  return NextResponse.json(out, { status: out.ok ? 200 : 500 });
}

export const GET = handle;
export const POST = handle;
