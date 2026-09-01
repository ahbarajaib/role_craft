"use client";

import React from "react";
import { DailyTargetSummary } from "@/lib/api";
import { Target, History, Sparkles, Trophy, ChevronRight, X } from "lucide-react";

interface DailyGoalCardProps {
  dailyGoal: DailyTargetSummary;
  onUpdateTarget: (newTarget: number) => Promise<void>;
  isUpdatingTarget?: boolean;
  onOpenHistory: () => void;
  onHide?: () => void;
}

export function DailyGoalCard({
  dailyGoal,
  onUpdateTarget,
  isUpdatingTarget = false,
  onOpenHistory,
  onHide,
}: DailyGoalCardProps) {
  const percentage = Math.min(100, Math.round(dailyGoal.progress_percentage || 0));
  const isComplete = dailyGoal.goal_achieved || percentage >= 100;
  const remaining = Math.max(0, dailyGoal.daily_target - dailyGoal.today_completed);

  return (
    <div
      className={`relative rounded-2xl p-4 sm:p-5 border transition-all duration-300 shadow-sm backdrop-blur-md overflow-hidden animate-fade-in-up ${
        isComplete
          ? "bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/15 border-emerald-500/30 shadow-emerald-500/5 ring-1 ring-emerald-500/20"
          : "bg-gradient-to-r from-teal-500/10 via-indigo-500/10 to-purple-500/10 border-teal-500/20 shadow-teal-500/5"
      }`}
    >
      {/* Decorative ambient background blur */}
      <div className="absolute top-0 right-0 w-64 h-32 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        {/* Left Side: Badge, Status and Motivational Message */}
        <div className="flex items-start sm:items-center gap-3">
          <div
            className={`h-11 w-11 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center text-xl shadow-md shrink-0 transition-transform ${
              isComplete
                ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-500/30 scale-105"
                : "bg-gradient-to-br from-teal-600 to-indigo-600 text-white shadow-teal-500/25"
            }`}
          >
            {isComplete ? "🏆" : "🎯"}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black text-slate-900 flex items-center gap-1.5">
                Today&apos;s Application Target:{" "}
                <span className="text-teal-700 font-extrabold">
                  {dailyGoal.today_completed} of {dailyGoal.daily_target}
                </span>{" "}
                Tailored
              </h3>
              <span
                className={`px-2 py-0.5 rounded-full font-black text-[10px] tracking-wide uppercase border ${
                  isComplete
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-2xs"
                    : "bg-teal-600 text-white border-teal-700 shadow-2xs"
                }`}
              >
                {percentage}% Done
              </span>
            </div>

            <p className="text-xs text-slate-600 font-medium mt-1 leading-snug">
              {isComplete ? (
                <span className="text-emerald-700 font-bold flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-500 inline" />
                  Daily Goal Smashed! Outstanding discipline — you&apos;re 3x more likely to land interviews today.
                </span>
              ) : dailyGoal.today_completed === 0 ? (
                <span>
                  ⚡ Ready to build momentum? Tailor 1 resume to start today&apos;s application streak!
                </span>
              ) : (
                <span>
                  🚀 Great progress! Just{" "}
                  <strong className="text-slate-900">{remaining} more</strong> tailored application
                  {remaining > 1 ? "s" : ""} to crush today&apos;s target.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Right Side: Quick Target Stepper, Analytics Button & Dismiss */}
        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          {/* Quick Target +/- Stepper */}
          <div
            className="flex items-center gap-1 bg-white/90 border border-slate-200 rounded-xl px-2 py-1 shadow-2xs"
            title="Adjust daily goal target"
          >
            <span className="text-[10px] text-slate-400 font-bold uppercase mr-0.5">Goal:</span>
            <button
              type="button"
              disabled={dailyGoal.daily_target <= 1 || isUpdatingTarget}
              onClick={() => onUpdateTarget(dailyGoal.daily_target - 1)}
              className="h-6 w-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 select-none"
              title="Decrease daily target"
            >
              −
            </button>
            <span className="text-xs font-black text-slate-900 px-1 min-w-[20px] text-center">
              {dailyGoal.daily_target}
            </span>
            <button
              type="button"
              disabled={dailyGoal.daily_target >= 50 || isUpdatingTarget}
              onClick={() => onUpdateTarget(dailyGoal.daily_target + 1)}
              className="h-6 w-6 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 select-none"
              title="Increase daily target"
            >
              +
            </button>
          </div>

          {/* Detailed History & Goals Analytics Button */}
          <button
            type="button"
            onClick={onOpenHistory}
            className="touch-target px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-300 text-xs font-bold shadow-2xs transition-all cursor-pointer flex items-center gap-1.5 select-none"
            title="View 7-day application streak and history"
          >
            <History className="h-3.5 w-3.5 text-teal-600" />
            <span className="hidden sm:inline">Analytics</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
          </button>

          {/* Optional Hide / Turn Off quick button */}
          {onHide && (
            <button
              type="button"
              onClick={onHide}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
              title="Hide goal banner (toggle anytime in profile menu)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Dynamic Animated Progress Bar */}
      <div className="relative mt-3.5 w-full h-2.5 bg-slate-200/80 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-300/40">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isComplete
              ? "bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-500 animate-pulse"
              : "bg-gradient-to-r from-teal-500 via-cyan-500 to-indigo-600"
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
