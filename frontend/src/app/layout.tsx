import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RoleCraft – AI-Powered Resume Optimization",
  description: "Craft every resume for the role. Beat ATS scanners, weave missing keywords, and triple your interview callbacks.",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "RoleCraft – AI-Powered Resume Optimization",
    description: "Craft every resume for the role. Recruiter-grade AI tailoring with 100% visual DOCX formatting preservation.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col hero-mesh text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
