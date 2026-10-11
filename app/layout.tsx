import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  title: "Bola Tha! The third umpire for your match group chat",
  description:
    "Chat through a live match the way you always do. An AI third umpire catches the predictions in the banter, settles them ball by ball and keeps the receipts.",
};

export const viewport: Viewport = {
  themeColor: "#0b1015",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
