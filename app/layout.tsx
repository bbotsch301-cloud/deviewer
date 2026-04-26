import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "@xterm/xterm/css/xterm.css";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "deviewer — live developer feedback",
  description:
    "Push code to GitHub and instantly see what happened: logs stream, tests run, builds finish — live, with Claude-powered failure analysis.",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} dark`}
      suppressHydrationWarning
    >
      <body className="font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
