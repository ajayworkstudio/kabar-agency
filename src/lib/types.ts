import type { Category } from "@/config/sources";

export type Platform = "instagram" | "threads" | "tiktok" | "youtube";

export type RawItem = {
  sourceId: string;
  outlet: string;
  url: string;
  title: string;
  snippet: string;
  category?: Category;
  publishedAt: Date | null;
};

export type CardSlide = {
  kind: "cover" | "point" | "quote" | "closing";
  kicker?: string;   // small label above title, e.g. "POLITIK" / "FAKTA 1"
  title: string;     // big text
  body?: string;     // supporting text
  bullets?: string[]; // list rows; "Label: value" renders as a two-column row
};

export type VideoScene = {
  onScreen: string;  // short text burned into the frame (max ~12 words)
  voiceover: string; // what the narrator says (Bahasa Indonesia)
  seconds: number;   // 2–8
};

/** Everything the writer produces for one story. */
export type DraftContent = {
  category: Category;
  hook: string;                 // first-line hook, reused across platforms
  summary: string;              // 2–3 neutral sentences, for the dashboard
  keyFacts: { claim: string; sources: string[] }[]; // claims → outlet names that support them
  carousel: CardSlide[];        // 4–7 slides
  instagramCaption: string;
  threadsPost: string;          // ≤ 500 chars
  threadsFollowUps: string[];   // optional replies forming a thread
  video: {
    title: string;              // YouTube Shorts title ≤ 100 chars
    description: string;
    scenes: VideoScene[];       // total 20–45s
  };
  tiktokCaption: string;
  hashtags: string[];
  sourceCredit: string;         // e.g. "Sumber: Antara, Detik, Tempo"
  sensitivity: "low" | "medium" | "high"; // high = politics/legal/tragedy → extra care
  /** Present on drafts made in the design studio: two-colour palette + canvas format. */
  design?: { palette: { bg: string; fg: string }; format: "post" | "square" | "story" } | null;
  /** True when the admin wrote the text in the Studio (no sources, no fact-check). */
  manual?: boolean;
};

export type FactCheck = {
  verdict: "pass" | "warn" | "fail";
  issues: { text: string; problem: string }[];
};
