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
