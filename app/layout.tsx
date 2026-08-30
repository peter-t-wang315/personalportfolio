import type { Metadata } from "next";
import localFont from "next/font/local";
import { Bricolage_Grotesque, Inter_Tight } from "next/font/google";
import GrainOverlay from "@/components/GrainOverlay";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const body = Inter_Tight({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const utility = localFont({
  src: [
    {
      path: "../public/fonts/departure-mono/DepartureMono-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-utility",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Peter Wang — Backend engineer",
  description:
    "Backend engineer — event-driven services and protocol integration. Software Engineer II at Schweitzer Engineering Laboratories.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${utility.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-shell text-ink font-body antialiased">
        <GrainOverlay />
        {children}
      </body>
    </html>
  );
}
