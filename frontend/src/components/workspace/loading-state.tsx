"use client";

import React, { useState, useEffect } from "react";
import {
  Activity,
  BarChart2,
  CheckCircle,
  FileText,
  GitMerge,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

export function LoadingState() {
  const PIPELINE_STEPS = [
    {
      label: "Reading Document Structure",
      sub: "Parsing DOCX headers, tables & bullet points",
      icon: FileText,
    },
    {
      label: "Extracting JD Keywords",
      sub: "Identifying required skills, tools & responsibilities",
      icon: Search,
    },
    {
      label: "Mapping Resume Sections",
      sub: "Matching experience, skills & projects to JD",
      icon: Layers,
    },
    {
      label: "Evaluating Experience Depth",
      sub: "Assessing impact metrics & evidence quality",
      icon: BarChart2,
    },
    {
      label: "Scoping Evidence & Truthfulness",
      sub: "Cross-checking claims against resume context",
      icon: ShieldCheck,
    },
    {
      label: "Consolidating Recommendations",
      sub: "Deduplicating & prioritizing improvement areas",
      icon: GitMerge,
    },
    {
      label: "Structuring Recruiter Insights",
      sub: "Formatting final ATS score & gap analysis",
      icon: Sparkles,
    },
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(2);

  useEffect(() => {
    const stepDuration = 14000 / PIPELINE_STEPS.length; // spread across ~14s
    const stepTimer = setInterval(() => {
      setCurrentStep((prev) => (prev < PIPELINE_STEPS.length - 1 ? prev + 1 : prev));
    }, stepDuration);
    return () => clearInterval(stepTimer);
  }, [PIPELINE_STEPS.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 97) return 97;
        if (prev < 80) return prev + 1;
        return Math.random() < 0.2 ? prev + 1 : prev;
      });
    }, 160);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative rounded-2xl bg-white border border-slate-200 shadow-xl shadow-teal-500/8 overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      {/* Subtle dot grid */}
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" />

      <div className="relative z-10 p-8">
        {/* Centered Glowing AI Logo with Ambient Background Light */}
        <div className="flex flex-col items-center justify-center pt-2 pb-6 text-center space-y-4">
          <div className="relative flex items-center justify-center">
            {/* Multi-layered ambient background glow light */}
            <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-blue-500/35 via-indigo-500/30 to-cyan-400/35 blur-2xl animate-pulse" />
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-[#0F172A] via-teal-700 to-[#14B8A6] opacity-60 blur-sm animate-pulse" />

            {/* Logo container with soft halo */}
            <div className="relative h-18 w-18 flex items-center justify-center">
              <img
                src="/logo.svg"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = "/logo.png";
                }}
                alt="RoleCraft AI Logo"
                className="h-full w-full object-contain drop-shadow-md"
              />
            </div>
          </div>

          <div className="space-y-1 max-w-md">
            <h3 className="text-xl font-extrabold text-slate-900 tracking-tight flex items-center justify-center gap-2">
              <span>AI Analysis in Progress</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs">
                <span className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-pulse" />
                Live
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              RoleCraft AI is auditing your resume against target job competencies
            </p>
          </div>
        </div>

        {/* Vertical Pipeline Stepper */}
        <div className="space-y-1 mb-8">
          {PIPELINE_STEPS.map((step, idx) => {
            const isDone = idx < currentStep;
            const isCurrent = idx === currentStep;
            const StepIcon = step.icon;

            return (
              <div
                key={idx}
                className={`relative flex items-start gap-3.5 px-4 py-3 rounded-xl transition-all duration-500 ${
                  isCurrent
                    ? "bg-teal-50 border border-teal-200 shadow-sm"
                    : isDone
                      ? "bg-emerald-50/50 border border-emerald-100"
                      : "border border-transparent"
                }`}
              >
                {/* Left timeline line */}
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div
                    className={`absolute left-[22px] top-[42px] w-0.5 h-[calc(100%-8px)] ${
                      isDone ? "bg-emerald-300" : "bg-slate-200"
                    } transition-colors duration-700`}
                  />
                )}

                {/* Step circle */}
                <div
                  className={`relative shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-0.5 z-10 transition-all duration-500 ${
                    isDone
                      ? "bg-emerald-500 shadow-md shadow-emerald-500/30"
                      : isCurrent
                        ? "bg-white border-2 border-teal-500 shadow-md shadow-teal-500/20"
                        : "bg-white border-2 border-slate-200"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle className="h-3.5 w-3.5 text-white" />
                  ) : isCurrent ? (
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-teal-200 border-t-blue-600 animate-spin" />
                  ) : (
                    <div className="h-2.5 w-2.5 rounded-full bg-slate-200" />
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-bold leading-tight transition-colors duration-300 ${
                        isDone ? "text-emerald-700" : isCurrent ? "text-teal-700" : "text-slate-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {isCurrent && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-teal-600 text-white tracking-wide animate-pulse shrink-0">
                        LIVE
                      </span>
                    )}
                    {isDone && (
                      <span className="text-[10px] font-bold text-emerald-600 shrink-0">✓ Done</span>
                    )}
                  </div>
                  <p
                    className={`text-xs mt-0.5 transition-colors duration-300 ${
                      isDone ? "text-emerald-600/70" : isCurrent ? "text-teal-600/80" : "text-slate-400"
                    }`}
                  >
                    {step.sub}
                  </p>
                </div>

                {/* Step icon */}
                <div
                  className={`shrink-0 p-1.5 rounded-lg transition-all duration-300 ${
                    isDone
                      ? "bg-emerald-100 text-emerald-600"
                      : isCurrent
                        ? "bg-[#E6F7F4] text-teal-600"
                        : "bg-slate-100 text-slate-300"
                  }`}
                >
                  <StepIcon className="h-3.5 w-3.5" />
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress Bar Section */}
        <div className="border-t border-slate-100 pt-5 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <div className="flex items-center gap-2 text-slate-600">
              <Activity className="h-3.5 w-3.5 text-teal-500" />
              Pipeline Status
            </div>
            <span className="text-teal-600 font-extrabold text-sm">{progress}%</span>
          </div>
          <div className="relative h-2.5 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#0F172A] via-teal-600 to-[#14B8A6] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            >
              {/* Shimmer */}
              <div className="absolute inset-0 overflow-hidden rounded-full">
                <div className="absolute inset-y-0 -left-full w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-400 italic">
              Concurrent AI review across all sections simultaneously
            </p>
            <span className="text-[11px] font-semibold text-slate-400 shrink-0">~10–15 sec</span>
          </div>
        </div>
      </div>
    </div>
  );
}

