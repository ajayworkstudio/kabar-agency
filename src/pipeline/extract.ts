import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

/**
 * Fetch an article and pull out its main text. Used only as grounding material
 * for the writer — the text itself is never published.
 */
export async function extractArticle(url: string, maxChars = 2500): Promise<string | null> {
  if (/news\.google\.com/.test(url)) return null; // redirect wrapper, no body
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KabarAgencyBot/0.1)" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const html = await res.text();
    const { document } = parseHTML(html);
    const article = new Readability(document as unknown as Document).parse();
    const text = (article?.textContent ?? "")
      .replace(/\s+/g, " ")
      .replace(/(Baca juga|BACA JUGA|Simak juga)[^.]*\./g, "")
      .trim();
    return text.length > 200 ? text.slice(0, maxChars) : null;
  } catch {
    return null;
  }
}

/** Fetch a page and return its title, outlet name and readable text (for the design studio). */
export async function extractArticleFull(url: string): Promise<{ title: string; text: string; outlet: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KabarAgencyBot/0.1)" },
      signal: AbortSignal.timeout(12000),
      redirect: "follow",
    });
    if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
    const { document } = parseHTML(await res.text());
    const meta = (p: string) => document.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.getAttribute("content")?.trim();
    const site = meta("og:site_name");
    const article = new Readability(document as unknown as Document).parse();
    const text = (article?.textContent ?? "")
      .replace(/\s+/g, " ")
      .replace(/(Baca juga|BACA JUGA|Simak juga|ADVERTISEMENT|SCROLL TO CONTINUE WITH CONTENT)[^.]*\.?/g, "")
      .trim();
    const title = (meta("og:title") ?? article?.title ?? "").replace(/\s+[|\-–]\s+[^|\-–]{2,40}$/, "").trim();
    if (!title && text.length < 200) return null;
    return { title, text: text.slice(0, 6000), outlet: site ?? new URL(res.url || url).hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}
