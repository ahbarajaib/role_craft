"use client";

import React from "react";
import { DailyTargetSummary } from "@/lib/api";
import { History, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";

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
      className={`relative rounded-xl py-2 px-3.5 sm:px-4 border transition-all duration-200 shadow-2xs backdrop-blur-md flex items-center justify-between gap-3 text-xs animate-fade-in ${
        isComplete
          ? "bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-emerald-500/5"
          : "bg-white/90 dark:bg-slate-900/90 border-teal-200/80 dark:border-slate-800 text-slate-800 shadow-teal-500/5"
      }`}
    >
      {/* Left: icon + stats + mini progress */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="text-sm shrink-0">{isComplete ? "🏆" : "🎯"}</span>
        <div className="flex items-center gap-2 truncate">
          <span className="font-extrabold text-slate-900 text-xs truncate">
            Today: <span className="text-teal-700 font-black">{dailyGoal.today_completed}/{dailyGoal.daily_target}</span> Tailored
          </span>
          <Badge
            variant={isComplete ? "success" : "default"}
            size="sm"
          >
            {percentage}%
          </Badge>
          <span className="hidden md:inline text-[11px] text-slate-500 font-medium truncate">
            • {isComplete ? "Daily target smashed!" : `${remaining} more to hit today's target`}
          </span>
        </div>

        {/* Slim progress bar in the same line */}
        <div className="w-14 sm:w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shrink-0 hidden sm:block">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isComplete ? "bg-emerald-500" : "bg-gradient-to-r from-teal-500 to-indigo-600"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Right: Quick goal adjust + Stats + Close */}
      <div className="flex items-center gap-1.5 shrink-0">
        <div
          className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 text-[11px]"
          title="Adjust daily target"
        >
          <span className="text-[9px] text-slate-400 font-bold uppercase mr-0.5 hidden sm:inline">Goal:</span>
          <button
            type="button"
            disabled={dailyGoal.daily_target <= 1 || isUpdatingTarget}
            onClick={() => onUpdateTarget(dailyGoal.daily_target - 1)}
            className="h-4.5 w-4.5 rounded bg-white hover:bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 select-none"
            title="Decrease daily target"
          >
            −
          </button>
          <span className="font-black text-slate-800 px-1 text-[11px] min-w-[16px] text-center">
            {dailyGoal.daily_target}
          </span>
          <button
            type="button"
            disabled={dailyGoal.daily_target >= 50 || isUpdatingTarget}
            onClick={() => onUpdateTarget(dailyGoal.daily_target + 1)}
            className="h-4.5 w-4.5 rounded bg-white hover:bg-slate-200 text-slate-700 font-black text-[10px] flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30 select-none"
            title="Increase daily target"
          >
            +
          </button>
        </div>

        <Button
          variant="outline"
          size="xs"
          onClick={onOpenHistory}
          leftIcon={<History className="h-3 w-3 text-teal-600" />}
          title="View detailed activity history & chart"
        >
          <span className="hidden sm:inline">Stats</span>
        </Button>

        {onHide && (
          <button
            type="button"
            onClick={onHide}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition-colors cursor-pointer"
            title="Hide this strip (always visible on top header)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
