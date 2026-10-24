import type { DraftContent } from "./types";

/** Ready-to-paste captions per platform (client-safe, no server imports). */
export function captionKit(c: DraftContent): { id: string; label: string; text: string }[] {
  const tags = (c.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`));
  const withTags = (t: string, n: number) => {
    const missing = tags.filter((h) => !t.includes(h)).slice(0, n);
    return missing.length ? `${t.trim()}\n\n${missing.join(" ")}` : t.trim();
  };
  const ig = withTags(c.instagramCaption, 12);
  const threads = [c.threadsPost, ...(c.threadsFollowUps ?? [])].filter(Boolean).join("\n\n— — —\n\n");
  const tiktok = withTags(c.tiktokCaption || c.hook, 5);
  const yt = `${c.video?.title ?? c.hook}\n\n${c.video?.description ?? ""}`.trim();
  return [
    { id: "ig", label: "Instagram", text: ig },
    { id: "tiktok", label: "TikTok", text: tiktok },
    { id: "threads", label: "Threads", text: threads },
    { id: "yt", label: "YouTube Shorts (judul + deskripsi)", text: yt },
  ].filter((k) => k.text.trim());
}
