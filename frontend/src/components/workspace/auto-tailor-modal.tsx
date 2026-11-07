"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertCircle,
  Briefcase,
  Check,
  FileText,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";

export interface AutoTailoringProgressModalProps {
  targetRole: string;
  controlledStepIndex?: number;
  controlledProgress?: number;
  isComplete?: boolean;
  onClose?: () => void;
}

export function AutoTailoringProgressModal({
  targetRole,
  controlledStepIndex,
  controlledProgress,
  isComplete,
  onClose,
}: AutoTailoringProgressModalProps) {
  const [internalStepIndex, setInternalStepIndex] = useState(0);
  const [internalProgress, setInternalProgress] = useState(10);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const isControlled = controlledStepIndex !== undefined || controlledProgress !== undefined;
  const stepIndex = isComplete ? 5 : (isControlled ? (controlledStepIndex ?? 0) : internalStepIndex);
  const progress = isComplete ? 100 : (isControlled ? (controlledProgress ?? 0) : Math.round(internalProgress));

  // Elapsed seconds ticker
  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isComplete]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Smooth realistic progress ticker
  useEffect(() => {
    if (isControlled || isComplete) return;

    const timer = setInterval(() => {
      setInternalProgress((prev) => {
        if (prev >= 98) return 98; // Soft ceiling before server completion
        if (prev >= 90) {
          // Micro-creep while awaiting final server assembly
          return Math.min(98, Math.round((prev + 0.06) * 100) / 100);
        }
        const increment = prev < 30 ? 0.9 : prev < 65 ? 0.65 : 0.45;
        const next = Math.min(90, Math.round((prev + increment) * 10) / 10);
        return next;
      });
    }, 200);

    return () => clearInterval(timer);
  }, [isControlled, isComplete]);

  useEffect(() => {
    if (isControlled || isComplete) return;

    // Dynamically advance steps based on smooth progress
    if (internalProgress < 26) setInternalStepIndex(0);
    else if (internalProgress < 50) setInternalStepIndex(1);
    else if (internalProgress < 72) setInternalStepIndex(2);
    else if (internalProgress < 88) setInternalStepIndex(3);
    else setInternalStepIndex(4);
  }, [internalProgress, isControlled, isComplete]);

  const step5Desc = elapsedSeconds > 30
    ? "Deep multi-section LLM synthesis finishing up..."
    : elapsedSeconds > 18
      ? "Formatting final DOCX patch & comparison diff cards..."
      : "Formatting final DOCX patch & comparison diff cards";

  const TAILOR_STEPS = [
    {
      title: "Analyzing Target Role & ATS Keywords",
      desc: "Extracting required competencies, frameworks & role keywords from JD",
      icon: Search,
    },
    {
      title: "Rewriting Experience with Google XYZ Formula",
      desc: "Accomplished [X], as measured by [Y], by doing [Z] with active verbs",
      icon: Briefcase,
    },
    {
      title: "Weaving High-Priority ATS Keywords",
      desc: "Embedding missing technical stack into bullet points & skill matrix",
      icon: Sparkles,
    },
    {
      title: "Optimizing Summary & Project Architecture",
      desc: "Elevating executive pitch & aligning project toolings to JD",
      icon: Layers,
    },
    {
      title: "Generating Side-by-Side Comparison & Patch",
      desc: step5Desc,
      icon: FileText,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="relative w-full max-w-lg rounded-3xl bg-white border border-slate-200 shadow-2xl shadow-teal-500/10 overflow-hidden p-6 sm:p-8 text-slate-900 space-y-5 animate-scale-in">
        {/* Ambient background glows */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

        {/* Top Engine Badge & Close */}
        <div className="relative z-10 flex items-center justify-between">
          <div
            className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold ${
              isComplete
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-teal-50 border-teal-200/80 text-teal-700"
            }`}
          >
            {isComplete ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Zap className="h-3.5 w-3.5 text-teal-600 fill-teal-600 animate-pulse" />
            )}
            <span>{isComplete ? "AI Tailoring Complete" : "AI Tailoring in Progress"}</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black text-emerald-700">
              <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${!isComplete ? "animate-pulse" : ""}`} />
              {isComplete ? "READY" : "LIVE TAILORING"}
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="h-7 w-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer"
                title="Dismiss (continues tailoring in background)"
                aria-label="Close modal"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Center Animated Glowing Ring Graphic */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-3">
          <div className="relative h-20 w-20 flex items-center justify-center">
            <div
              className={`absolute inset-0 rounded-3xl blur-md opacity-60 ${
                isComplete
                  ? "bg-gradient-to-tr from-emerald-400 via-emerald-500 to-green-500"
                  : "bg-gradient-to-tr from-emerald-500 via-teal-400 to-teal-600 animate-spin"
              }`}
              style={{ animationDuration: "4s" }}
            />
            <div className="relative h-16 w-16 rounded-2xl bg-white flex items-center justify-center border border-slate-200 shadow-xl">
              {isComplete ? (
                <Check className="h-8 w-8 text-emerald-600" />
              ) : (
                <Sparkles className="h-8 w-8 text-teal-600 animate-pulse" />
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {isComplete ? "Resume Ready!" : "Auto-Tailoring Resume"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Optimized for{" "}
              <span className="font-extrabold text-teal-700 px-2 py-0.5 rounded-lg bg-teal-50 border border-teal-200">
                {targetRole || "Target Position"}
              </span>
            </p>
          </div>
        </div>

        {/* Shimmer Progress Bar */}
        <div className="relative z-10 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span className="flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-teal-600" />
              Tailoring Progress
            </span>
            <span className="text-teal-600 font-extrabold text-sm">{progress}%</span>
          </div>
          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-300 relative overflow-hidden ${
                isComplete ? "bg-emerald-500" : "bg-gradient-to-r from-emerald-500 via-teal-400 to-teal-600"
              }`}
              style={{ width: `${progress}%` }}
            >
              {!isComplete && <div className="absolute inset-0 bg-white/30 animate-pulse" />}
            </div>
          </div>
        </div>

        {/* 5-Step Pipeline Live List */}
        <div className="relative z-10 space-y-1.5">
          {TAILOR_STEPS.map((step, idx) => {
            const isDone = idx < stepIndex;
            const isCurrent = idx === stepIndex;
            const StepIcon = step.icon;

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition-all duration-300 flex items-center justify-between gap-3 ${
                  isCurrent
                    ? "bg-teal-50/90 border-teal-300 text-[#0F172A] shadow-xs"
                    : isDone
                      ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                      : "bg-slate-50 border-slate-200/80 text-slate-400"
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div
                    className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 border ${
                      isDone
                        ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                        : isCurrent
                          ? "bg-[#E6F7F4] border-teal-200 text-teal-700"
                          : "bg-white border-slate-200 text-slate-400"
                    }`}
                  >
                    {isDone ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : isCurrent ? (
                      <div className="h-3.5 w-3.5 rounded-full border-2 border-teal-600 border-t-transparent animate-spin" />
                    ) : (
                      <StepIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-bold truncate ${
                        isDone
                          ? "text-emerald-900"
                          : isCurrent
                            ? "text-[#0F172A] font-extrabold"
                            : "text-slate-500"
                      }`}
                    >
                      {step.title}
                    </p>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {step.desc}
                    </p>
                  </div>
                </div>

                {isCurrent && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#E6F7F4] text-teal-700 border border-teal-200 animate-pulse shrink-0">
                    {idx === 4 && elapsedSeconds > 22 ? "FINALIZING" : "WORKING"}
                  </span>
                )}
                {isDone && (
                  <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                    ✓ Done
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Longer duration notice banner */}
        {!isComplete && elapsedSeconds >= 24 && (
          <div className="relative z-10 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-[11px] flex items-center justify-between gap-2 animate-fade-in">
            <div className="flex items-center gap-1.5 min-w-0">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span className="truncate">AI tailoring multiple sections concurrently. Almost done...</span>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="text-[10px] font-bold text-amber-800 underline hover:text-amber-950 shrink-0 cursor-pointer"
              >
                Dismiss to Background
              </button>
            )}
          </div>
        )}

        {/* Security & Truthfulness Notice Footer */}
        <div className="relative z-10 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 text-slate-600 font-medium">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Strict Truthfulness Guard Active
          </span>
          <span className="font-semibold text-slate-500">
            {isComplete ? (
              <span className="text-emerald-600 font-bold">Done in {elapsedSeconds}s</span>
            ) : elapsedSeconds < 16 ? (
              <span className="text-slate-400">Est. ~15–25 sec</span>
            ) : (
              <span className="text-teal-600 animate-pulse">{elapsedSeconds}s elapsed • Finishing</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

