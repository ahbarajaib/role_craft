"use client";

import { useState, useMemo } from "react";
import {
  X, Sparkles, ChevronLeft, ChevronRight, ListFilter, ArrowRight,
  Briefcase, Layers, FileText, LayoutList,
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
  if (p.includes("skills")) return "Skills";
  return path.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fieldIcon(path: string) {
  const p = path.toLowerCase();
  if (p.includes("summary")) return FileText;
  if (p.includes("experience")) return Briefcase;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0f1117] border border-white/10 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-[#111318] shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">AI Tailored Resume</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  For: <span className="text-amber-400 font-medium">{jobLabel}</span>
                  {total > 0 && <span className="ml-2 text-slate-500">· {total} change{total !== 1 ? "s" : ""} made</span>}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Sparkles className="w-10 h-10 mb-3 text-slate-700" />
              <p className="text-sm">No content changes were needed for this job.</p>
              <p className="text-xs mt-1 text-slate-600">Your resume already aligns well with this role.</p>
            </div>
          ) : (
            <div className="p-6 space-y-6">
              {/* View mode toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode("step")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === "step" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                  Step through changes
                </button>
                <button
                  onClick={() => setViewMode("all")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    viewMode === "all" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <ListFilter className="w-3.5 h-3.5" />
                  View all {total} changes
                </button>
              </div>

              {viewMode === "step" && current && (
                <div className="space-y-4">
                  {/* Pagination */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Icon = fieldIcon(current[0]);
                        return <Icon className="w-4 h-4 text-slate-400" />;
                      })()}
                      <span className="text-sm font-semibold text-white">{fieldLabel(current[0])}</span>
                      {current[1].company && (
                        <span className="text-xs text-slate-500">· {current[1].company}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">{currentIdx + 1} / {total}</span>
                      <button
                        onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                        disabled={currentIdx === 0}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}
                        disabled={currentIdx === total - 1}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Side by side diff */}
                  <DiffCard entry={current[1]} />

                  {/* Step dots */}
                  <div className="flex justify-center gap-1.5">
                    {diffEntries.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentIdx(i)}
                        className={`w-1.5 h-1.5 rounded-full transition-all ${
                          i === currentIdx ? "bg-indigo-400 w-4" : "bg-white/20 hover:bg-white/40"
                        }`}
                      />
                    ))}
                  </div>
                </div>
              )}

              {viewMode === "all" && (
                <div className="space-y-4">
                  {diffEntries.map(([path, entry]) => {
                    const Icon = fieldIcon(path);
                    return (
                      <div key={path} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                        <div className="px-4 py-2.5 border-b border-white/10 bg-white/[0.02] flex items-center gap-2">
                          <Icon className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-semibold text-slate-300">{fieldLabel(path)}</span>
                          {entry.company && <span className="text-xs text-slate-500 ml-1">· {entry.company}</span>}
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

        {/* Download section */}
        <div className="px-6 py-5 border-t border-white/10 bg-[#111318] shrink-0">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-semibold text-white">Download Tailored Resume</h3>
            <span className="text-xs text-slate-500">— using AI-tailored content above</span>
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
    <div className={`grid grid-cols-2 gap-3 ${compact ? "" : ""}`}>
      {/* Original */}
      <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3">
        <div className="text-[10px] font-semibold text-red-400 uppercase tracking-wider mb-2">Original</div>
        <div className="space-y-1.5">
          {origLines.map((line, i) => (
            <p key={i} className="text-xs text-slate-400 leading-relaxed line-through decoration-red-500/40">
              {line}
            </p>
          ))}
        </div>
      </div>

      {/* Tailored */}
      <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3">
        <div className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" />
          AI Tailored
        </div>
        <div className="space-y-1.5">
          {tailoredLines.map((line, i) => (
            <p key={i} className="text-xs text-emerald-100 leading-relaxed">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
