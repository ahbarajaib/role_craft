"use client";

import { useState } from "react";
import {
  Download, FileText, Sparkles, Loader2, AlertTriangle, Palette,
  CheckCircle2, ChevronDown
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
    color: "from-purple-500/20 to-pink-500/20",
    border: "border-purple-500/30 hover:border-purple-400/60",
    iconColor: "text-purple-400",
    requiresDocx: true,
  },
  {
    id: "clean_classic",
    label: "Clean Classic",
    desc: "Minimal ATS-optimised",
    icon: FileText,
    color: "from-blue-500/20 to-cyan-500/20",
    border: "border-blue-500/30 hover:border-blue-400/60",
    iconColor: "text-blue-400",
    requiresDocx: false,
  },
  {
    id: "modern_professional",
    label: "Modern Professional",
    desc: "Bold & contemporary",
    icon: Sparkles,
    color: "from-indigo-500/20 to-violet-500/20",
    border: "border-indigo-500/30 hover:border-indigo-400/60",
    iconColor: "text-indigo-400",
    requiresDocx: false,
  },
  {
    id: "executive_profile",
    label: "Executive Profile",
    desc: "Premium with photo",
    icon: CheckCircle2,
    color: "from-amber-500/20 to-orange-500/20",
    border: "border-amber-500/30 hover:border-amber-400/60",
    iconColor: "text-amber-400",
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
      setTimeout(() => setSuccessTemplate(null), 2500);
    } catch (err: any) {
      if (templateId === "original" && err.message?.includes("injection")) {
        // Graceful fallback: try Clean Classic
        setError("Original design injection failed — downloading Clean Classic instead.");
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
      {/* Format toggle */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-400">Format:</span>
        <div className="flex bg-white/5 border border-white/10 rounded-lg p-0.5 gap-0.5">
          {(["pdf", "docx"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                format === f
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        {tailoredJobLabel && (
          <span className="ml-auto text-xs text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            {tailoredJobLabel}
          </span>
        )}
      </div>

      {/* Template buttons */}
      <div className={`grid ${compact ? "grid-cols-2 gap-2" : "grid-cols-2 gap-3"}`}>
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
              className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                ${disabled
                  ? "opacity-30 cursor-not-allowed border-white/5 bg-white/[0.01]"
                  : `bg-gradient-to-br ${tmpl.color} ${tmpl.border} cursor-pointer hover:scale-[1.02] active:scale-[0.98]`
                }
                ${!!downloading && !isDownloading ? "opacity-50" : ""}
              `}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                ${disabled ? "bg-white/5" : "bg-black/20"}`}>
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                ) : isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Icon className={`w-4 h-4 ${disabled ? "text-slate-600" : tmpl.iconColor}`} />
                )}
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-semibold truncate ${disabled ? "text-slate-600" : "text-white"}`}>
                  {tmpl.label}
                </div>
                <div className={`text-[10px] truncate ${disabled ? "text-slate-700" : "text-slate-400"}`}>
                  {disabled ? "DOCX upload required" : tmpl.requiresDocx ? "DOCX only" : tmpl.desc}
                </div>
              </div>
              {!disabled && !isDownloading && !isSuccess && (
                <Download className="w-3.5 h-3.5 text-slate-500 ml-auto shrink-0" />
              )}
            </button>
          );
        })}
      </div>

      {/* Error toast */}
      {error && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
