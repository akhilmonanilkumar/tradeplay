import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Shell from "@/components/Shell";
import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tradeplay",
  description: "Personal A+ trading journal",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg", apple: "/icon-192.png" },
  appleWebApp: { capable: true, title: "Tradeplay", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers makes every page dynamic so the per-request CSP nonce (proxy.ts) is applied.
  await headers();
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">
        <Shell>{children}</Shell>
        <RegisterSW />
      </body>
    </html>
  );
}
