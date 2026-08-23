import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { ThemeEffect } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXTAUTH_URL || "https://splitflow-1.vercel.app";

export const metadata: Metadata = {
  title: {
    default: "SplitFlow — AI-Powered Expense Splitting",
    template: "%s | SplitFlow",
  },
  description:
    "Split expenses, not friendships. The free AI-powered alternative to Splitwise with natural language entry, receipt scanning, debt simplification, and spending analytics.",
  keywords: [
    "expense splitting",
    "splitwise alternative",
    "shared expenses",
    "group expenses",
    "AI expense tracker",
    "debt simplification",
    "bill splitter",
    "split costs",
    "free expense app",
  ],
  authors: [{ name: "SplitFlow" }],
  metadataBase: new URL(siteUrl),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "SplitFlow",
    title: "SplitFlow — AI-Powered Expense Splitting",
    description:
      "Split expenses, not friendships. Free forever with AI-powered natural language entry, receipt scanning, and debt simplification.",
  },
  twitter: {
    card: "summary_large_image",
    title: "SplitFlow — AI-Powered Expense Splitting",
    description:
      "Split expenses, not friendships. The free AI-powered alternative to Splitwise.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground transition-colors duration-300`}
      >
        <ThemeEffect />
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
