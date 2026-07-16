import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/context/AuthContext";
import { GoogleOAuthProvider } from '@react-oauth/google';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://brollysolutions.in";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Smart Prompt Generator",
    template: "%s | Smart Prompt Generator",
  },
  description:
    "Turn a rough idea into a polished, structured AI prompt with clarifying questions, quality scoring, and multi-language support.",
  applicationName: "Smart Prompt Generator",
  keywords: ["AI prompt generator", "prompt engineering", "ChatGPT prompts", "Claude prompts"],
  openGraph: {
    title: "Smart Prompt Generator",
    description:
      "Turn a rough idea into a polished, structured AI prompt with clarifying questions and quality scoring.",
    url: siteUrl,
    siteName: "Smart Prompt Generator",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Smart Prompt Generator",
    description: "Turn a rough idea into a polished, structured AI prompt.",
  },
  robots: { index: true, follow: true },
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
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased overflow-x-hidden max-w-[100vw]`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden w-full max-w-[100vw]">
        <a href="#main-content" className="skip-link">Skip to content</a>
        <AuthProvider>
          {/* display:contents -> a11y <main> landmark + skip-link target with no layout impact */}
          <main id="main-content" tabIndex={-1} style={{ display: "contents" }}>
            {googleClientId ? (
              <GoogleOAuthProvider clientId={googleClientId}>
                <TooltipProvider>{children}</TooltipProvider>
              </GoogleOAuthProvider>
            ) : (
              <TooltipProvider>{children}</TooltipProvider>
            )}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
