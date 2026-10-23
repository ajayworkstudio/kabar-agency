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
