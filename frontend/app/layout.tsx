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

export const metadata: Metadata = {
  title: "Prompt Generator",
  description: "AI-powered prompt generation tool",
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
        <AuthProvider>
          {googleClientId ? (
            <GoogleOAuthProvider clientId={googleClientId}>
              <TooltipProvider>{children}</TooltipProvider>
            </GoogleOAuthProvider>
          ) : (
            <TooltipProvider>{children}</TooltipProvider>
          )}
        </AuthProvider>
      </body>
    </html>
  );
}
