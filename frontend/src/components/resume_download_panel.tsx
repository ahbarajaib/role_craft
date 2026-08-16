"use client";

import { useState } from "react";
import {
  Download, FileText, Sparkles, Loader2, AlertTriangle, Palette,
  CheckCircle2, ChevronRight
} from "lucide-react";
import {
  downloadStructuredResume,
  exportOriginalResume,
  downloadTailoredResume,
} from "@/lib/structured_resume_api";

interface ResumeDownloadPanelProps {
  /** "docx" if user uploaded a DOCX (original design available), "pdf" or null otherwise */
  sourceFormat?: "docx" | "pdf" | "manual" | null;
  /** If set, downloads use tailored content instead of master */
  tailoredResumeId?: number;
  /** Display name for the tailored job */
  tailoredJobLabel?: string;
  /** Optional full name for download filename */
  fullName?: string;
  /** Compact layout for embedding inside another modal */
  compact?: boolean;
}

const TEMPLATES = [
  {
    id: "original",
    label: "Original Design",
    desc: "Your uploaded DOCX layout",
    icon: Palette,
    bgLight: "bg-purple-50 hover:bg-purple-100/80 border-purple-200 text-purple-950 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-100",
    iconColor: "text-purple-600 dark:text-purple-400",
    requiresDocx: true,
  },
  {
    id: "clean_classic",
    label: "Clean Classic",
    desc: "Minimal ATS-optimised",
    icon: FileText,
    bgLight: "bg-blue-50 hover:bg-blue-100/80 border-blue-200 text-blue-950 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-100",
    iconColor: "text-blue-600 dark:text-blue-400",
    requiresDocx: false,
  },
  {
    id: "modern_professional",
    label: "Modern Professional",
    desc: "Bold & contemporary",
    icon: Sparkles,
    bgLight: "bg-indigo-50 hover:bg-indigo-100/80 border-indigo-200 text-indigo-950 dark:bg-indigo-950/30 dark:border-indigo-800 dark:text-indigo-100",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    requiresDocx: false,
  },
  {
    id: "executive_profile",
    label: "Executive Profile",
    desc: "Premium with photo",
    icon: CheckCircle2,
    bgLight: "bg-amber-50 hover:bg-amber-100/80 border-amber-200 text-amber-950 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-100",
    iconColor: "text-amber-600 dark:text-amber-400",
    requiresDocx: false,
  },
] as const;

export default function ResumeDownloadPanel({
  sourceFormat,
  tailoredResumeId,
  tailoredJobLabel,
  fullName,
  compact = false,
}: ResumeDownloadPanelProps) {
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const [downloading, setDownloading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successTemplate, setSuccessTemplate] = useState<string | null>(null);

  const hasOriginalDesign = sourceFormat === "docx";

  const handleDownload = async (templateId: string) => {
    setError(null);
    setDownloading(templateId);
    setSuccessTemplate(null);

    const namePrefix = fullName ? `${fullName} - ` : "";
    const jobLabel = tailoredJobLabel ? ` (${tailoredJobLabel})` : "";

    try {
      if (templateId === "original") {
        const filename = `${namePrefix}Resume${jobLabel} - Original Design.docx`;
        await exportOriginalResume(tailoredResumeId, filename);
      } else {
        const filename = `${namePrefix}Resume${jobLabel} - ${templateId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}.${format}`;
        if (tailoredResumeId != null) {
          await downloadTailoredResume(tailoredResumeId, templateId, format, filename);
        } else {
          await downloadStructuredResume(templateId, format, filename);
        }
      }
      setSuccessTemplate(templateId);
      setTimeout(() => setSuccessTemplate(null), 1000);
    } catch (err: any) {
      if (templateId === "original" && err.message?.includes("injection")) {
        // Graceful fallback to Clean Classic
        setError("Original design injection failed for this complex layout — downloading Clean Classic instead.");
        try {
          const fallbackFilename = `${namePrefix}Resume${jobLabel} - Clean Classic.${format}`;
          if (tailoredResumeId != null) {
            await downloadTailoredResume(tailoredResumeId, "clean_classic", format, fallbackFilename);
          } else {
            await downloadStructuredResume("clean_classic", format, fallbackFilename);
          }
        } catch {
          // ignore fallback error
        }
      } else {
        setError(err.message || "Download failed. Please try again.");
      }
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      {/* Format Toggle Bar */}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">File Format:</span>
        <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 gap-1">
          {(["pdf", "docx"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                format === f
                  ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200 dark:border-slate-700"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Template Grid */}
      <div className={`grid ${compact ? "grid-cols-2 gap-2.5" : "grid-cols-2 gap-3"}`}>
        {TEMPLATES.map((tmpl) => {
          const disabled = tmpl.requiresDocx && !hasOriginalDesign;
          const isDownloading = downloading === tmpl.id;
          const isSuccess = successTemplate === tmpl.id;
          const Icon = tmpl.icon;

          return (
            <button
              key={tmpl.id}
              onClick={() => !disabled && handleDownload(tmpl.id)}
              disabled={disabled || !!downloading}
              className={`relative flex items-center gap-3 p-3 rounded-2xl border transition-all text-left shadow-sm
                ${disabled
                  ? "opacity-40 cursor-not-allowed border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"
                  : `${tmpl.bgLight} cursor-pointer hover:shadow-md active:scale-[0.98]`
                }
                ${!!downloading && !isDownloading ? "opacity-50" : ""}
              `}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                ${disabled ? "bg-slate-200 dark:bg-slate-800" : "bg-white/80 dark:bg-slate-900/80 shadow-xs"}`}>
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Icon className={`w-4 h-4 ${disabled ? "text-slate-400" : tmpl.iconColor}`} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-xs font-bold truncate ${disabled ? "text-slate-400" : "text-slate-900 dark:text-white"}`}>
                  {tmpl.label}
                </div>
                <div className={`text-[11px] font-medium truncate ${disabled ? "text-slate-400" : "text-slate-500 dark:text-slate-400"}`}>
                  {disabled ? "DOCX upload required" : tmpl.requiresDocx ? "Your DOCX layout" : tmpl.desc}
                </div>
              </div>
              {!disabled && !isDownloading && !isSuccess && (
                <Download className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 text-xs font-medium">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
