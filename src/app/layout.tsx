import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const inter = localFont({
  src: [
    { path: "../../assets/fonts/Inter-Regular.otf", weight: "400" },
    { path: "../../assets/fonts/Inter-SemiBold.otf", weight: "600" },
    { path: "../../assets/fonts/Inter-ExtraBold.otf", weight: "800" },
    { path: "../../assets/fonts/Inter-Black.otf", weight: "900" },
  ],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Newsroom",
  description: "Trending news → verified drafts → one-tap publishing",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Newsroom", statusBarStyle: "black-translucent" },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
};

export const viewport: Viewport = { themeColor: "#0B0F1A", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        {children}
        {/* Service worker only in production; in dev it would cache hot-reload chunks and break the page */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              process.env.NODE_ENV === "production"
                ? `if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js').catch(()=>{})}`
                : `if('serviceWorker' in navigator){navigator.serviceWorker.getRegistrations().then(r=>r.forEach(x=>x.unregister()));window.caches&&caches.keys().then(k=>k.forEach(c=>caches.delete(c)))}`,
          }}
        />
      </body>
    </html>
  );
}
