"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  LifeBuoy,
  CreditCard,
  Sliders,
  ScrollText,
  LogOut,
  ShieldCheck,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { isAdminLoggedIn, getAdminEmail, clearAdminSession } from "@/lib/admin-api";

const NAV_ITEMS = [
  { label: "Overview", href: "/xrc-control/dashboard", icon: LayoutDashboard },
  { label: "Users", href: "/xrc-control/dashboard/users", icon: Users },
  { label: "Support Tickets", href: "/xrc-control/dashboard/support", icon: LifeBuoy },
  { label: "Subscriptions", href: "/xrc-control/dashboard/billing", icon: CreditCard },
  { label: "Site Config", href: "/xrc-control/dashboard/config", icon: Sliders },
  { label: "Audit Logs", href: "/xrc-control/dashboard/logs", icon: ScrollText },
];

export default function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!isAdminLoggedIn()) {
      router.replace("/xrc-control");
      return;
    }
    setAdminEmail(getAdminEmail());
  }, [router]);

  const handleLogout = () => {
    clearAdminSession();
    router.replace("/xrc-control");
  };

  if (!mounted || !isAdminLoggedIn()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
          <span>Validating admin credentials...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between fixed inset-y-0 z-30">
        <div>
          {/* Brand Header */}
          <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-tight text-slate-900 flex items-center gap-1.5">
                  RoleCraft
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                    Control
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-medium">Administrator</div>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/xrc-control/dashboard"
                  ? pathname === "/xrc-control/dashboard"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700 font-semibold shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 space-y-2">
          {/* Main Website Link */}
          <a
            href="https://rolecraft.tech"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100/60 transition-all font-medium"
          >
            <span>Live rolecraft.tech</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          {/* Admin Profile & Logout */}
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <div className="text-xs font-semibold text-slate-800 truncate">
                {adminEmail || "Superuser"}
              </div>
              <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                PIN Session Active
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="pl-64 flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
