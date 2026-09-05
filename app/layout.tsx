import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { site } from "@/content";
import { NebulaAffordance } from "./nebula-affordance";
import { NebulaCanvasLoader } from "./nebula-canvas-loader";
import { PointerTracker } from "./pointer-tracker";
import { SiteHeader } from "./site-header";
import { SITE_URL } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: site.name,
  description: site.role,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="font-body bg-paper text-ink antialiased">
        <PointerTracker />
        <NebulaCanvasLoader />
        <NebulaAffordance />
        <SiteHeader />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
