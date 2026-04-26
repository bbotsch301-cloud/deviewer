import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "deviewer — live developer feedback",
  description:
    "Push code to GitHub and instantly see what happened: logs stream, tests run, builds finish — live.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
