/**
 * What Gen Z (digitally native, 13–28) tends to engage with. Used to rank stories for writers
 * whose focus is "genz". Matching is on normalised headlines (lowercase, no punctuation).
 */
export const GENZ_HINTS = [
  // internet culture & creators
  "viral", "netizen", "tiktok", "tiktoker", "youtuber", "influencer", "konten kreator", "selebgram", "trending", "fyp", "meme", "podcast", "streamer",
  // music, k-culture, entertainment
  "kpop", "k-pop", "idol", "konser", "festival musik", "album", "single baru", "drakor", "drama korea", "anime", "netflix", "series", "film", "bioskop", "box office", "spotify",
  // games & tech
  "game", "gaming", "esports", "e-sports", "mobile legends", "mlbb", "valorant", "pubg", "free fire", "playstation", "nintendo", "iphone", "android", "gadget", "ai", "chatgpt", "aplikasi", "media sosial", "instagram", "x twitter",
  // money, work, campus
  "gen z", "genz", "milenial", "anak muda", "mahasiswa", "kampus", "beasiswa", "fresh graduate", "lowongan", "magang", "ump", "umr", "gaji", "kos", "pinjol", "paylater", "crypto", "kripto", "saham",
  // lifestyle & social issues
  "skincare", "fashion", "thrift", "kopi", "kuliner", "healing", "mental health", "kesehatan mental", "iklim", "lingkungan", "sampah", "demo mahasiswa",
  // sports young fans follow
  "timnas", "motogp", "f1", "badminton", "bulu tangkis",
];

export function genzScore(text: string): number {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ")} `;
  return GENZ_HINTS.filter((k) => t.includes(` ${k} `) || t.includes(` ${k}`)).length;
}
