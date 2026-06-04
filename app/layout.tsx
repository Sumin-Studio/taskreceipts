import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://work-recipe.vercel.app"),
  title: "Task Receipts",
  description: "A Pomodoro timer that prints a receipt every time you finish a task.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Task Receipts",
    description: "A Pomodoro timer that prints a receipt every time you finish a task.",
    url: "https://work-recipe.vercel.app/",
    siteName: "Task Receipts",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${plexMono.variable} h-full antialiased`}>
      <body className="h-full overflow-hidden font-mono">{children}</body>
    </html>
  );
}
