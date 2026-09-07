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
      {/*
        Extensions that run a content script at document_start write to <body>
        before React hydrates, and an attribute React did not render is a
        hydration mismatch it reports and refuses to patch. AdBlock, password
        managers and Grammarly all do it on every http and https page, so
        localhost is not exempt. Nothing here renders a dynamic attribute on
        <body> — the className is a literal — so there is no real mismatch this
        can hide.

        It suppresses one element's own attributes and text, not its subtree, so
        a genuine mismatch anywhere inside still reports normally.
      */}
      <body
        className="font-body bg-paper text-ink antialiased"
        suppressHydrationWarning
      >
        <PointerTracker />
        <NebulaCanvasLoader />
        <NebulaAffordance />
        <SiteHeader />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
