"use client";

import { useState, useMemo } from "react";
import {
  X, Sparkles, ChevronLeft, ChevronRight, ListFilter, ArrowRight,
  Briefcase, Layers, FileText, LayoutList, CheckCircle2,
} from "lucide-react";
import { DiffMap, StructuredResume } from "@/lib/structured_resume_api";
import ResumeDownloadPanel from "@/components/resume_download_panel";

interface TailorPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  tailoredResumeId: number;
  tailoredResume: StructuredResume;
  diff: DiffMap;
  jobTitle: string;
  jobCompany?: string;
  sourceFormat?: "docx" | "pdf" | "manual" | null;
  fullName?: string;
}

function fieldLabel(path: string): string {
  const p = path.toLowerCase();
  if (p.includes("summary")) return "Professional Summary";
  const expMatch = path.match(/experience\[(\d+)\]\.bullets/);
  if (expMatch) return `Experience #${parseInt(expMatch[1]) + 1} — Bullets`;
  const projMatch = path.match(/projects\[(\d+)\]\.bullets/);
  if (projMatch) return `Project #${parseInt(projMatch[1]) + 1} — Bullets`;
  if (p.includes("skills")) return "Skills";
  return path.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fieldIcon(path: string) {
  const p = path.toLowerCase();
  if (p.includes("summary")) return FileText;
  if (p.includes("experience")) return Briefcase;
  if (p.includes("projects")) return LayoutList;
  if (p.includes("skills")) return Layers;
  return LayoutList;
}

export default function TailorPreviewModal({
  isOpen,
  onClose,
  tailoredResumeId,
  tailoredResume,
  diff,
  jobTitle,
  jobCompany,
  sourceFormat,
  fullName,
}: TailorPreviewModalProps) {
  const [viewMode, setViewMode] = useState<"step" | "all">("step");
  const [currentIdx, setCurrentIdx] = useState(0);

  const diffEntries = useMemo(() => Object.entries(diff), [diff]);
  const total = diffEntries.length;
  const current = diffEntries[currentIdx] ?? null;
  const jobLabel = jobCompany ? `${jobTitle} @ ${jobCompany}` : jobTitle;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-sm shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    AI Tailored Resume Preview
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-extrabold text-[10px] border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    🔒 Facts & Dates Preserved 100%
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Optimized for: <span className="text-amber-700 dark:text-amber-400 font-bold">{jobLabel}</span>
                  {total > 0 && <span className="ml-2 text-slate-400">· {total} section{total !== 1 ? "s" : ""} tailored</span>}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 dark:bg-slate-950/20">
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-12 h-12 mb-3 text-emerald-500" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Your resume already perfectly matches this target role!</p>
              <p className="text-xs mt-1 text-slate-500">You can download directly using any of the 4 templates below.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">

              {/* View Mode Stepper Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <button
                    onClick={() => setViewMode("step")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "step"
                        ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    Step through changes
                  </button>
                  <button
                    onClick={() => setViewMode("all")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      viewMode === "all"
                        ? "bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-sm"
                        : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <ListFilter className="w-3.5 h-3.5" />
                    View all {total} changes
                  </button>
                </div>
              </div>

              {/* Step View */}
              {viewMode === "step" && current && (
                <div className="space-y-4">
                  {/* Section Title & Stepper Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = fieldIcon(current[0]);
                        return <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400" />;
                      })()}
                      <span className="text-sm font-bold text-slate-900 dark:text-white">{fieldLabel(current[0])}</span>
                      {current[1].company && (
                        <span className="text-xs text-slate-500 font-semibold">· {current[1].company}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">Change {currentIdx + 1} of {total}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                          disabled={currentIdx === 0}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer shadow-xs"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
                          disabled={currentIdx === total - 1}
                          className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer shadow-xs"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Before / After Diff Card */}
                  <DiffCard entry={current[1]} />

                  {/* Dot Indicators */}
                  <div className="flex justify-center gap-1.5 pt-2">
                    {diffEntries.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentIdx(i)}
                        className={`h-2 rounded-full transition-all cursor-pointer ${
                          i === currentIdx ? "bg-teal-600 dark:bg-indigo-400 w-5" : "bg-slate-300 dark:bg-slate-700 w-2 hover:bg-slate-400"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* View All Changes View */}
              {viewMode === "all" && (
                <div className="space-y-5">
                  {diffEntries.map(([path, entry]) => {
                    const Icon = fieldIcon(path);
                    return (
                      <div key={path} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50 flex items-center gap-2">
                          <Icon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span className="text-xs font-bold text-slate-900 dark:text-white">{fieldLabel(path)}</span>
                          {entry.company && <span className="text-xs text-slate-500 font-medium">· {entry.company}</span>}
                        </div>
                        <div className="p-4">
                          <DiffCard entry={entry} compact />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Download Section */}
        <div className="px-6 py-5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Download AI-Tailored Resume</h3>
            <span className="text-xs text-slate-500 font-medium">— select format & template below</span>
          </div>
          <ResumeDownloadPanel
            sourceFormat={sourceFormat}
            tailoredResumeId={tailoredResumeId}
            tailoredJobLabel={jobLabel}
            fullName={fullName}
            compact
          />
        </div>
      </div>
    </div>
  );
}

function DiffCard({ entry, compact = false }: { entry: { original: string; tailored: string }; compact?: boolean }) {
  const origLines = entry.original.split("\n").filter(Boolean);
  const tailoredLines = entry.tailored.split("\n").filter(Boolean);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {/* Original Content Card */}
      <div className="rounded-2xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 p-4">
        <div className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          Original Bullet / Summary
        </div>
        <div className="space-y-2">
          {origLines.map((line, i) => (
            <p key={i} className="text-xs font-medium text-slate-600 dark:text-slate-400 leading-relaxed line-through decoration-rose-400/60">
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* AI Tailored Content Card */}
      <div className="rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 p-4 shadow-xs">
        <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          AI Tailored (Keywords Weaved)
        </div>
        <div className="space-y-2">
          {tailoredLines.map((line, i) => (
            <p key={i} className="text-xs font-semibold text-slate-900 dark:text-emerald-100 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
