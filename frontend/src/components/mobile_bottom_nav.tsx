"use client";

import React from "react";
import Link from "next/link";
import { Layers, FileText, Target, User } from "lucide-react";
import { DailyTargetSummary } from "@/lib/api";

interface MobileBottomNavProps {
  activeNavTab: "landing" | "workspace";
  onSelectNavTab: (tab: "landing" | "workspace") => void;
  onOpenGoals: () => void;
  onOpenProfile: () => void;
  user: {
    name?: string | null;
    email: string;
    credits: number;
    plan_type: string;
  } | null;
  dailyGoal: DailyTargetSummary | null;
}

export function MobileBottomNav({
  activeNavTab,
  onSelectNavTab,
  onOpenGoals,
  onOpenProfile,
  user,
  dailyGoal,
}: MobileBottomNavProps) {
  const goalPercentage = dailyGoal
    ? Math.min(100, Math.round(dailyGoal.progress_percentage || 0))
    : 0;

  return (
    <nav
      aria-label="Mobile Navigation"
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/92 dark:bg-slate-900/92 backdrop-blur-xl border-t border-slate-200/90 dark:border-slate-800/90 px-3 pt-2 shadow-lg shadow-slate-900/5 transition-transform duration-300"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 12px), 12px)" }}
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* 1. Workspace / Tailor */}
        <button
          type="button"
          onClick={() => onSelectNavTab("workspace")}
          className={`touch-target flex flex-col items-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer active:scale-95 select-none ${
            activeNavTab === "workspace"
              ? "text-teal-600 dark:text-teal-400 font-extrabold"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 font-semibold"
          }`}
          title="Open AI Tailoring Workspace"
        >
          <div className="relative">
            <div
              className={`p-1.5 rounded-xl transition-all ${
                activeNavTab === "workspace"
                  ? "bg-teal-500/15 text-teal-600 dark:text-teal-400 ring-1 ring-teal-500/30 shadow-xs"
                  : "bg-transparent text-slate-500"
              }`}
            >
              <Layers className="h-5 w-5" />
            </div>
            {activeNavTab === "workspace" && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-teal-500 ring-2 ring-white dark:ring-slate-900 animate-pulse" />
            )}
          </div>
          <span className="text-[11px] leading-tight">Workspace</span>
        </button>

        {/* 2. Structured Resume Builder */}
        <Link
          href="/resume-builder"
          className="touch-target flex flex-col items-center gap-1 py-1 px-3 rounded-2xl text-slate-500 hover:text-slate-800 dark:text-slate-400 font-semibold transition-all active:scale-95 select-none"
          title="Create or Edit Resume with ATS Templates"
        >
          <div className="p-1.5 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
            <FileText className="h-5 w-5" />
          </div>
          <span className="text-[11px] leading-tight">Builder</span>
        </Link>

        {/* 3. Daily Goals & Streak History */}
        <button
          type="button"
          onClick={onOpenGoals}
          className="touch-target flex flex-col items-center gap-1 py-1 px-3 rounded-2xl text-slate-500 hover:text-slate-800 dark:text-slate-400 font-semibold transition-all cursor-pointer active:scale-95 select-none"
          title="View Daily Target & Application History"
        >
          <div className="relative">
            <div className="p-1.5 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
              <Target className="h-5 w-5" />
            </div>
            {dailyGoal && (
              <span
                className={`absolute -top-1 -right-2 px-1 py-0.2 rounded-full text-[9px] font-black leading-none border shadow-2xs ${
                  dailyGoal.goal_achieved
                    ? "bg-emerald-500 text-white border-emerald-600"
                    : "bg-teal-50 text-teal-700 dark:bg-slate-800 dark:text-teal-300 border-teal-200 dark:border-teal-500/30"
                }`}
              >
                {dailyGoal.today_completed}/{dailyGoal.daily_target}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-tight">Goals</span>
        </button>

        {/* 4. Profile & Account / Sign In */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="touch-target flex flex-col items-center gap-1 py-1 px-3 rounded-2xl text-slate-500 hover:text-slate-800 dark:text-slate-400 font-semibold transition-all cursor-pointer active:scale-95 select-none"
          title="Account, Base Resume & Credits"
        >
          <div className="relative">
            {user ? (
              <div className="h-7 w-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black flex items-center justify-center text-[10px] shadow-xs">
                {(user.name || user.email)[0].toUpperCase()}
              </div>
            ) : (
              <div className="p-1.5 rounded-xl transition-all hover:bg-slate-100 dark:hover:bg-slate-800">
                <User className="h-5 w-5" />
              </div>
            )}
            {user && (
              <span className="absolute -bottom-1 -right-2 px-1 py-0.2 rounded-full bg-emerald-500 text-white font-black text-[8px] leading-none border border-white dark:border-slate-900 shadow-2xs">
                {user.credits}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-tight">Account</span>
        </button>
      </div>
    </nav>
  );
}
