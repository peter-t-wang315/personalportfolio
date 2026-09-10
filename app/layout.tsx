import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { site } from "@/content";
import { NebulaAffordance } from "./nebula-affordance";
import { NebulaCanvasLoader } from "./nebula-canvas-loader";
import { NebulaCursor } from "./nebula-cursor";
import { NebulaDrag } from "./nebula-drag";
import { PointerTracker } from "./pointer-tracker";
import { RouteCurtain } from "./route-curtain";
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
    // Extensions that run a content script at document_start write to the
    // document's root elements before React hydrates, and an attribute React
    // did not render is a hydration mismatch it reports and refuses to patch.
    // Ad blockers, password managers and Grammarly all do it on every http and
    // https page, so localhost is not exempt; Dark Reader and Chrome's own
    // translate write to <html> rather than <body>, which is why both need
    // this and suppressing only <body> left the warning showing.
    //
    // Nothing here renders a dynamic attribute on either — both classNames are
    // literals, and the font variables are build-time constants — so there is
    // no real mismatch this can hide. Reproduced and verified against a
    // simulated document_start content script writing to each in turn.
    //
    // It suppresses one element's own attributes and text, not its subtree, so
    // a genuine mismatch anywhere inside still reports normally.
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-body bg-paper text-ink antialiased"
        suppressHydrationWarning
      >
        <PointerTracker />
        <RouteCurtain />
        <NebulaDrag />
        <NebulaCursor />
        <NebulaCanvasLoader />
        <NebulaAffordance />
        <SiteHeader />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
