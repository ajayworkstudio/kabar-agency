/** Client-safe helpers for the design studio (no server imports). */
/**
 * Turn a block of pasted text into slides:
 * - blank line separates slides
 * - first line of a slide = title, the rest = body
 * - a slide starting with ">" is a quote; "#label" on its own first line sets the small label
 * - first slide is the cover, last slide (if 3+) is the closing
 */
export function slidesFromText(text: string) {
  const blocks = text.replace(/\r/g, "").split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return blocks.map((b, i) => {
    let lines = b.split("\n").map((l) => l.trim()).filter(Boolean);
    let kicker: string | undefined;
    if (lines[0]?.startsWith("#") && lines.length > 1) { kicker = lines[0].replace(/^#+\s*/, ""); lines = lines.slice(1); }
    const quote = lines[0]?.startsWith(">");
    const title = (lines[0] ?? "").replace(/^>\s*/, "");
    const body = lines.slice(1).join(" ");
    const kind: "cover" | "point" | "quote" | "closing" =
      i === 0 ? "cover" : quote ? "quote" : i === blocks.length - 1 && blocks.length >= 3 ? "closing" : "point";
    return { kind, kicker, title, body: body || undefined };
  });
}

export type BriefArticle = { outlet: string; title: string; snippet: string | null; url: string };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).replace(/\s+\S*$/, "")}…` : s);

/**
 * Turn a story + its articles into Studio text, without AI.
 * Cover = headline, then one slide per different outlet angle, then a comment prompt.
 * Text stays in the source language — edit or translate before sending to the Inbox.
 */
export function storyToText(story: { headline: string; category: string }, articles: BriefArticle[], lang: "en" | "id", categoryLabel: string) {
  const seen = new Set<string>([story.headline.toLowerCase()]);
  const angles = articles.filter((a) => {
    const k = a.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 4);
  const first = articles.find((a) => a.snippet)?.snippet ?? "";
  const blocks = [
    `#${categoryLabel}\n${clip(story.headline, 110)}${first ? `\n${clip(first, 170)}` : ""}`,
    ...angles.map((a) => `#${a.outlet}\n${clip(a.title, 110)}${a.snippet ? `\n${clip(a.snippet, 170)}` : ""}`),
    lang === "en" ? "What's your take?\nDrop it in the comments." : "Menurutmu gimana?\nTulis di kolom komentar ya.",
  ];
  const outlets = [...new Set(articles.map((a) => a.outlet))].slice(0, 4).join(", ");
  return {
    text: blocks.join("\n\n"),
    credit: `${lang === "en" ? "Source" : "Sumber"}: ${outlets}`,
    caption: `${story.headline}\n\n${lang === "en" ? "Source" : "Sumber"}: ${outlets}`,
  };
}
