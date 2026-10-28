import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({ src: "./fonts/geist.ttf", variable: "--font-geist-sans", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "./fonts/geist-mono.ttf", variable: "--font-geist-mono", weight: "100 900", display: "swap" });
const anton = localFont({ src: "./fonts/anton.ttf", variable: "--font-anton", weight: "400", display: "swap" });

export const metadata: Metadata = {
  applicationName: "Called It",
  title: "Called It — Cricket calls. Real receipts.",
  description:
    "Put your cricket instincts on the record. Play a match replay, call the next wicket, compete with bot opponents and keep the receipts. Free to play.",
  openGraph: {
    type: "website",
    siteName: "Called It",
    title: "Called It — Call the match. Keep the receipt.",
    description: "Cricket predictions, ball-by-ball verdicts, and bragging rights. Play the solo replay for free.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1015",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
