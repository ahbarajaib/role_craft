import React, { useEffect, useState } from "react";
import { Sparkles, CheckCircle2, Loader2, FileText, Code, Briefcase, GraduationCap, FolderGit2 } from "lucide-react";

const PARSE_STEPS = [
  { label: "Extracting raw text from document", sub: "Reading headers, tables, bullet formatting...", icon: FileText },
  { label: "Parsing Contact Details & Summary", sub: "Extracting name, headline, email, phone, location...", icon: Sparkles },
  { label: "Categorizing Technical Skills", sub: "Grouping frameworks, languages & databases...", icon: Code },
  { label: "Structuring Work Experience", sub: "Extracting roles, companies, dates & achievements...", icon: Briefcase },
  { label: "Parsing Projects & Education", sub: "Extracting project URLs, descriptions & degrees...", icon: FolderGit2 },
  { label: "Synthesizing Master Resume", sub: "Generating ATS structured JSON record...", icon: GraduationCap },
];

export function ParsingProgressCard({ fileName }: { fileName?: string }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(12);

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStepIndex((prev) => {
        if (prev < PARSE_STEPS.length - 1) return prev + 1;
        return prev;
      });
    }, 3800);

    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev < 94) return prev + Math.floor(Math.random() * 2) + 1;
        return prev;
      });
    }, 450);

    return () => {
      clearInterval(stepTimer);
      clearInterval(progressTimer);
    };
  }, []);

  const currentStep = PARSE_STEPS[stepIndex];

  return (
    <div className="p-8 sm:p-12 rounded-3xl bg-white border border-blue-200 shadow-2xl shadow-blue-500/10 text-center max-w-xl mx-auto space-y-6 my-8 relative overflow-hidden">
      {/* Background Animated Glow */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" />

      {/* Center Glowing Ring Graphic */}
      <div className="relative h-20 w-20 mx-auto flex items-center justify-center">
        <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-blue-600 via-cyan-500 to-blue-500 animate-spin blur-sm opacity-70" style={{ animationDuration: "6s" }} />
        <div className="relative h-16 w-16 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl">
          <Sparkles className="h-8 w-8 text-cyan-300 animate-pulse" />
        </div>
      </div>

      {/* Step Info Header */}
      <div className="space-y-2 relative z-10">
        <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200 inline-block">
          {fileName ? `Parsing ${fileName}` : "AI Resume Parsing in Progress"}
        </span>
        <h3 className="text-lg font-extrabold text-slate-900 flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
          {currentStep.label}
        </h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          {currentStep.sub}
        </p>
      </div>

      {/* Shimmer Progress Bar & % Counter */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between text-xs font-bold text-slate-600 px-1">
          <span>Parsing Progress</span>
          <span className="text-blue-600 font-extrabold">{progress}%</span>
        </div>
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200">
          <div
            className="bg-gradient-to-r from-blue-600 via-cyan-400 to-blue-600 h-full rounded-full transition-all duration-300 relative overflow-hidden"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Live Step Checklist */}
      <div className="grid grid-cols-2 gap-2 text-left pt-2 relative z-10">
        {PARSE_STEPS.slice(0, 4).map((step, idx) => {
          const isDone = idx < stepIndex;
          const isCurrent = idx === stepIndex;
          return (
            <div
              key={idx}
              className={`p-2.5 rounded-xl border text-[11px] font-medium flex items-center gap-2 transition-all ${
                isDone
                  ? "bg-emerald-50/60 border-emerald-200 text-emerald-700"
                  : isCurrent
                  ? "bg-blue-50/60 border-blue-300 text-blue-700 shadow-sm"
                  : "bg-slate-50/40 border-slate-200 text-slate-400"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
              ) : isCurrent ? (
                <Loader2 className="h-3.5 w-3.5 text-blue-600 animate-spin shrink-0" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-slate-300 shrink-0" />
              )}
              <span className="truncate">{step.label.replace("Extracting raw text from document", "Raw Text Extraction")}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
