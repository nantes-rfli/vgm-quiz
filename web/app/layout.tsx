import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/src/components/Providers";
import { I18nProvider } from "@/src/lib/i18n";
import { HtmlLangSync } from "@/src/components/HtmlLangSync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "VGM Quiz - Test Your Game Music Knowledge",
  description: "Challenge yourself with a quiz on video game music! Identify tracks from classic and modern games, learn about composers, and compete for high scores.",
  icons: {
    icon: "/favicon.ico",
  },
  openGraph: {
    title: "VGM Quiz - Test Your Game Music Knowledge",
    description: "Challenge yourself with a quiz on video game music! Identify tracks from classic and modern games, learn about composers, and compete for high scores.",
    type: "website",
    locale: "ja_JP",
    alternateLocale: ["en_US"],
  },
  twitter: {
    card: "summary_large_image",
    title: "VGM Quiz - Test Your Game Music Knowledge",
    description: "Challenge yourself with a quiz on video game music!",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <I18nProvider>
          <Providers>
            <HtmlLangSync />
            {children}
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
