import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RoleCraft Control Center",
  description: "Administrative control panel for RoleCraft platform.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-500 selection:text-white">
      {children}
    </div>
  );
}
