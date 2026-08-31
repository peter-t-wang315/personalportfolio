import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { site } from "@/content";
import { NebulaCanvasLoader } from "./nebula-canvas-loader";
import "./globals.css";

export const metadata: Metadata = {
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
        <NebulaCanvasLoader />
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
