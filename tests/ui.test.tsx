/**
 * Renders every admin page with the demo workspace to catch runtime errors in render logic
 * (no browser needed). Navigation hooks are mocked.
 */
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const params = new URLSearchParams();
let pathname = "/app";
let routeParams: Record<string, string> = {};
vi.mock("next/navigation", () => ({
  useSearchParams: () => params,
  useRouter: () => ({ replace: () => {}, push: () => {} }),
  usePathname: () => pathname,
  useParams: () => routeParams,
  redirect: () => {},
}));
vi.mock("next/link", () => ({ default: ({ href, children, ...p }: { href: string; children: React.ReactNode }) => <a href={href} {...p}>{children}</a> }));

import Shell from "../src/components/Shell";
import { WorkspaceProvider, type Workspace } from "../src/components/workspace";
import { demoWorkspace } from "../src/lib/demo";

const ws = JSON.parse(JSON.stringify(demoWorkspace())) as Workspace;

async function render(mod: string, opts: { path: string; query?: Record<string, string>; route?: Record<string, string> }) {
  pathname = opts.path;
  routeParams = opts.route ?? {};
  for (const k of [...params.keys()]) params.delete(k);
  Object.entries(opts.query ?? {}).forEach(([k, v]) => params.set(k, v));
  const Page = (await import(mod)).default;
  return renderToString(<WorkspaceProvider initial={ws}><Page /></WorkspaceProvider>);
}

describe("admin pages render with demo data", () => {
  it("overview", async () => {
    const html = await render("../src/app/app/page", { path: "/app" });
    expect(html).toContain("Menunggu persetujuan");
    expect(html).toContain("Raka");
  });
  it("inbox list + draft detail + research detail", async () => {
    expect(await render("../src/app/app/inbox/page", { path: "/app/inbox" })).toContain("Timnas Lolos");
    expect(await render("../src/app/app/inbox/page", { path: "/app/inbox", query: { i: "d:demo-d2" } })).toContain("Catatan pemeriksa fakta");
    expect(await render("../src/app/app/inbox/page", { path: "/app/inbox", query: { i: `t:${ws.tasks.find((t) => t.kind === "research" && t.status === "in_review")!.id}` } })).toContain("Angle konten");
  });
  it("ready-to-post kit (manual mode)", async () => {
    const html = await render("../src/app/app/inbox/page", { path: "/app/inbox", query: { i: "d:demo-d4" } });
    expect(html).toContain("Disetujui — siap diposting");
    expect(html).toContain("Tandai sudah diposting");
    expect(html).toContain("#VedaEga");
  });
  it("tasks list, detail and new-task modal", async () => {
    expect(await render("../src/app/app/tasks/page", { path: "/app/tasks" })).toContain("AGN-");
    expect(await render("../src/app/app/tasks/page", { path: "/app/tasks", query: { t: ws.tasks[0].id } })).toContain("Buka draft di Inbox");
    expect(await render("../src/app/app/tasks/page", { path: "/app/tasks", query: { new: "1" } })).toContain("Tugas baru");
  });
  it("agents list, hire modal, profile", async () => {
    expect(await render("../src/app/app/agents/page", { path: "/app/agents" })).toContain("Editor Berita Sosial Media");
    expect(await render("../src/app/app/agents/page", { path: "/app/agents", query: { hire: "1" } })).toContain("Rekrut karyawan bot");
    expect(await render("../src/app/app/agents/[slug]/page", { path: "/app/agents/raka", route: { slug: "raka" } })).toContain("Tanggung jawab");
  });
  it("reports, news, published, settings", async () => {
    expect(await render("../src/app/app/reports/page", { path: "/app/reports", query: { r: ws.reports[0].id } })).toContain("Berita teratas");
    expect(await render("../src/app/app/news/page", { path: "/app/news" })).toContain("Kesehatan sumber");
    expect(await render("../src/app/app/published/page", { path: "/app/published" })).toContain("postingan");
    expect(await render("../src/app/app/settings/page", { path: "/app/settings" })).toContain("Jalankan manual");
  });
  it("design studio", async () => {
    const html = await render("../src/app/app/studio/page", { path: "/app/studio" });
    expect(html).toContain("Palet 2 warna");
    expect(html).toMatch(/Dita(<!-- -->)? siap mendesain/);
  });
  it("shell sidebar", () => {
    const html = renderToString(<Shell><div /></Shell>);
    expect(html).toContain("Inbox");
  });
});
