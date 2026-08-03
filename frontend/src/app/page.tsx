"use client";

import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  UploadCloud,
  CheckCircle,
  AlertCircle,
  FileText,
  Sparkles,
  TrendingUp,
  X,
  Info,
  Lock,
  ShieldAlert,
  HelpCircle,
  Activity,
  Layers,
  ArrowRight,
  Cpu,
  BookOpen,
  Code,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Edit,
  RotateCcw,
  Sun,
  Moon,
  Target,
  Shield,
  PenTool,
  Download,
  LogOut,
  User,
  Globe,
  Link as LinkIcon,
  ExternalLink,
  Briefcase,
  History,
  Plus
} from "lucide-react";
import { uploadResume, analyzeResume, rewriteSection, applyRewrites, generateCoverLetter, updateCoverLetter, calculateProfileCompletion, API_BASE_URL, ResumeAnalysisResult, ReviewedSection, StrengthItem, ImprovementItem, fetchAnalysisHistory } from "@/lib/api";
import { useAuth } from "@/components/auth_provider";
import AuthModal from "@/components/auth_modal";
import SubscriptionModal from "@/components/subscription_modal";
import HistoryModal from "@/components/history_modal";
import FeaturesShowcase from "@/components/features_showcase";
import TestimonialsSection from "@/components/testimonials_section";
import FaqSection from "@/components/faq_section";
import { ProfileModal } from "@/components/profile_modal";

interface DiffToken {
  value: string;
  added?: boolean;
  removed?: boolean;
}

function diffWords(oldStr: string, newStr: string): DiffToken[] {
  if (!oldStr) return [{ value: newStr, added: true }];
  if (!newStr) return [{ value: oldStr, removed: true }];

  // Split by whitespace and keep space delimiters
  const oldWords = oldStr.split(/(\s+)/);
  const newWords = newStr.split(/(\s+)/);

  const dp: number[][] = Array(oldWords.length + 1)
    .fill(0)
    .map(() => Array(newWords.length + 1).fill(0));

  for (let i = 1; i <= oldWords.length; i++) {
    for (let j = 1; j <= newWords.length; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const result: DiffToken[] = [];
  let i = oldWords.length;
  let j = newWords.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      result.unshift({ value: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      result.unshift({ value: newWords[j - 1], added: true });
      j--;
    } else {
      result.unshift({ value: oldWords[i - 1], removed: true });
      i--;
    }
  }

  return result;
}

function FormattedSectionText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const bulletSymbols = ["•", "-", "*", "–", "—", "▪", "▸"];

  // Heuristic: if most lines are long sentences (> 40 chars), treat the whole block as
  // a bullet list even if there are no explicit bullet symbols.
  // This handles AI output that returns bare sentences separated by newlines.
  const longSentenceLines = lines.filter(
    (l) => l.trim().length > 40 && !l.trim().includes(": ")
  );
  const isImplicitBulletBlock =
    lines.length >= 2 &&
    longSentenceLines.length >= Math.ceil(lines.length * 0.6);

  return (
    <div className={`space-y-2.5 text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed ${className || ""}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const bulletMatch = bulletSymbols.find((s) => trimmed.startsWith(s));

        // Case 1: Explicit bullet symbol prefix
        if (bulletMatch) {
          const content = trimmed.substring(bulletMatch.length).trim();
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0 mt-0.5 select-none">•</span>
              <p className="flex-1 select-all">{content}</p>
            </div>
          );
        }

        // Case 2: Skills category lines — "Frontend: React, Next.js" OR "AI & LLM Engineering: OpenAI, ..."
        // Detect: colon appears within first 45 chars, rest is a list (has commas or tech keywords)
        const colonIdx = trimmed.indexOf(":");
        const labelPart = colonIdx > 0 ? trimmed.substring(0, colonIdx) : "";
        const restPart = colonIdx > 0 ? trimmed.substring(colonIdx + 1).trim() : "";

        // A skill category line has:
        // - short label (max ~45 chars = up to ~6 words)
        // - not in an implicit bullet block
        // - rest of line contains commas (list of values) or is 2–6 words (short tool list)
        // - label doesn't start with a lowercase letter (which would indicate a continuing sentence)
        const isSkillCategory =
          !isImplicitBulletBlock &&
          colonIdx > 0 &&
          labelPart.length >= 3 &&
          labelPart.length <= 45 &&
          labelPart.split(" ").length <= 6 &&
          (labelPart[0] === labelPart[0].toUpperCase()) &&
          (restPart.includes(",") || restPart.split(" ").length <= 8);

        if (isSkillCategory) {
          const label = trimmed.substring(0, colonIdx + 1);
          const rest = trimmed.substring(colonIdx + 1);
          return (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 select-all flex flex-wrap items-baseline gap-1.5"
            >
              <span className="font-bold text-indigo-700 dark:text-indigo-300 text-xs tracking-wide uppercase">
                {label}
              </span>
              <span className="text-slate-800 dark:text-slate-200 text-xs">{rest}</span>
            </div>
          );
        }

        // Case 3: Job Title / Role & Date header line (e.g. "Wordpress Developer      Feb 2025 - Present")
        const lowerLine = trimmed.toLowerCase();
        const isDateHeader = /\b(19|20)\d{2}\b/.test(trimmed) || lowerLine.includes("present");
        const isJobRoleHeader =
          !isImplicitBulletBlock &&
          (isDateHeader ||
            ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst"].some(r => lowerLine.includes(r)));

        if (isJobRoleHeader && trimmed.length < 90 && !trimmed.endsWith(".")) {
          return (
            <div key={idx} className="font-extrabold text-slate-900 dark:text-white text-sm pt-2.5 pb-1 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 mt-1">
              <span>{trimmed}</span>
            </div>
          );
        }

        // Case 4: Company & Location header line (e.g. "Infinitus International FZE, Dubai, UAE.")
        const isCompanyHeader =
          !isImplicitBulletBlock &&
          (trimmed.includes(",") || trimmed.endsWith(".")) &&
          ["inc", "ltd", "llc", "fze", "pvt", "corp", "dubai", "uae", "usa", "uk", "india", "bangalore", "remote", "freelance"].some(loc => lowerLine.includes(loc));

        if (isCompanyHeader && trimmed.length < 80) {
          return (
            <div key={idx} className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs italic mb-2">
              {trimmed}
            </div>
          );
        }

        // Case 5: Implicit bullet — long achievement sentences without explicit symbol
        if (isImplicitBulletBlock) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="text-indigo-600 dark:text-indigo-400 font-bold shrink-0 mt-0.5 select-none">•</span>
              <p className="flex-1 select-all">{trimmed}</p>
            </div>
          );
        }

        // Case 6: Plain paragraph (short lines, descriptions, summaries)
        return (
          <p key={idx} className="select-all leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

// ─── Helper: parse bullet lines from a rewritten text block ───────────────────
function parseBulletsFromText(text: string): { line: string; isBullet: boolean; isHeader?: boolean; isCompany?: boolean }[] {
  if (!text) return [];
  const bulletSymbols = ["•", "-", "*", "–", "—", "▪", "▸"];

  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const trimmed = line.trim();
      const lowerLine = trimmed.toLowerCase();
      const isExplicitBullet = bulletSymbols.some((s) => trimmed.startsWith(s));

      // Check header / company heuristics (short lines with dates/roles/company suffixes)
      const isDateHeader = /\b(19|20)\d{2}\b/.test(trimmed) || lowerLine.includes("present");
      const isJobRoleHeader =
        !isExplicitBullet &&
        trimmed.length < 90 &&
        !trimmed.endsWith(".") &&
        (isDateHeader || ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst"].some(r => lowerLine.includes(r)));

      const isCompanyHeader =
        !isExplicitBullet &&
        trimmed.length < 80 &&
        (trimmed.includes(",") || trimmed.endsWith(".")) &&
        ["inc", "ltd", "llc", "fze", "pvt", "corp", "dubai", "uae", "usa", "uk", "india", "bangalore", "remote", "freelance"].some(loc => lowerLine.includes(loc));

      if (isJobRoleHeader) {
        return { line: trimmed, isBullet: false, isHeader: true };
      }
      if (isCompanyHeader) {
        return { line: trimmed, isBullet: false, isCompany: true };
      }

      // Default: bullet point if explicit symbol or long sentence
      const isBullet = isExplicitBullet || trimmed.length > 40;
      return { line: trimmed, isBullet };
    });
}

// ─── Helper: rebuild text string, omitting lines at excluded indexes ────────
function filterBulletsByChecked(text: string, excludedIndexes: Set<number>): string {
  if (!text || excludedIndexes.size === 0) return text;
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return lines.filter((_, i) => !excludedIndexes.has(i)).join("\n");
}

// ─── SectionCard React Component (replaces renderSectionCard function) ────────
interface SectionCardProps {
  section: ReviewedSection;
  idx: number;
  isExpanded: boolean;
  onToggle: () => void;
  rewrittenText: string | undefined;
  previousRewrittenText: string | undefined;
  onRevert: (name: string) => void;
  onUndoLastRewrite: (name: string) => void;
  onImproveClick: (name: string, recs: string[]) => void;
  inlineLoadingSections?: Record<string, boolean>;
  triggerInlineRewrite?: (name: string, recs: string[]) => void;
  onBulletExclusionChange?: (sectionName: string, excludedIndexes: Set<number>) => void;
  isPatchingApplied?: boolean;
}

function SectionCard({
  section,
  idx,
  isExpanded,
  onToggle,
  rewrittenText,
  previousRewrittenText,
  onRevert,
  onUndoLastRewrite,
  onImproveClick,
  inlineLoadingSections = {},
  triggerInlineRewrite,
  onBulletExclusionChange,
  isPatchingApplied = false,
}: SectionCardProps) {
  // Per-bullet checkbox state: set of line indexes that are UNCHECKED (excluded)
  const [uncheckedBullets, setUncheckedBullets] = useState<Set<number>>(new Set());

  // Reset unchecked bullets when the rewritten text changes
  useEffect(() => {
    setUncheckedBullets(new Set());
    if (onBulletExclusionChange) {
      onBulletExclusionChange(section.section_name, new Set());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewrittenText]);

  const handleBulletToggle = (lineIdx: number) => {
    setUncheckedBullets((prev) => {
      const next = new Set(prev);
      if (next.has(lineIdx)) {
        next.delete(lineIdx);
      } else {
        next.add(lineIdx);
      }
      if (onBulletExclusionChange) {
        onBulletExclusionChange(section.section_name, next);
      }
      return next;
    });
  };

  // Status-based styles
  const statusStyles = {
    improve: "border-amber-300 hover:border-amber-400 bg-amber-50/20 shadow-sm",
    keep: "border-emerald-300 hover:border-emerald-400 bg-emerald-50/20 shadow-sm",
    reduce_emphasis: "border-slate-200 bg-slate-50/60 opacity-80"
  };

  const badgeStyles = {
    improve: "bg-amber-100 text-amber-900 border-amber-300 font-extrabold",
    keep: "bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold",
    reduce_emphasis: "bg-slate-100 text-slate-800 border-slate-300 font-bold"
  };

  const priorityStyles = {
    high: "bg-rose-100 text-rose-900 border-rose-300 font-extrabold",
    medium: "bg-amber-100 text-amber-900 border-amber-300 font-extrabold",
    low: "bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold"
  };

  const parsedBullets = rewrittenText ? parseBulletsFromText(rewrittenText) : [];
  const hasBullets = parsedBullets.some((b) => b.isBullet);

  const originalTextRaw = section.evidence_used && section.evidence_used.length > 0 ? section.evidence_used.join("\n") : "";
  const parsedOriginalBullets = originalTextRaw ? parseBulletsFromText(originalTextRaw) : [];
  const hasOriginalBullets = parsedOriginalBullets.some((b) => b.isBullet);

  return (
    <div
      key={`${section.section_name}-${idx}`}
      className={`rounded-2xl border transition-all duration-300 bg-white shadow-xs ${statusStyles[section.review_status]}`}
    >
      {/* Clickable Header for Collapsing */}
      <div
        onClick={onToggle}
        className="flex flex-wrap items-center justify-between gap-4 p-5 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <span
            className={`px-2.5 py-1 text-[11px] font-black rounded-lg border uppercase tracking-wider ${badgeStyles[section.review_status]}`}
          >
            {section.review_status === "improve"
              ? "Needs Improvement"
              : section.review_status === "keep"
              ? "Good As Is"
              : "Reduce Emphasis"}
          </span>
          <h3 className="font-black text-slate-900 dark:text-white text-base md:text-lg flex items-center gap-2">
            {section.section_name}
            {rewrittenText && (
              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/90 border border-emerald-300 dark:border-emerald-700 px-2 py-0.5 rounded-full animate-fade-in-up">
                <Sparkles className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                Tailored
              </span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`px-2 py-0.5 text-[10px] font-extrabold rounded-md border uppercase tracking-wider ${priorityStyles[section.priority]}`}
          >
            {section.priority} Priority
          </span>
          {isExpanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-100 dark:border-slate-800/60">

          {/* Rewritten Preview Text with Side-by-Side Comparison */}
          {rewrittenText && (
            <div className="space-y-3 animate-fade-in-up">
              {/* Header Action Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 bg-indigo-50/70 dark:bg-indigo-950/40 p-3 rounded-xl border border-indigo-200 dark:border-indigo-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-indigo-900 dark:text-indigo-200 uppercase tracking-wider block">
                    ⚡ AI Section Rewrite Comparison
                  </span>
                  {hasBullets && (
                    <span className="text-[9px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-800 px-1.5 py-0.5 rounded-md">
                      ✓ Uncheck bullets to exclude
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {previousRewrittenText && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUndoLastRewrite(section.section_name);
                      }}
                      className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-extrabold px-2.5 py-1 border border-amber-300 dark:border-amber-700 rounded-lg bg-amber-100 dark:bg-amber-950/80 hover:bg-amber-200 transition-all duration-300 select-none cursor-pointer"
                    >
                      <RotateCcw className="h-2.5 w-2.5" />
                      Undo
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRevert(section.section_name);
                    }}
                    className="flex items-center gap-1 text-[10px] text-rose-700 dark:text-rose-300 font-extrabold px-2.5 py-1 border border-rose-300 dark:border-rose-700 rounded-lg bg-rose-100 dark:bg-rose-950/80 hover:bg-rose-200 transition-all duration-300 select-none cursor-pointer"
                  >
                    <X className="h-2.5 w-2.5" />
                    Revert
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (triggerInlineRewrite) {
                        triggerInlineRewrite(section.section_name, section.recommendations);
                      } else {
                        onImproveClick(section.section_name, section.recommendations);
                      }
                    }}
                    className="flex items-center gap-1 text-[10px] text-indigo-700 dark:text-indigo-300 font-extrabold px-2.5 py-1 border border-indigo-300 dark:border-indigo-700 rounded-lg bg-indigo-100 dark:bg-indigo-950/80 hover:bg-indigo-200 transition-all duration-300 select-none cursor-pointer"
                  >
                    <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                    Regenerate AI
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onImproveClick(section.section_name, section.recommendations);
                    }}
                    className="flex items-center gap-1 text-[10px] text-slate-800 dark:text-slate-200 font-extrabold px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 transition-all duration-300 select-none cursor-pointer"
                  >
                    <Edit className="h-2.5 w-2.5" />
                    Manual Edit
                  </button>
                </div>
              </div>

              {/* Side-by-side Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Original Resume Text */}
                <div className="bg-rose-50/60 dark:bg-rose-950/30 p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/50 space-y-2 flex flex-col">
                  <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-900/50 pb-2">
                    <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                      Original Resume Text (Before)
                    </span>
                  </div>
                  <div className="pt-1 space-y-2 flex-1 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                    {originalTextRaw ? (
                      hasOriginalBullets ? (
                        parsedOriginalBullets.map((item, origIdx) => {
                          const bulletSymbols = ["•", "-", "*", "–", "—", "▪", "▸"];
                          const bulletMatch = bulletSymbols.find((s) => item.line.startsWith(s));
                          const content = bulletMatch ? item.line.substring(bulletMatch.length).trim() : item.line;

                          if (item.isHeader) {
                            return (
                              <div key={origIdx} className="font-extrabold text-slate-900 dark:text-white text-xs pt-2 pb-1 flex items-center justify-between border-b border-rose-200 dark:border-rose-800/80 mt-1">
                                <span className="flex items-center gap-1.5 text-rose-950 dark:text-rose-200">
                                  <Briefcase className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                  {item.line}
                                </span>
                              </div>
                            );
                          }

                          if (item.isCompany) {
                            return (
                              <div key={origIdx} className="font-semibold text-rose-700 dark:text-rose-400 text-[11px] italic mb-1.5 pl-5">
                                {item.line}
                              </div>
                            );
                          }

                          if (!item.isBullet) {
                            return (
                              <p key={origIdx} className="bg-white/90 dark:bg-slate-900/80 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/30 text-[12px] text-slate-800 dark:text-slate-200 leading-relaxed select-all">
                                {item.line}
                              </p>
                            );
                          }

                          return (
                            <div
                              key={origIdx}
                              className="flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 bg-white/90 dark:bg-slate-900/80 border border-rose-100 dark:border-rose-900/30 shadow-xs"
                            >
                              <span className="mt-1 shrink-0 h-2 w-2 rounded-full bg-rose-400 dark:bg-rose-500" />
                              <p className="flex-1 text-[12px] leading-relaxed text-slate-800 dark:text-slate-200 font-medium select-all">
                                {content}
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        section.evidence_used.map((evText, evIdx) => (
                          <p key={evIdx} className="bg-white/90 dark:bg-slate-900/80 p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/30 text-[12px] text-slate-800 dark:text-slate-200 select-all">
                            {evText}
                          </p>
                        ))
                      )
                    ) : (
                      <div className="p-3 bg-white/90 dark:bg-slate-900/80 rounded-lg border border-rose-200 dark:border-rose-900/40 text-[12px] text-slate-700 dark:text-slate-300 font-medium">
                        <p className="font-bold text-rose-900 dark:text-rose-200 mb-1">{section.section_name}</p>
                        <p className="text-[11px] text-slate-500 italic">Original section content recorded from document.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: AI Tailored Rewritten Text */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 space-y-2 flex flex-col">
                  <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-900/50 pb-2">
                    <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      AI Tailored & Rewritten Text
                    </span>
                  </div>

                  {/* Bullet list with checkboxes, or plain text */}
                  <div className="pt-1 space-y-1.5 flex-1">
                    {hasBullets ? (
                      parsedBullets.map((item, lineIdx) => {
                        const isUnchecked = uncheckedBullets.has(lineIdx);
                        const bulletSymbols = ["•", "-", "*", "–", "—", "▪", "▸"];
                        const bulletMatch = bulletSymbols.find((s) => item.line.startsWith(s));
                        const content = bulletMatch ? item.line.substring(bulletMatch.length).trim() : item.line;

                        if (item.isHeader) {
                          return (
                            <div key={lineIdx} className="font-extrabold text-slate-900 dark:text-white text-xs pt-2 pb-1 flex items-center justify-between border-b border-emerald-200 dark:border-emerald-800/80 mt-1">
                              <span className="flex items-center gap-1.5 text-emerald-950 dark:text-emerald-200">
                                <Briefcase className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                {item.line}
                              </span>
                            </div>
                          );
                        }

                        if (item.isCompany) {
                          return (
                            <div key={lineIdx} className="font-semibold text-emerald-700 dark:text-emerald-400 text-[11px] italic mb-1.5 pl-5">
                              {item.line}
                            </div>
                          );
                        }

                        if (!item.isBullet) {
                          return (
                            <p key={lineIdx} className="text-[12px] text-slate-800 dark:text-slate-200 leading-relaxed select-all">
                              {item.line}
                            </p>
                          );
                        }

                        return (
                          <div
                            key={lineIdx}
                            className={`flex items-start gap-2.5 group rounded-lg px-2 py-1 transition-all duration-150 ${isUnchecked ? "opacity-40 bg-slate-100/60" : "hover:bg-emerald-100/40"}`}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleBulletToggle(lineIdx);
                              }}
                              className={`mt-0.5 shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150 cursor-pointer ${
                                isUnchecked
                                  ? "border-slate-300 bg-white"
                                  : "border-emerald-500 bg-emerald-500"
                              }`}
                              title={isUnchecked ? "Click to include in resume" : "Click to exclude from resume"}
                            >
                              {!isUnchecked && (
                                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                  <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                            <p className={`flex-1 text-[12px] leading-relaxed select-all ${isUnchecked ? "line-through text-slate-400" : "text-slate-800 dark:text-slate-200 font-medium"}`}>
                              {content}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <FormattedSectionText text={rewrittenText} />
                    )}
                  </div>

                  {uncheckedBullets.size > 0 && (
                    <p className="text-[10px] text-amber-600 font-semibold mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {uncheckedBullets.size} bullet{uncheckedBullets.size > 1 ? "s" : ""} will be excluded from the applied resume
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            {section.strengths.length > 0 && (
              <div className="space-y-2 bg-emerald-50/70 dark:bg-emerald-950/40 p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-xs font-black text-emerald-900 dark:text-emerald-300 uppercase tracking-wider block">
                  STRENGTHS
                </span>
                <ul className="space-y-1.5">
                  {section.strengths.map((str, i) => (
                    <li key={i} className="text-xs text-slate-800 dark:text-slate-200 font-semibold flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {section.recommendations.length > 0 && (
              <div className="space-y-2 bg-blue-50/70 dark:bg-blue-950/40 p-3.5 rounded-xl border border-blue-200 dark:border-blue-800/60">
                <span className="text-xs font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider block">
                  RECOMMENDATIONS
                </span>
                <ul className="space-y-1.5">
                  {section.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-slate-800 dark:text-slate-200 font-semibold flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Current Original Resume Text Preview */}
          {section.evidence_used && section.evidence_used.length > 0 && !rewrittenText && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider block">
                  📄 Current Original Resume Content
                </span>
                <span className="text-[10px] text-slate-500 font-medium italic">
                  (Text extracted from your uploaded resume)
                </span>
              </div>
              <div className="space-y-1.5 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 font-medium">
                {section.evidence_used.map((ev, i) => (
                  <p key={i} className="leading-relaxed border-b border-slate-200/60 dark:border-slate-800/60 last:border-b-0 pb-1.5 last:pb-0 select-all">
                    {ev}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* CTA Action */}
          {section.review_status === "improve" && !rewrittenText && (
            <button
              disabled={!!inlineLoadingSections[section.section_name]}
              onClick={(e) => {
                e.stopPropagation();
                if (triggerInlineRewrite) {
                  triggerInlineRewrite(section.section_name, section.recommendations);
                } else {
                  onImproveClick(section.section_name, section.recommendations);
                }
              }}
              className={`mt-2 w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2.5 shadow-md transition-all duration-200 select-none ${
                inlineLoadingSections[section.section_name]
                  ? "bg-slate-900 dark:bg-slate-950 text-white border border-slate-700 shadow-slate-900/30 cursor-wait"
                  : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20 cursor-pointer"
              }`}
            >
              {inlineLoadingSections[section.section_name] ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
                  <span className="text-white text-xs font-black tracking-wide">Generating AI Rewrite...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                  Improve with AI
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Legacy wrapper to keep call-sites working during migration (will be replaced below)
function renderSectionCard(
  section: ReviewedSection,
  idx: number,
  isExpanded: boolean,
  onToggle: () => void,
  rewrittenText: string | undefined,
  previousRewrittenText: string | undefined,
  onRevert: (name: string) => void,
  onUndoLastRewrite: (name: string) => void,
  onImproveClick: (name: string, recs: string[]) => void,
  inlineLoadingSections: Record<string, boolean> = {},
  triggerInlineRewrite?: (name: string, recs: string[]) => void,
  onBulletExclusionChange?: (sectionName: string, excludedIndexes: Set<number>) => void,
  isPatchingApplied?: boolean
) {
  return (
    <SectionCard
      key={`${section.section_name}-${idx}`}
      section={section}
      idx={idx}
      isExpanded={isExpanded}
      onToggle={onToggle}
      rewrittenText={rewrittenText}
      previousRewrittenText={previousRewrittenText}
      onRevert={onRevert}
      onUndoLastRewrite={onUndoLastRewrite}
      onImproveClick={onImproveClick}
      inlineLoadingSections={inlineLoadingSections}
      triggerInlineRewrite={triggerInlineRewrite}
      onBulletExclusionChange={onBulletExclusionChange}
      isPatchingApplied={isPatchingApplied}
    />
  );
}

function CategoryIcon({ category, className }: { category: string; className?: string }) {
  switch (category) {
    case "technology":
      return <Code className={className} />;
    case "skill":
      return <Cpu className={className} />;
    case "concept":
      return <BookOpen className={className} />;
    case "responsibility":
      return <ClipboardList className={className} />;
    default:
      return <Layers className={className} />;
  }
}

function LoadingState() {
  const steps = [
    "Reading parsed document structure...",
    "Extracting job description keywords & technologies...",
    "Comparing sections against job requirements...",
    "Analyzing context and evaluating candidate experience...",
    "Scoping resume evidence & checking truthfulness...",
    "Consolidating recommendations & deduplicating insights...",
    "Structuring final recruiter feedback..."
  ];

  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStep((prev) => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 2000);
    return () => clearInterval(interval);
  }, [steps.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 98) return 98;
        if (prev < 85) {
          return prev + 1;
        } else {
          // Slow crawl: only increment approx. once per second (15% chance per 180ms tick)
          return Math.random() < 0.15 ? prev + 1 : prev;
        }
      });
    }, 180);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="glass-panel rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800/80 min-h-[450px] flex flex-col items-center justify-center space-y-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        <Sparkles className="absolute inset-0 h-6 w-6 text-indigo-500 dark:text-indigo-400 m-auto animate-pulse" />
      </div>
      <div className="space-y-4 max-w-md mx-auto w-full">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white">Analyzing Resume</h3>
          <p className="text-xs text-indigo-500 dark:text-indigo-400 font-semibold tracking-wide h-6 animate-pulse">
            {steps[currentStep]}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full max-w-xs mx-auto space-y-1.5 pt-2">
          <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
            <span>Pipeline Status</span>
            <span className="text-indigo-500 dark:text-indigo-400 font-bold">{progress}%</span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-850">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto pt-1">
          Our AI model is reviewing each resume section concurrently and structuring final recruiter insights. This takes about 10-15 seconds.
        </p>
      </div>
    </div>
  );
}

function cleanKeywordName(rawName: string): string {
  if (!rawName) return "";
  return rawName
    .replace(/^(add|include|highlight|emphasize|condense|surface|rephrase|incorporate|integrate)\s+/i, "")
    .replace(/\s+in\s+.*$/i, "")
    .replace(/\s+for\s+.*$/i, "")
    .replace(/\s+(usage|skills|experience|experiences|knowledge|stack|level|concepts|proficiency)$/i, "")
    .trim();
}

function isActualATSKeyword(kw: string): boolean {
  if (!kw) return false;
  const clean = kw.trim();
  if (clean.length > 30 || clean.split(" ").length > 4) return false;

  const forbiddenWords = [
    "experience",
    "experiences",
    "project",
    "projects",
    "technique",
    "techniques",
    "knowledge",
    "understanding",
    "focus",
    "skills",
    "relevant",
    "professional",
    "optimization",
    "ability",
    "strong",
    "proven",
    "background",
    "usage",
  ];
  const lower = clean.toLowerCase();
  return !forbiddenWords.some((w) => lower.includes(w));
}

function extractStrictKeywordsFromRaw(raw: string): string[] {
  if (!raw) return [];
  const cleaned = cleanKeywordName(raw);
  // Split on "and", ",", "&"
  const parts = cleaned.split(/\s+(?:and|&)\s+|,\s*/i);
  return parts
    .map((p) => cleanKeywordName(p))
    .filter((p) => isActualATSKeyword(p));
}

function cleanSectionTitle(title: string): string {
  if (!title) return "";
  const parts = title.trim().split(/\s+/);
  const deduplicated: string[] = [];
  for (const p of parts) {
    if (deduplicated.length === 0 || deduplicated[deduplicated.length - 1].toLowerCase() !== p.toLowerCase()) {
      deduplicated.push(p);
    }
  }
  return deduplicated.join(" ");
}

function removeSkillFromText(text: string, skill: string): string {
  if (!text || !skill) return text;
  const target = skill.trim();
  if (!target) return text;

  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`,\\s*${escaped}\\b`, 'gi'),
    new RegExp(`\\b${escaped}\\s*,`, 'gi'),
    new RegExp(`\\b${escaped}\\b`, 'gi'),
    new RegExp(escaped, 'gi'),
  ];

  let current = text;
  for (const pat of patterns) {
    if (pat.test(current)) {
      current = current.replace(pat, '');
      break;
    }
  }

  return current
    .replace(/:\s*,/g, ': ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}


/**
 * Builds a smart resume filename matching the format:
 * [name] - [designation if exist] - [company if exist].docx
 */
function buildResumeFilename(
  jobDescription: string,
  userName: string | null | undefined,
  jobTitle: string | undefined,
  fallbackFileName?: string
): string {
  // 1. Candidate Name
  let candidateName = userName?.trim() || null;

  if (!candidateName && fallbackFileName) {
    const cleanName = fallbackFileName.replace(/\.(docx|pdf)$/i, "").replace(/[^a-zA-Z0-9& ]/g, " ").trim();
    if (cleanName.length > 2 && !/^(resume|my_resume|cv|document|base)$/i.test(cleanName)) {
      candidateName = cleanName;
    }
  }

  if (!candidateName) {
    candidateName = "Resume";
  }

  // 2. Designation (Target Role Title)
  let designation: string | null = jobTitle?.trim() || null;
  if (designation && /^(target role|full job description|job description|overview|target)$/i.test(designation)) {
    designation = null;
  }

  if (!designation && jobDescription) {
    const titleMatch = jobDescription.match(/(?:^|\n)\s*(?:Job Designation|Role|Job Title|Position)\s*[:\-]\s*([^\n,]+)/i);
    if (titleMatch && titleMatch[1]) {
      const parsedTitle = titleMatch[1].trim().replace(/[^a-zA-Z0-9& ]/g, "").trim();
      if (parsedTitle.length > 2 && !/^(target role|full job description|job description)$/i.test(parsedTitle)) {
        designation = parsedTitle;
      }
    }
  }

  // 3. Company Name
  const companyPatterns = [
    /(?:^|\n)\s*Company\s*[:\-]\s*([^\n,]+)/i,
    /(?:^|\n)\s*Organization\s*[:\-]\s*([^\n,]+)/i,
    /(?:^|[.\n])\s*About\s+([A-Z][A-Za-z0-9&\s]{1,40})(?:\s*[,\n]|\sis\b)/,
    /\bjoining\s+([A-Z][A-Za-z0-9&\s]{1,40})(?:\s*[,\n]|\sis\b)/i,
    /\bworking\s+(?:at|with|for)\s+([A-Z][A-Za-z0-9&\s]{1,40})(?:\s*[,\n]|\.)/i,
    /\bat\s+([A-Z][A-Za-z0-9&\s]{1,40})(?:\s*[,\n]|\.)/,
    /\bjoin\s+([A-Z][A-Za-z0-9&\s]{1,40})(?:\s*[,\n]|\.)/,
  ];

  let companyName: string | null = null;
  if (jobDescription) {
    for (const pattern of companyPatterns) {
      const match = jobDescription.match(pattern);
      if (match && match[1]) {
        const candidate = match[1].trim().replace(/[^a-zA-Z0-9& ]/g, "").trim();
        if (
          candidate.length > 2 &&
          !/^(full job description|job description|description|company|about|organization|role|target company)$/i.test(candidate)
        ) {
          companyName = candidate;
          break;
        }
      }
    }
  }

  // Combine: [name] - [designation if exist] - [company if exist]
  const parts = [candidateName, designation, companyName].filter(Boolean);
  const baseName = parts.join(" - ").replace(/[/\\?%*:|"<>]/g, "");
  return `${baseName}.docx`;
}

/**
 * Cleans section titles for modal headers, removing dates or subheaders.
 */
function cleanSectionModalTitle(title: string): string {
  if (!title) return "";
  const clean = title
    .replace(/(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\b201\d|\b202\d|\bpresent\b).*/i, "")
    .replace(/[,|\-–•].*$/, "")
    .trim();
  return clean || title;
}

export default function Home() {
  const { user, token, logout, setShowAuthModal, refreshMe } = useAuth();
  const [theme] = useState<"light">("light");
  const [activeNavTab, setActiveNavTab] = useState<"landing" | "workspace">("landing");
  const [file, setFile] = useState<File | null>(null);
  const [dailyGoal, setDailyGoal] = useState<{ progress_percentage: number } | null>(null);

  const fetchDailyGoal = async () => {
    if (!token) return;
    try {
      const data = await fetchAnalysisHistory();
      setDailyGoal(data.summary.daily_summary);
    } catch (err) {
      console.error("Failed to fetch daily goal:", err);
    }
  };

  useEffect(() => {
    if (token) {
      fetchDailyGoal();
    } else {
      setDailyGoal(null);
    }
  }, [token]);

  const switchNavTab = (tab: "landing" | "workspace") => {
    setActiveNavTab(tab);
    if (typeof window !== "undefined") {
      if (tab === "workspace") {
        window.history.pushState(null, "", "#workspace");
      } else {
        window.history.pushState(null, "", window.location.pathname === "/workspace" ? "/" : window.location.pathname);
      }
    }
  };

  useEffect(() => {
    const syncTab = () => {
      if (typeof window !== "undefined") {
        if (window.location.hash === "#workspace" || window.location.pathname.startsWith("/workspace")) {
          setActiveNavTab("workspace");
        }
      }
    };
    syncTab();
    window.addEventListener("hashchange", syncTab);
    window.addEventListener("popstate", syncTab);
    return () => {
      window.removeEventListener("hashchange", syncTab);
      window.removeEventListener("popstate", syncTab);
    };
  }, []);

  const [jobDescription, setJobDescription] = useState("");

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ResumeAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedImprovements, setExpandedImprovements] = useState<Record<string, boolean>>({});

  const [rewrittenSections, setRewrittenSections] = useState<Record<string, string>>({});
  const [previousRewrittenSections, setPreviousRewrittenSections] = useState<Record<string, string>>({});
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isRewriteModalOpen, setIsRewriteModalOpen] = useState(false);
  const [activeRewriteSection, setActiveRewriteSection] = useState<string | null>(null);
  const [rewriteData, setRewriteData] = useState<any | null>(null);
  const [draftRewrittenText, setDraftRewrittenText] = useState("");
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPatchingApplied, setIsPatchingApplied] = useState(false);
  const [userInstructions, setUserInstructions] = useState("");
  const [diffModeActive, setDiffModeActive] = useState(false);
  const [successNotification, setSuccessNotification] = useState<string | null>(null);
  const [showDetailedInsights, setShowDetailedInsights] = useState(false);
  const [isBottomBarVisible, setIsBottomBarVisible] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [inlineLoadingSections, setInlineLoadingSections] = useState<Record<string, boolean>>({});
  const [isImprovingAll, setIsImprovingAll] = useState(false);
  const [baseResumeLoaded, setBaseResumeLoaded] = useState(false);
  const [isSavingBase, setIsSavingBase] = useState(false);
  const [isAutoTailoring, setIsAutoTailoring] = useState(false);
  const [isWeavingKeywords, setIsWeavingKeywords] = useState(false);
  const [appliedWovenKeywords, setAppliedWovenKeywords] = useState<string[]>([]);
  const [isKeywordsWoven, setIsKeywordsWoven] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [customTargetRole, setCustomTargetRole] = useState<string>("");

  // ── Keyword Weave Modal state ──────────────────────────────────────────────
  const [isKeywordWeaveModalOpen, setIsKeywordWeaveModalOpen] = useState(false);
  const [keywordsForWeaveModal, setKeywordsForWeaveModal] = useState<{ kw: string; type: 'missing' | 'supported' }[]>([]);
  const [selectedKeywordsToWeave, setSelectedKeywordsToWeave] = useState<Set<string>>(new Set());

  // ── Manually removed skills (🟢 Confirmed Matched) ────────────────────────
  const [manuallyRemovedSkills, setManuallyRemovedSkills] = useState<Set<string>>(new Set());

  // ── Per-section excluded bullet indexes (for DOCX patch filtering) ─────────
  const [excludedBullets, setExcludedBullets] = useState<Record<string, Set<number>>>({});
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [metricPercentage, setMetricPercentage] = useState("");
  const [metricScale, setMetricScale] = useState("");

  // ── History & Goals State ───────────────────────────────────────────────
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const handleRestoreSession = (
    analysisResultData: any,
    jobDescriptionText: string,
    docId: string,
    filenameStr: string
  ) => {
    setAnalysisResult(analysisResultData);
    setJobDescription(jobDescriptionText);
    setDocumentId(docId);
    // Create synthetic file object for workspace header display
    const synthetic = new File([], filenameStr, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    setFile(synthetic);
    setActiveNavTab("workspace");
    setSuccessNotification(`Loaded past session for "${filenameStr}" into workspace!`);
  };

  // ── Cover Letter State ───────────────────────────────────────────────────
  const [coverLetterText, setCoverLetterText] = useState<string | null>(null);
  const [coverLetterDownloadId, setCoverLetterDownloadId] = useState<string | null>(null);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [isUpdatingCoverLetter, setIsUpdatingCoverLetter] = useState(false);
  const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);

  const handleGenerateCoverLetter = async () => {
    if (!documentId || !jobDescription) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (user && user.plan_type === "free" && user.credits <= 0) {
      setIsSubscriptionModalOpen(true);
      return;
    }

    const originalMatched = (analysisResult?.top_strengths || []).map((s: any) =>
      typeof s === "string" ? cleanKeywordName(s) : cleanKeywordName(s.name)
    );
    const confirmedMatchedSkills = Array.from(
      new Set([
        ...originalMatched,
        ...appliedWovenKeywords.map((k) => cleanKeywordName(k)),
      ])
    ).filter(Boolean).filter((skill) => !manuallyRemovedSkills.has(skill.toLowerCase()));

    const contactInfoParts = [
      user?.address,
      user?.phone_number,
      user?.email,
      user?.linkedin_url,
    ].filter(Boolean);
    const contactInfoStr = contactInfoParts.length > 0 ? contactInfoParts.join(" | ") : undefined;

    setIsGeneratingCoverLetter(true);
    try {
      const effectiveTargetRole = customTargetRole || rewrittenSections["header"] || analysisResult?.overall_summary?.job_title || undefined;
      const res = await generateCoverLetter({
        document_id: documentId,
        job_description_text: jobDescription,
        target_role: effectiveTargetRole,
        contact_info: contactInfoStr,
        rewritten_sections: rewrittenSections,
        confirmed_matched_skills: confirmedMatchedSkills,
      });

      setCoverLetterText(res.cover_letter_text);
      setCoverLetterDownloadId(res.download_id);
      if (res.target_role) {
        setCustomTargetRole(res.target_role);
      }
      setIsEditingCoverLetter(false);
      setSuccessNotification("✨ Tailored cover letter generated successfully!");
    } catch (err: any) {
      console.error("Cover letter generation error:", err);
      setError(err?.message || "Failed to generate cover letter.");
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  };

  const handleUpdateCoverLetterText = async (newText: string) => {
    setCoverLetterText(newText);
    if (!coverLetterDownloadId) return;

    setIsUpdatingCoverLetter(true);
    try {
      await updateCoverLetter(coverLetterDownloadId, newText);
      setSuccessNotification("Cover letter updated successfully!");
    } catch (err: any) {
      console.error("Cover letter update error:", err);
    } finally {
      setIsUpdatingCoverLetter(false);
    }
  };


  useEffect(() => {
    if (Object.keys(rewrittenSections).length > 0) {
      setIsBottomBarVisible(true);
    } else {
      setIsBottomBarVisible(false);
      setIsCartOpen(false);
    }
  }, [rewrittenSections]);

  // Auto-load user's saved base resume when they log in
  useEffect(() => {
    if (user && user.base_resume_id && user.base_resume_filename && !file && !baseResumeLoaded) {
      setDocumentId(user.base_resume_id);
      // Create a synthetic File-like display object for the UI
      const synthetic = new File([], user.base_resume_filename, { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      setFile(synthetic);
      setBaseResumeLoaded(true);
    }
  }, [user]);


  // Dynamic fit calculations based on resolved recruitment improvements
  const sectionsToImproveList = (analysisResult?.sections || []).filter(
    (s) => s.review_status === "improve"
  );
  const totalNeeded = sectionsToImproveList.length;

  // Track how many sections needing improvement have been accepted/rewritten
  const improvedCount = sectionsToImproveList.filter(
    (s) => !!rewrittenSections[s.section_name.toLowerCase()] ||
           Object.keys(rewrittenSections).some((rk) => s.section_name.toLowerCase().includes(rk) || rk.includes(s.section_name.toLowerCase()))
  ).length;


  // Track if keyword weaving has been applied
  const wovenBoost = (isKeywordsWoven || appliedWovenKeywords.length > 0) ? 1 : 0;

  const initialScore = analysisResult?.overall_summary?.overall_coverage_percentage || 0;

  // Honest, bounded score boosts:
  //   Each rewritten section adds +3% (max +15%)
  //   Keyword weaving adds +5%
  //   Hard cap at 95% — no resume perfectly matches every JD requirement
  const rewriteBoost = Math.min(15, Math.max(improvedCount, Object.keys(rewrittenSections).length) * 3);
  const keywordBoost = wovenBoost * 5;
  const currentScore = analysisResult
    ? Math.min(95, Math.round(initialScore + rewriteBoost + keywordBoost))
    : 0;

  const sectionsStillNeedingImprovement = Math.max(0, totalNeeded - improvedCount);


  useEffect(() => {
    if (successNotification) {
      const timer = setTimeout(() => {
        setSuccessNotification(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successNotification]);

  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  const toggleImprovement = (impName: string) => {
    setExpandedImprovements((prev) => ({
      ...prev,
      [impName]: !prev[impName]
    }));
  };

  // Rewrite Mutation
  const rewriteMutation = useMutation({
    mutationFn: (req: any) => {
      // Lazy load the API function or import it
      const { rewriteSection } = require("@/lib/api");
      return rewriteSection(req);
    },
    onSuccess: (data: any) => {
      setRewriteData(data);
      setDraftRewrittenText(data.rewritten_text);
      setSuccessNotification("AI section rewrite complete.");
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to generate rewrite. Please try again.");
      setIsRewriteModalOpen(false);
    }
  });

  const triggerInlineRewrite = async (sectionName: string, recommendations: string[]) => {
    console.log(
      "%c 🤖 [RoleCraft Audit] Trigger Inline Rewrite Clicked ",
      "background: #059669; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { sectionName, recommendations, documentId }
    );
    if (!documentId) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (user && user.plan_type === "free" && user.credits <= 0) {
      setIsSubscriptionModalOpen(true);
      return;
    }
    setInlineLoadingSections((prev) => ({ ...prev, [sectionName]: true }));
    try {
      const { rewriteSection } = require("@/lib/api");
      const startTime = performance.now();
      const data = await rewriteSection({
        document_id: documentId,
        section_name: sectionName,
        job_description_text: jobDescription,
        recommendations: recommendations
      });
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      const lines = data.rewritten_text.split("\n").filter((l: string) => l.trim());
      
      console.log(
        `%c ✨ [RoleCraft Audit] AI Response Received for "${sectionName}" (${duration}s) `,
        "background: #10b981; color: #000; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
        {
          sectionName,
          charLength: data.rewritten_text.length,
          lineCount: lines.length,
          rawText: data.rewritten_text,
          linesArray: lines,
        }
      );

      const lowerSec = sectionName.toLowerCase();
      if (rewrittenSections[lowerSec]) {
        console.log(
          `%c ⚠️ [RoleCraft Audit] Replacing Existing Rewrite for "${sectionName}" `,
          "background: #f59e0b; color: #000; font-weight: bold;",
          { oldText: rewrittenSections[lowerSec], newText: data.rewritten_text }
        );
        setPreviousRewrittenSections((prev) => ({
          ...prev,
          [lowerSec]: rewrittenSections[lowerSec]
        }));
      }
      setRewrittenSections((prev) => ({
        ...prev,
        [lowerSec]: data.rewritten_text
      }));
      setSuccessNotification(`AI rewrite complete for ${sectionName}.`);
      setIsPatchingApplied(false);
    } catch (err: any) {
      console.error(`❌ [RoleCraft Audit] Rewrite failed for "${sectionName}":`, err);
      setError(err?.message || `Failed to rewrite ${sectionName}. Please try again.`);
    } finally {
      setInlineLoadingSections((prev) => ({ ...prev, [sectionName]: false }));
    }
  };

  const handleImproveAllClick = async (sectionsToImprove: any[]) => {
    console.log(
      "%c ⚡ [RoleCraft Audit] 'Improve All with AI' Clicked ",
      "background: #7c3aed; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { count: sectionsToImprove.length, sections: sectionsToImprove.map((s) => s.section_name) }
    );
    if (!documentId || sectionsToImprove.length === 0) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (user && user.plan_type === "free" && user.credits <= 0) {
      setIsSubscriptionModalOpen(true);
      return;
    }
    setIsImprovingAll(true);
    try {
      await Promise.all(
        sectionsToImprove.map((s) => triggerInlineRewrite(s.section_name, s.recommendations))
      );
      setSuccessNotification("All recommended sections tailored successfully!");
    } catch (err: any) {
      console.error("❌ [RoleCraft Audit] Improve All failed:", err);
    } finally {
      setIsImprovingAll(false);
    }
  };

  const handleAutoTailor = async () => {
    console.log(
      "%c ⚡ [RoleCraft Audit] '1-Click Full Resume Auto-Tailor' Clicked ",
      "background: #0284c7; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { documentId }
    );
    if (!documentId) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (user && user.plan_type === "free" && user.credits <= 0) {
      setIsSubscriptionModalOpen(true);
      return;
    }
    if (jobDescription.trim().length < 50) return;

    setIsAutoTailoring(true);
    try {
      let result = analysisResult;
      if (!result) {
        console.log("🔍 [RoleCraft Audit] No existing analysis found – triggering analyzeResume first");
        result = await analyzeResume(documentId!, jobDescription);
        setAnalysisResult(result);
      }

      const sectionsToImprove = (result.sections || []).filter(
        (s) => s.review_status === "improve"
      );

      // Ensure Professional Summary section is included in 1-Click Auto-Tailor
      const summarySection = (result.sections || []).find(
        (s) => s.section_name.toLowerCase().includes("summary") || s.section_name.toLowerCase().includes("profile")
      );
      
      const sectionsToTailor = [...sectionsToImprove];
      if (summarySection && !sectionsToTailor.some(s => s.section_name.toLowerCase() === summarySection.section_name.toLowerCase())) {
        sectionsToTailor.unshift(summarySection);
      }

      console.log("📋 [RoleCraft Audit] Sections queued for 1-Click Auto-Tailor:", sectionsToTailor.map((s: any) => s.section_name));

      if (sectionsToTailor.length === 0 && !result.overall_summary?.job_title) {
        setSuccessNotification("Your resume is already highly optimized for this role!");
        setIsAutoTailoring(false);
        return;
      }

      const newRewrites: Record<string, string> = {};

      // 1. Apply Target Job Title to Header
      if (result.overall_summary?.job_title) {
        newRewrites["header"] = result.overall_summary.job_title;
      }

      // 2. Rewrite improve-status sections using their section gap recommendations
      await Promise.all(
        sectionsToTailor.map(async (sec: any) => {
          try {
            const res = await rewriteSection({
              document_id: documentId,
              section_name: sec.section_name,
              job_description_text: jobDescription,
              recommendations: sec.recommendations || [],
            });
            console.log(`✨ [RoleCraft Audit] Auto-Tailored section "${sec.section_name}":`, res.rewritten_text);
            newRewrites[sec.section_name.toLowerCase()] = res.rewritten_text;
          } catch (err) {
            console.error(`❌ [RoleCraft Audit] Failed auto rewrite for ${sec.section_name}:`, err);
          }
        })
      );

      if (Object.keys(newRewrites).length > 0) {
        setRewrittenSections(newRewrites);

        const acceptedItems = Object.entries(newRewrites).map(([secKey, text]) => {
          const origSec = (result.sections || []).find(
            (s: any) => s.section_name.toLowerCase() === secKey
          );
          return {
            section: origSec ? origSec.section_name : (secKey === "header" ? "header" : secKey),
            rewritten_text: text,
          };
        });

        console.log("💾 [RoleCraft Audit] Submitting DOCX Patch Payload:", acceptedItems);

        const applyRes = await applyMutation.mutateAsync({
          document_id: documentId,
          accepted_rewrites: acceptedItems,
        });

        console.log("🎉 [RoleCraft Audit] DOCX Patch Applied Successfully! Download ID:", applyRes.download_id);

        setDownloadId(applyRes.download_id);
        setDownloadUrl(applyRes.download_url);
        setIsPatchingApplied(true);

        // ── Auto-generate Tailored Cover Letter in 1-Click ──
        console.log("📝 [RoleCraft Audit] Auto-generating Tailored Cover Letter in 1-Click...");
        setIsGeneratingCoverLetter(true);
        try {
          const originalMatched = (result.top_strengths || []).map((s: any) =>
            typeof s === "string" ? cleanKeywordName(s) : cleanKeywordName(s.name)
          );
          const updatedConfirmedMatchedSkills = Array.from(
            new Set([
              ...originalMatched,
              ...appliedWovenKeywords.map((k) => cleanKeywordName(k)),
            ])
          ).filter(Boolean).filter((skill) => !manuallyRemovedSkills.has(skill.toLowerCase()));

          const contactInfoParts = [
            user?.address,
            user?.phone_number,
            user?.email,
            user?.linkedin_url,
          ].filter(Boolean);
          const contactInfoStr = contactInfoParts.length > 0 ? contactInfoParts.join(" | ") : undefined;

          const effectiveTargetRole = newRewrites["header"] || customTargetRole || result.overall_summary?.job_title || undefined;
          const clRes = await generateCoverLetter({
            document_id: documentId,
            job_description_text: jobDescription,
            target_role: effectiveTargetRole,
            contact_info: contactInfoStr,
            rewritten_sections: newRewrites,
            confirmed_matched_skills: updatedConfirmedMatchedSkills,
          });

          setCoverLetterText(clRes.cover_letter_text);
          setCoverLetterDownloadId(clRes.download_id);
          if (clRes.target_role) {
            setCustomTargetRole(clRes.target_role);
          }
          setIsEditingCoverLetter(false);
          console.log("✨ [RoleCraft Audit] Auto-generated 1-Click Cover Letter:", clRes.download_id);
        } catch (clErr) {
          console.error("❌ [RoleCraft Audit] Auto Cover Letter Generation Failed:", clErr);
        } finally {
          setIsGeneratingCoverLetter(false);
        }

        const parts: string[] = [];
        if (result.overall_summary?.job_title) parts.push("Target Role");
        if (sectionsToTailor.length > 0) parts.push(`${sectionsToTailor.length} section${sectionsToTailor.length > 1 ? "s" : ""}`);

        setSuccessNotification(`⚡ 1-Click Auto-Tailored: Full Resume & Cover Letter Generated! (${parts.join(", ")})`);
      }
    } catch (err: any) {
      console.error("❌ [RoleCraft Audit] Auto-tailor error:", err);
      setError(err?.message || "Auto-tailor failed. Please try again.");
    } finally {
      setIsAutoTailoring(false);
    }
  };

  // ── Open the keyword selection modal (⚡ Auto-Weave button) ────────────────
  const openKeywordWeaveModal = () => {
    if (!analysisResult) return;

    const wovenLower = new Set(appliedWovenKeywords.map((k) => k.toLowerCase().trim()));
    const supportedNames = new Set(
      (analysisResult.top_improvements || [])
        .filter((imp) => imp.evidence_reused && imp.evidence_reused.trim())
        .map((imp) => cleanKeywordName(imp.name).toLowerCase())
    );

    // Collect supported keywords
    const supportedKws: { kw: string; type: 'missing' | 'supported' }[] = (analysisResult.top_improvements || [])
      .filter((imp) => imp.evidence_reused && imp.evidence_reused.trim())
      .flatMap((imp) => extractStrictKeywordsFromRaw(imp.name).map((kw) => ({ kw, type: 'supported' as const })))
      .filter((item) => isActualATSKeyword(item.kw) && !wovenLower.has(item.kw.toLowerCase().trim()));

    // Collect missing keywords
    const missingFromSections = (analysisResult.sections || []).flatMap((s) => s.missing_keywords || []);
    const missingFromImps = (analysisResult.top_improvements || []).map((imp) => imp.name);
    const missingKws: { kw: string; type: 'missing' | 'supported' }[] = Array.from(
      new Set(
        [...missingFromSections, ...missingFromImps]
          .flatMap((k) => extractStrictKeywordsFromRaw(k))
          .map((k) => cleanKeywordName(k))
      )
    ).filter(
      (k) =>
        k &&
        isActualATSKeyword(k) &&
        !supportedNames.has(k.toLowerCase()) &&
        !wovenLower.has(k.toLowerCase().trim())
    ).map((kw) => ({ kw, type: 'missing' as const }));

    const allModalKeywords = [...supportedKws, ...missingKws];
    // Deduplicate by name
    const seen = new Set<string>();
    const deduped = allModalKeywords.filter(({ kw }) => {
      const lower = kw.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });

    setKeywordsForWeaveModal(deduped);
    setSelectedKeywordsToWeave(new Set(deduped.map((k) => k.kw)));
    setIsKeywordWeaveModalOpen(true);
  };

  const handleWeaveAllKeywords = async (keywordsToWeave?: string[]) => {
    console.log(
      "%c ⚡ [RoleCraft Audit] 'Auto-Weave All Keywords (1-Click)' Clicked ",
      "background: #d97706; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { documentId }
    );
    if (!analysisResult || !documentId) return;
    setIsKeywordWeaveModalOpen(false);
    setIsWeavingKeywords(true);
    try {
      // Target ONLY the Technical Skills section for keyword weaving
      const skillsSection = (analysisResult.sections || []).find(
        (s) => s.section_name.toLowerCase().includes("skill") || s.section_name.toLowerCase().includes("technical")
      );

      const targetSections = skillsSection ? [skillsSection] : (analysisResult.sections || []).slice(0, 1);

      // Use provided keyword list (from modal) or compute all missing
      let missingKeywords: string[];
      if (keywordsToWeave && keywordsToWeave.length > 0) {
        missingKeywords = keywordsToWeave;
      } else {
        const allRawKeywords = [
          ...(analysisResult.sections || []).flatMap((s) => s.missing_keywords || []),
          ...(analysisResult.top_improvements || []).map((imp) => imp.name),
        ];
        missingKeywords = Array.from(
          new Set(allRawKeywords.flatMap((k) => extractStrictKeywordsFromRaw(k)))
        );
      }

      console.log("🏷️ [RoleCraft Audit] Missing Keywords to Weave:", missingKeywords);

      const newRewrites: Record<string, string> = {};
      await Promise.all(
        targetSections.map(async (sec) => {
          try {
            const res = await rewriteSection({
              document_id: documentId,
              section_name: sec.section_name,
              job_description_text: jobDescription,
              recommendations: [
                ...(sec.recommendations || []),
                `Weave naturally these essential missing ATS keywords: ${missingKeywords.join(", ")}`,
              ],
            });
            console.log(`✨ [RoleCraft Audit] Keywords woven into "${sec.section_name}":`, res.rewritten_text);
            newRewrites[sec.section_name.toLowerCase()] = res.rewritten_text;
          } catch (err) {
            console.error(`❌ [RoleCraft Audit] Failed auto weave for ${sec.section_name}:`, err);
          }
        })
      );

      if (Object.keys(newRewrites).length > 0) {
        setRewrittenSections(newRewrites);

        const acceptedItems = Object.entries(newRewrites).map(([secKey, text]) => {
          const origSec = (analysisResult.sections || []).find(
            (s) => s.section_name.toLowerCase() === secKey
          );
          return {
            section: origSec?.section_name || secKey,
            rewritten_text: text,
          };
        });

        console.log("💾 [RoleCraft Audit] Submitting Keyword Weave DOCX Patch Payload:", acceptedItems);

        const applyRes = await applyMutation.mutateAsync({
          document_id: documentId,
          accepted_rewrites: acceptedItems,
        });

        setAppliedWovenKeywords((prev) => Array.from(new Set([...prev, ...missingKeywords])));
        setIsKeywordsWoven(true);
        setDownloadId(applyRes.download_id);
        setDownloadUrl(applyRes.download_url);
        setIsPatchingApplied(true);
        setSuccessNotification("⚡ Selected ATS Keywords Woven & Resume Updated!");
      }
    } catch (err: any) {
      console.error("❌ [RoleCraft Audit] Weave keywords error:", err);
    } finally {
      setIsWeavingKeywords(false);
    }
  };

  const handleImproveClick = (sectionName: string, recommendations: string[]) => {
    console.log(
      "%c ✏️ [RoleCraft Audit] 'Improve with AI' (Modal) Clicked ",
      "background: #4f46e5; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { sectionName, recommendations, documentId }
    );
    if (!documentId) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (user && user.plan_type === "free" && user.credits <= 0) {
      setIsSubscriptionModalOpen(true);
      return;
    }
    setActiveRewriteSection(sectionName);
    setRewriteData(null);
    setDraftRewrittenText("");
    setUserInstructions("");
    setMetricPercentage("");
    setMetricScale("");
    setDiffModeActive(false);
    setIsRewriteModalOpen(true);
    rewriteMutation.mutate({
      document_id: documentId,
      section_name: sectionName,
      job_description_text: jobDescription,
      recommendations: recommendations
    });
  };

  const handleRevert = (sectionName: string) => {
    console.log(
      "%c 🔄 [RoleCraft Audit] Revert Clicked ",
      "background: #ef4444; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { sectionName }
    );
    setRewrittenSections((prev) => {
      const copy = { ...prev };
      delete copy[sectionName.toLowerCase()];
      return copy;
    });
    setPreviousRewrittenSections((prev) => {
      const copy = { ...prev };
      delete copy[sectionName.toLowerCase()];
      return copy;
    });
    setIsPatchingApplied(false);
  };

  const handleUndoLastRewrite = (sectionName: string) => {
    console.log(
      "%c ↩️ [RoleCraft Audit] Undo Last Rewrite Clicked ",
      "background: #64748b; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { sectionName }
    );
    const lowerSec = sectionName.toLowerCase();
    const prevText = previousRewrittenSections[lowerSec];
    if (prevText === undefined) return;

    setRewrittenSections((prev) => ({
      ...prev,
      [lowerSec]: prevText
    }));

    setPreviousRewrittenSections((prev) => {
      const copy = { ...prev };
      delete copy[lowerSec];
      return copy;
    });
    setIsPatchingApplied(false);
  };

  // Apply Rewrites Mutation
  const applyMutation = useMutation({
    mutationFn: applyRewrites,
    onSuccess: (data) => {
      console.log(
        "%c 🎉 [RoleCraft Audit] Apply Rewrites Mutation Succeeded ",
        "background: #10b981; color: #000; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
        data
      );
      setDownloadId(data.download_id);
      setDownloadUrl(data.download_url);
      setIsPatchingApplied(true);
      setError(null);
      setSuccessNotification("Changes applied to resume.");
    },
    onError: (err: any) => {
      console.error("❌ [RoleCraft Audit] Apply Rewrites Mutation Failed:", err);
      setError(err?.message || "Failed to apply modifications. Please try again.");
    }
  });

  const handleApplyRewrites = () => {
    console.log(
      "%c 💾 [RoleCraft Audit] 'Apply to Resume' Clicked ",
      "background: #059669; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { rewrittenSectionsKeys: Object.keys(rewrittenSections), documentId }
    );
    if (!documentId) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (user && user.plan_type === "free" && user.credits <= 0) {
      setIsSubscriptionModalOpen(true);
      return;
    }
    const rewrites = Object.entries(rewrittenSections).map(([sectionName, rewrittenText]) => {
      const section = (analysisResult?.sections || []).find(
        (s) => s.section_name.toLowerCase() === sectionName.toLowerCase()
      );
      // Filter out excluded bullets before sending to DOCX patch
      const excluded = excludedBullets[section?.section_name || sectionName] || excludedBullets[sectionName];
      const filteredText = excluded && excluded.size > 0
        ? filterBulletsByChecked(rewrittenText, excluded)
        : rewrittenText;
      return {
        section: section ? section.section_name : sectionName,
        rewritten_text: filteredText
      };
    });

    if (rewrites.length === 0) return;

    console.log("💾 [RoleCraft Audit] Sending Patch Payload to API:", rewrites);

    applyMutation.mutate({
      document_id: documentId,
      accepted_rewrites: rewrites
    });
  };

  // ── Direct single-click Apply Target Job Title (patches DOCX immediately) ──────
  const [isApplyingTitle, setIsApplyingTitle] = useState(false);

  const handleApplyTargetTitle = async (titleToApply: string) => {
    if (!documentId) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (user && user.plan_type === "free" && user.credits <= 0) {
      setIsSubscriptionModalOpen(true);
      return;
    }

    setIsApplyingTitle(true);
    const updatedRewrites = {
      ...rewrittenSections,
      header: titleToApply,
    };
    setRewrittenSections(updatedRewrites);

    const acceptedItems = Object.entries(updatedRewrites).map(([secKey, text]) => {
      const origSec = (analysisResult?.sections || []).find(
        (s: any) => s.section_name.toLowerCase() === secKey.toLowerCase()
      );
      const excluded = excludedBullets[origSec?.section_name || secKey] || excludedBullets[secKey];
      const filteredText = excluded && excluded.size > 0
        ? filterBulletsByChecked(text, excluded)
        : text;
      return {
        section: origSec ? origSec.section_name : (secKey === "header" ? "header" : secKey),
        rewritten_text: filteredText,
      };
    });

    console.log("💾 [RoleCraft Audit] Submitting Direct Title Patch Payload:", acceptedItems);

    try {
      const res = await applyMutation.mutateAsync({
        document_id: documentId,
        accepted_rewrites: acceptedItems,
      });
      setSuccessNotification(`Target title "${titleToApply}" applied directly to resume!`);
      setIsPatchingApplied(true);
    } catch (err: any) {
      console.error("❌ [RoleCraft Audit] Direct title patch failed:", err);
    } finally {
      setIsApplyingTitle(false);
    }
  };

  // ── Quick single-click keyword weave (weaves into section & patches docx) ────────
  const [weavingSingleKeyword, setWeavingSingleKeyword] = useState<string | null>(null);

  const handleQuickWeaveKeyword = async (kw: string) => {
    if (!analysisResult || !documentId) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (user && user.plan_type === "free" && user.credits <= 0) {
      setIsSubscriptionModalOpen(true);
      return;
    }

    setWeavingSingleKeyword(kw);
    setAppliedWovenKeywords((prev) => Array.from(new Set([...prev, kw])));

    try {
      // Find Technical Skills section (or fallback to first section)
      const skillsSection = (analysisResult.sections || []).find(
        (s) => s.section_name.toLowerCase().includes("skill") || s.section_name.toLowerCase().includes("technical")
      );
      const targetSecName = skillsSection ? skillsSection.section_name : (analysisResult.sections || [])[0]?.section_name || "Skills";

      const res = await rewriteSection({
        document_id: documentId,
        section_name: targetSecName,
        job_description_text: jobDescription,
        recommendations: [
          ...(skillsSection?.recommendations || []),
          `Weave naturally this essential missing ATS keyword: ${kw}`,
        ],
      });

      const lowerSec = targetSecName.toLowerCase();
      const updatedRewrites = {
        ...rewrittenSections,
        [lowerSec]: res.rewritten_text,
      };
      setRewrittenSections(updatedRewrites);

      // Build patch payload including all current rewrites
      const acceptedItems = Object.entries(updatedRewrites).map(([secKey, text]) => {
        const origSec = (analysisResult.sections || []).find(
          (s) => s.section_name.toLowerCase() === secKey
        );
        const excluded = excludedBullets[origSec?.section_name || secKey] || excludedBullets[secKey];
        const filteredText = excluded && excluded.size > 0
          ? filterBulletsByChecked(text, excluded)
          : text;
        return {
          section: origSec?.section_name || secKey,
          rewritten_text: filteredText,
        };
      });

      console.log("💾 [RoleCraft Audit] Submitting Single Keyword Weave DOCX Patch Payload:", acceptedItems);

      const applyRes = await applyMutation.mutateAsync({
        document_id: documentId,
        accepted_rewrites: acceptedItems,
      });

      setDownloadId(applyRes.download_id);
      setDownloadUrl(applyRes.download_url);
      setIsPatchingApplied(true);
      setSuccessNotification(`⚡ "${kw}" woven into resume & DOCX updated!`);
    } catch (err: any) {
      console.error(`❌ Quick weave error for "${kw}":`, err);
      setError(err?.message || `Failed to weave "${kw}" into DOCX.`);
    } finally {
      setWeavingSingleKeyword(null);
    }
  };

  const removeSkillFromRewrites = (skillName: string) => {
    if (!skillName) return;
    const cleanName = cleanKeywordName(skillName);

    setRewrittenSections((prev) => {
      const nextRewrites: Record<string, string> = { ...prev };
      let updatedAny = false;

      // Find skills section
      const skillsSec = (analysisResult?.sections || []).find(
        (s: any) => s.section_name.toLowerCase().includes("skill") || s.section_name.toLowerCase().includes("technical")
      );
      const skillsKey = skillsSec ? skillsSec.section_name.toLowerCase() : "technical skills";

      // If skills section isn't in prev yet, populate from original section raw_text
      if (!nextRewrites[skillsKey] && skillsSec) {
        const origText = (skillsSec as any).raw_text || (skillsSec as any).linesArray?.join("\n") || "";
        if (origText) {
          nextRewrites[skillsKey] = origText;
        }
      }

      for (const [secKey, secText] of Object.entries(nextRewrites)) {
        if (!secText) continue;
        let cleanedText = removeSkillFromText(secText, skillName);
        if (cleanName && cleanName !== skillName) {
          cleanedText = removeSkillFromText(cleanedText, cleanName);
        }
        if (cleanedText !== secText) {
          updatedAny = true;
          nextRewrites[secKey] = cleanedText;
        }
      }

      if (updatedAny) {
        setIsPatchingApplied(false);
      }
      return nextRewrites;
    });
  };


  // 1. File Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: uploadResume,
    onSuccess: async (data) => {
      console.log(
        "%c 📄 [RoleCraft Audit] File Upload Succeeded ",
        "background: #0284c7; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
        data
      );
      setDocumentId(data.document_id);
      setError(null);
      setRewrittenSections({});
      setPreviousRewrittenSections({});
      setDownloadId(null);
      setDownloadUrl(null);
      setIsPatchingApplied(false);
      setSuccessNotification("Resume uploaded successfully.");

      // Auto-save as base resume immediately (if the user is logged in)
      if (token && file) {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/v1/documents/set-base`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ document_id: data.document_id, filename: file.name }),
          });
          if (resp.ok) {
            await refreshMe();
            console.log("[RoleCraft] New resume auto-saved as base resume.");
          }
        } catch (e) {
          // Non-blocking — upload still succeeded even if base-save fails
          console.warn("[RoleCraft] Auto base-save failed silently:", e);
        }
      }
    },
    onError: (err: any) => {
      console.error("❌ [RoleCraft Audit] File Upload Failed:", err);
      setError(err?.message || "File upload failed. Only .docx files up to 5MB are accepted.");
      setFile(null);
    }
  });

  // 2. Full Workflow Analysis Mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      console.log(
        "%c 🚀 [RoleCraft Audit] 'Analyze Gaps & Fit' Clicked ",
        "background: #7c3aed; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
        { documentId, jobDescriptionLength: jobDescription.length }
      );
      if (!documentId) throw new Error("Please upload a resume first");
      if (jobDescription.trim().length < 50) {
        throw new Error("Job description must be at least 50 characters long");
      }
      return analyzeResume(documentId, jobDescription);
    },
    onSuccess: (data) => {
      console.log(
        "%c 📊 [RoleCraft Audit] Resume Analysis Complete ",
        "background: #10b981; color: #000; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
        {
          overallScore: data.overall_summary?.overall_coverage_percentage,
          sectionsCount: data.sections?.length,
          sectionsToImprove: data.overall_summary?.sections_to_improve,
          topStrengths: data.top_strengths,
          topImprovements: data.top_improvements,
          sections: data.sections,
        }
      );
      setAnalysisResult(data);
      setError(null);
      setRewrittenSections({});
      setPreviousRewrittenSections({});
      setDownloadId(null);
      setDownloadUrl(null);
      setIsPatchingApplied(false);
      setCoverLetterText(null);
      setCoverLetterDownloadId(null);
      setIsEditingCoverLetter(false);
      setAppliedWovenKeywords([]);
      setIsKeywordsWoven(false);
      setCustomTargetRole(data.overall_summary?.job_title || "");

      // Refresh credits balance and daily goal in header
      refreshMe().catch(() => { });
      fetchDailyGoal().catch(() => { });

      // Initialize all sections with recommendations to improve as expanded by default
      const initialExpanded: Record<string, boolean> = {};
      (data.sections || []).forEach((sec: any) => {
        if (sec.review_status === "improve") {
          initialExpanded[sec.section_name] = true;
        }
      });
      setExpandedSections(initialExpanded);

      setSuccessNotification("Resume analysis complete!");
    },
    onError: (err: any) => {
      console.error("❌ [RoleCraft Audit] Resume Analysis Failed:", err);
      setError(err?.message || "Analysis failed. Please check your backend connection and OpenAI API Key.");
      if (
        err?.message?.toLowerCase().includes("limit") ||
        err?.message?.toLowerCase().includes("credits") ||
        err?.message?.toLowerCase().includes("log in") ||
        err?.message?.toLowerCase().includes("sign up")
      ) {
        setShowAuthModal(true);
      }
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".docx")) {
        setError("Only Word (.docx) files are supported.");
        return;
      }
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size exceeds 5MB limit.");
        return;
      }
      setFile(selectedFile);
      setDocumentId(null);
      setAnalysisResult(null);
      setError(null);
      setRewrittenSections({});
      setPreviousRewrittenSections({});
      setDownloadId(null);
      setDownloadUrl(null);
      setIsPatchingApplied(false);
      setCoverLetterText(null);
      setCoverLetterDownloadId(null);
      setIsEditingCoverLetter(false);
      setAppliedWovenKeywords([]);
      setIsKeywordsWoven(false);
      uploadMutation.mutate(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith(".docx")) {
        setError("Only Word (.docx) files are supported.");
        return;
      }
      if (droppedFile.size > 5 * 1024 * 1024) {
        setError("File size exceeds 5MB limit.");
        return;
      }
      setFile(droppedFile);
      setDocumentId(null);
      setAnalysisResult(null);
      setError(null);
      setRewrittenSections({});
      setPreviousRewrittenSections({});
      setDownloadId(null);
      setDownloadUrl(null);
      setIsPatchingApplied(false);
      uploadMutation.mutate(droppedFile);
    }
  };



  useEffect(() => {
    if (isPdfPreviewOpen && (downloadId || documentId)) {
      setIsPdfLoading(true);
      setPdfError(null);
      const targetId = downloadId || documentId;
      const pdfEndpoint = `${API_BASE_URL}/api/v1/resume/download/${targetId}/pdf`;

      fetch(pdfEndpoint, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          return res.blob();
        })
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setPdfBlobUrl(url);
          setIsPdfLoading(false);
        })
        .catch((err) => {
          console.error("PDF preview blob error:", err);
          setPdfError("Unable to render live preview. Please click 'Download PDF' to view.");
          setIsPdfLoading(false);
        });
    } else {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
        setPdfBlobUrl(null);
      }
    }
  }, [isPdfPreviewOpen, downloadId, documentId, token]);

  const handleResetWorkspace = (keepResume: boolean = true) => {
    setAnalysisResult(null);
    setError(null);
    setJobDescription("");
    setRewrittenSections({});
    setPreviousRewrittenSections({});
    setDownloadId(null);
    setDownloadUrl(null);
    setIsPatchingApplied(false);
    setCoverLetterText(null);
    setCoverLetterDownloadId(null);
    setIsEditingCoverLetter(false);
    setAppliedWovenKeywords([]);
    setIsKeywordsWoven(false);
    setCustomTargetRole("");

    if (!keepResume) {
      setFile(null);
      setDocumentId(null);
      setBaseResumeLoaded(false);
    }
    setSuccessNotification("✨ Workspace reset! Ready for a new job description.");
  };

  const clearFile = () => {
    handleResetWorkspace(false);
  };

  const handleSaveBaseResume = async () => {
    if (!documentId || !file || !token) return;
    // Don't re-save if it's already the base resume
    if (documentId === user?.base_resume_id) {
      setSuccessNotification("This is already your saved base resume.");
      return;
    }
    setIsSavingBase(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/documents/set-base`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ document_id: documentId, filename: file.name }),
      });
      if (!response.ok) throw new Error("Failed to save base resume.");
      await refreshMe();
      setSuccessNotification("Base resume saved! It will auto-load next time you sign in.");
    } catch (err: any) {
      setError(err?.message || "Could not save base resume.");
    } finally {
      setIsSavingBase(false);
    }
  };

  const handleAnalyze = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentId) {
      setError("Please wait for the file to finish uploading.");
      return;
    }
    analyzeMutation.mutate();
  };

  const isAnalyzing = analyzeMutation.isPending;
  const isUploading = uploadMutation.isPending;

  return (
    <div className="relative min-h-screen bg-slate-50 text-slate-900 bg-grid p-6 lg:p-12 overflow-x-hidden transition-colors duration-300">
      {/* Decorative Glow Elements */}
      <div className="glow-effect bg-emerald-500/20 w-[550px] h-[550px] -top-40 -left-40" />
      <div className="glow-effect bg-amber-500/20 w-[450px] h-[450px] top-[35%] -right-20" />

      {/* Header */}
      <header className="relative z-30 max-w-[1440px] mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 mb-8 sm:mb-12 pb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => switchNavTab("landing")}>
          <img
            src="/logo.png"
            alt="Role Craft Logo"
            className="h-10 w-10 sm:h-12 sm:w-12 object-contain rounded-xl bg-white p-1 border border-slate-200/80 shadow-md transition-all shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <span>Role Craft</span>
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 font-bold shrink-0">
                Engine v1.0
              </span>
            </h1>
            <p className="text-xs text-slate-600 font-semibold truncate">
              Craft every resume for the role.
            </p>
          </div>
        </div>

        {/* Navigation Bar Links (Shown on landing page) */}
        {activeNavTab === "landing" && (
          <nav className="hidden lg:flex items-center gap-1 sm:gap-2 text-xs font-bold text-slate-700">
            <a
              href="#features"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer text-slate-700 whitespace-nowrap"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer text-slate-700 whitespace-nowrap"
            >
              Pricing
            </a>
            <a
              href="#faq"
              className="px-3 py-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer text-slate-700 whitespace-nowrap"
            >
              FAQ
            </a>
          </nav>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 self-end md:self-auto">
          {/* Profile & Base Docs Button */}
          {(!user || calculateProfileCompletion(user).totalPercentage < 100) && (
            <button
              type="button"
              onClick={() => {
                if (!token) {
                  setShowAuthModal(true);
                } else {
                  setIsProfileModalOpen(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm transition-all cursor-pointer"
              title="Manage Profile Contact Info & Base Master Templates"
            >
              <User className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Profile & Base Docs</span>
              {user && (
                <span className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-extrabold text-[10px] border border-indigo-500/20">
                  {calculateProfileCompletion(user).totalPercentage}%
                </span>
              )}
            </button>
          )}
          {/* History & Goals Button */}
          {(!user || !dailyGoal || dailyGoal.progress_percentage < 100) && (
            <button
              type="button"
              onClick={() => {
                if (!token) {
                  setShowAuthModal(true);
                } else {
                  setIsHistoryModalOpen(true);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-800 shadow-sm transition-all cursor-pointer"
              title="View Application History & Daily Goals"
            >
              <History className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden sm:inline">History & Goals</span>
              {user && dailyGoal && (
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] border border-emerald-500/20 animate-pulse">
                  {dailyGoal.progress_percentage}%
                </span>
              )}
            </button>
          )}

          {/* Reset Workspace Button */}
          {activeNavTab === "workspace" && (
            <button
              type="button"
              onClick={() => handleResetWorkspace(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-sm transition-all cursor-pointer"
              title="Clear analysis results and start a new job description analysis"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Reset Workspace</span>
            </button>
          )}

          {/* Launch / Switch Workspace Button */}
          <button
            type="button"
            onClick={() => switchNavTab(activeNavTab === "workspace" ? "landing" : "workspace")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm ${
              activeNavTab === "workspace"
                ? "bg-slate-900 text-white ring-2 ring-emerald-500"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>{activeNavTab === "workspace" ? "← Exit Workspace" : "⚡ Launch Workspace"}</span>
          </button>

          {user ? (
            <div className="relative z-40">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 bg-white hover:bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm text-xs transition-all cursor-pointer select-none"
              >
                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-sm">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <span className="font-bold text-slate-800 max-w-[70px] sm:max-w-[120px] truncate">
                  {user.name || user.email.split("@")[0]}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 font-extrabold text-[10px] border border-emerald-500/20">
                  {user.credits} CR
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isProfileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Profile Dropdown Card */}
              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 z-50 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 space-y-4 animate-fade-in-up">
                    {/* User Header */}
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-200">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black flex items-center justify-center text-sm shadow-md shadow-indigo-600/30 shrink-0">
                        {(user.name || user.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {user.name || "User Account"}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {/* Account Status Details */}
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 font-medium">Plan</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 font-black uppercase text-[10px] tracking-wider">
                            {user.plan_type}
                          </span>
                          {user.plan_type === "free" && (
                            <button
                              onClick={() => {
                                setIsProfileMenuOpen(false);
                                setIsSubscriptionModalOpen(true);
                              }}
                              className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] transition-all cursor-pointer shadow-sm"
                            >
                              Upgrade
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-slate-500 font-medium">Credits Available</span>
                        <span className="font-extrabold text-emerald-600">
                          {user.credits} Credits
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/40">
                        <span className="text-slate-600 dark:text-slate-300 font-bold">Profile Completion</span>
                        <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                          {calculateProfileCompletion(user).totalPercentage}%
                        </span>
                      </div>

                      {user.base_resume_filename && (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-slate-500 font-medium">Base Resume</span>
                          <span className="font-semibold text-slate-700 truncate max-w-[110px]" title={user.base_resume_filename}>
                            {user.base_resume_filename}
                          </span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                    >
                      <User className="h-3.5 w-3.5" />
                      Profile & Base Docs
                    </button>

                    {/* Sign Out Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {activeNavTab === "landing" ? (
        <div className="relative max-w-[1440px] mx-auto space-y-24 py-4 animate-fade-in">
          {/* HERO BANNER SECTION */}
          <section className="text-center space-y-8 max-w-4xl mx-auto pt-6 pb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 font-extrabold text-xs shadow-sm">
              <Sparkles className="h-4 w-4 text-emerald-600 animate-pulse" />
              <span>Recruiter-Grade AI Resume Optimization Engine</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.15]">
              Tailor Your Resume to Any Role in <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-indigo-600">1-Click</span>
            </h1>

            <p className="text-base sm:text-xl text-slate-600 font-medium max-w-2xl mx-auto leading-relaxed">
              Beat ATS scanners, weave missing technical keywords naturally, and triple your interview callbacks while preserving 100% of your DOCX font & layout formatting.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button
                onClick={() => switchNavTab("workspace")}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-xl shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-105"
              >
                <Sparkles className="h-5 w-5 text-amber-300" />
                <span>⚡ Launch Optimizer Workspace — 15 Free Credits</span>
              </button>
              <a
                href="#how-it-works"
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white hover:bg-slate-100 text-slate-800 font-bold text-base border border-slate-200 shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>See How It Works</span>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            {/* Live Trust Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-10 border-t border-slate-200/80">
              <div className="space-y-1">
                <div className="text-2xl font-black text-slate-900">98.4%</div>
                <div className="text-xs font-semibold text-slate-500">ATS Pass Rate</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-slate-900">3.8x</div>
                <div className="text-xs font-semibold text-slate-500">More Interview Calls</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-slate-900">&lt; 15s</div>
                <div className="text-xs font-semibold text-slate-500">Full 1-Click Tailor</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-black text-slate-900">100%</div>
                <div className="text-xs font-semibold text-slate-500">DOCX Layout Integrity</div>
              </div>
            </div>
          </section>

          {/* HOW IT WORKS SECTION */}
          <section id="how-it-works" className="space-y-8 scroll-mt-24">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                How RoleCraft Works in 3 Simple Steps
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                No manual retyping. No broken Word formatting. Instant tailored results.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md space-y-4 relative overflow-hidden">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 font-black text-lg flex items-center justify-center">
                  1
                </div>
                <h3 className="text-lg font-bold text-slate-900">Upload Base Resume</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Upload your existing `.docx` base resume. RoleCraft parses low-level XML tags to map structure, fonts, and styles.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md space-y-4 relative overflow-hidden">
                <div className="h-10 w-10 rounded-xl bg-indigo-100 text-indigo-700 font-black text-lg flex items-center justify-center">
                  2
                </div>
                <h3 className="text-lg font-bold text-slate-900">Paste Job Description</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Paste the Target Job Description. Our LLM pipeline detects key skills, missing keywords, and role priorities.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md space-y-4 relative overflow-hidden">
                <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 font-black text-lg flex items-center justify-center">
                  3
                </div>
                <h3 className="text-lg font-bold text-slate-900">1-Click Auto-Tailor & Download</h3>
                <p className="text-xs text-slate-600 font-medium leading-relaxed">
                  Click '⚡ Auto-Tailor Full Resume' to rewrite summary, weave keywords, and download your patched `.docx` resume.
                </p>
              </div>
            </div>
          </section>

          {/* KEY CAPABILITIES */}
          <section id="features" className="space-y-8 scroll-mt-24">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Engineered for Recruiter Callbacks
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                Built with low-level OpenXML preservation and recruiter-grade evaluation algorithms.
              </p>
            </div>
            <FeaturesShowcase />
          </section>

          {/* RECRUITER STATS & TESTIMONIALS */}
          <section className="space-y-8">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Trusted by Top Tech Candidates
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                See real metrics and stories from candidates who landed offers.
              </p>
            </div>
            <TestimonialsSection />
          </section>

          {/* PRICING */}
          <section id="pricing" className="space-y-8 scroll-mt-24">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Transparent Monthly Plans
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                Choose the tier that fits your job search pace. Upgrade or cancel anytime.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Free Plan Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase text-slate-500 tracking-wider">Free Tier</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900">₹0</span>
                    <span className="text-xs text-slate-500 font-bold">/ forever</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-slate-700 font-medium pt-4 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>15 Credits</strong> / Month</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Standard AI Resume Analysis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Basic Keyword Matching</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => setActiveNavTab("workspace")}
                  className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-all cursor-pointer"
                >
                  Start Free
                </button>
              </div>

              {/* Pro Plan Card */}
              <div className="rounded-2xl border-2 border-emerald-600 bg-white p-6 shadow-xl flex flex-col justify-between space-y-6 relative">
                <div className="absolute -top-3.5 right-6 px-3 py-1 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wider shadow">
                  Most Popular
                </div>
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase text-emerald-700 tracking-wider">Pro Plan</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900">₹399</span>
                    <span className="text-xs text-slate-400 line-through">₹2,000</span>
                    <span className="text-xs text-slate-500 font-bold">/ month</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-slate-700 font-medium pt-4 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>200 Credits</strong> / Month</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>1-Click Full Resume Auto-Tailor</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Google XYZ Formula Bullet Rewriter</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>100% DOCX & PDF Downloads</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => setIsSubscriptionModalOpen(true)}
                  className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  Upgrade to Pro Plan
                </button>
              </div>

              {/* Elite Plan Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase text-indigo-600 tracking-wider">Elite Plan</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900">₹599</span>
                    <span className="text-xs text-slate-400 line-through">₹3,000</span>
                    <span className="text-xs text-slate-500 font-bold">/ month</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-slate-700 font-medium pt-4 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span><strong>400 Credits</strong> / Month</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Everything in Pro Plan</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>Priority Support & Maximum Capacity</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => setIsSubscriptionModalOpen(true)}
                  className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/10 transition-all cursor-pointer"
                >
                  Upgrade to Elite Plan
                </button>
              </div>
            </div>
          </section>

          {/* FAQ */}
          <section id="faq" className="space-y-8 scroll-mt-24">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Frequently Asked Questions
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                Everything you need to know about RoleCraft formatting, privacy, and tailoring.
              </p>
            </div>
            <FaqSection />
          </section>

          {/* FOOTER */}
          <footer className="pt-12 pb-8 border-t border-slate-200 text-center space-y-6">
            <div className="flex items-center justify-center gap-3">
              <img src="/logo.png" alt="RoleCraft Logo" className="h-8 w-8 object-contain rounded-lg bg-white p-1 border border-slate-200 shadow-sm" />
              <span className="text-lg font-black text-slate-900">RoleCraft</span>
            </div>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              Craft every resume for the role. Recruiter-grade AI tailoring with 100% visual DOCX formatting preservation.
            </p>
            <div className="flex items-center justify-center gap-6 text-xs font-semibold text-slate-600 flex-wrap">
              <a href="#how-it-works" onClick={() => setActiveNavTab("landing")} className="hover:text-emerald-600">How It Works</a>
              <a href="#features" onClick={() => setActiveNavTab("landing")} className="hover:text-emerald-600">Features</a>
              <a href="#pricing" onClick={() => setActiveNavTab("landing")} className="hover:text-emerald-600">Pricing</a>
              <button onClick={() => setActiveNavTab("workspace")} className="hover:text-emerald-600">Workspace</button>
            </div>
            <p className="text-[11px] text-slate-400 font-medium pt-4">
              © 2026 RoleCraft Inc. All rights reserved. Built for job seekers worldwide.
            </p>
          </footer>
        </div>
      ) : (
        /* Main Workspace Container */
        <main className="relative max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Form Panel */}
        <div className="lg:col-span-4 space-y-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <form onSubmit={handleAnalyze} className="glass-panel rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
              Configure Analysis
            </h2>

            {/* Resume Upload Box */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Upload Resume (DOCX only)
              </label>

              {!file ? (
                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="relative group cursor-pointer border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 rounded-xl p-8 text-center bg-slate-100/30 dark:bg-slate-900/30 hover:bg-slate-200/40 dark:hover:bg-slate-900/50 transition-all duration-300"
                >
                  <input
                    type="file"
                    accept=".docx"
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <UploadCloud className="h-10 w-10 text-slate-400 dark:text-slate-500 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 mx-auto mb-3 transition-colors" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    Drag & drop or click to upload
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Word documents (.docx) up to 5MB
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shrink-0">
                        <FileText className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={file.name}>
                          {file.name}
                        </p>
                        {file.size > 0 ? (
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                        ) : (
                          <p className="text-[11px] text-indigo-500 dark:text-indigo-400 font-medium">
                            Base Resume
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isUploading ? (
                        <span className="text-xs text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5 font-medium">
                          <span className="h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-500 animate-ping" />
                          Uploading...
                        </span>
                      ) : documentId ? (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Ready
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={clearFile}
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors cursor-pointer"
                        title="Remove and upload a different resume"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {/* Use different resume option */}
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input
                      type="file"
                      accept=".docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <span className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline group-hover:text-indigo-600 transition-colors">
                      ↑ Upload a different resume for this session
                    </span>
                  </label>
                </div>
              )}
            </div>

            {/* Job Description Input Container */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Job Description
                </label>
                {(jobDescription || analysisResult) && (
                  <button
                    type="button"
                    onClick={() => handleResetWorkspace(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" /> Clear & New Analysis
                  </button>
                )}
              </div>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description or requirement spec here (minimum 50 characters)..."
                rows={8}
                maxLength={8000}
                className="w-full bg-white text-slate-900 border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm placeholder-slate-400 transition-all outline-none resize-y shadow-inner"
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Min: 50 chars</span>
                <span className={jobDescription.length < 50 ? "text-amber-600 font-medium" : "text-emerald-600 font-bold"}>
                  {jobDescription.length.toLocaleString()} / 8,000 characters
                </span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300 text-xs">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <span className="flex-1 leading-relaxed">{error}</span>
                </div>
                {analyzeMutation.isError && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      analyzeMutation.mutate();
                    }}
                    className="self-end mt-1 px-3 py-1 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry Analysis
                  </button>
                )}
                {uploadMutation.isError && file && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      uploadMutation.mutate(file);
                    }}
                    className="self-end mt-1 px-3 py-1 bg-red-100 dark:bg-red-500/20 hover:bg-red-200 dark:hover:bg-red-500/30 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-500/30 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                  >
            <RefreshCw className="h-3 w-3" />
                    Retry Upload
                  </button>
                )}
              </div>
            )}
            {/* Action Buttons */}
            <div className="flex flex-col gap-3">
              <button
                type="submit"
                disabled={!documentId || jobDescription.trim().length < 50 || isAnalyzing}
                className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 glow-btn ${
                  documentId && jobDescription.trim().length >= 50 && !isAnalyzing
                    ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 cursor-pointer"
                    : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                }`}
              >
                {isAnalyzing ? (
                  <>
                    <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Running AI Analysis...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Analyze Gaps & Fit
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Right Results Panel */}
        <div className="lg:col-span-8 space-y-6 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          {isAnalyzing ? (
            <LoadingState />
          ) : !analysisResult ? (
            <div className="glass-panel rounded-2xl p-12 text-center border border-slate-200 dark:border-slate-800 min-h-[450px] flex flex-col items-center justify-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm animate-pulse">
                <Activity className="h-8 w-8 text-slate-400 dark:text-slate-500" />
              </div>
              <div className="space-y-2 max-w-sm">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Awaiting Analysis</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Upload your resume and provide a target job description on the left to start detecting gaps and strengths.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* ⚡ 1-Click Auto-Tailor Hero Banner */}
              <div className="relative overflow-hidden rounded-2xl p-5.5 border border-indigo-500/30 dark:border-indigo-500/30 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-950 text-white shadow-2xl backdrop-blur-xl animate-fade-in border-t-white/10">
                <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -left-12 -top-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-400 via-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/25 shrink-0 ring-1 ring-white/20">
                      <Sparkles className="h-6 w-6 animate-pulse text-amber-200" />
                    </div>
                    <div>
                      <h4 className="text-base font-extrabold text-white flex items-center gap-2 tracking-tight">
                        ⚡ 1-Click Full Resume Auto-Tailor
                      </h4>
                      <p className="text-xs text-slate-300 mt-0.5 max-w-md leading-relaxed">
                        Automatically rewrite weak sections, weave missing ATS keywords, & add Google XYZ impact metrics in one click.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAutoTailor}
                    disabled={isAutoTailoring}
                    className="px-6 py-3.5 rounded-xl font-extrabold text-xs bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white shadow-xl shadow-emerald-500/20 hover:shadow-emerald-500/35 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0 border border-white/20"
                  >
                    {isAutoTailoring ? (
                      <>
                        <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        ⚡ Auto-Tailoring Resume...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 text-amber-200" />
                        ⚡ Auto-Tailor Full Resume (1-Click)
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Summary Dashboard Card */}
              <div className="glass-panel rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-r from-white/90 via-indigo-500/5 to-white/90 dark:from-slate-900/90 dark:via-indigo-950/20 dark:to-slate-900/90 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30 uppercase tracking-wider">
                        Target Role Detected
                      </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {(() => {
                        const rawJobTitle = analysisResult.overall_summary.job_title || "";
                        const isGenericTitle = !rawJobTitle || ["full job description", "job description", "about the role", "overview", "target role", "description"].includes(rawJobTitle.toLowerCase().trim());
                        const displayTitle = rewrittenSections["header"] || (!isGenericTitle ? rawJobTitle : "Target Role");
                        const canApply = !isGenericTitle;

                        return (
                          <>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                              {displayTitle}
                            </h3>
                            {canApply && (
                              <button
                                type="button"
                                onClick={() => handleApplyTargetTitle(rawJobTitle)}
                                disabled={isApplyingTitle || applyMutation.isPending}
                                className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none shadow-md ${
                                  rewrittenSections["header"] === rawJobTitle && isPatchingApplied
                                    ? "bg-slate-900 hover:bg-slate-800 text-white border-slate-900 shadow-slate-900/10"
                                    : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white border-emerald-500/30 shadow-emerald-500/20 hover:scale-105"
                                }`}
                                title="Apply this target job title directly to your resume header and DOCX file"
                              >
                                {isApplyingTitle ? (
                                  <>
                                    <div className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                                    <span>Applying Title...</span>
                                  </>
                                ) : rewrittenSections["header"] === rawJobTitle && isPatchingApplied ? (
                                  <>
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                    <span>Title Applied & Saved</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3.5 w-3.5 text-white shrink-0" />
                                    <span>Apply Job Title</span>
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Overall Score Circle */}
                  <div className="flex items-center gap-4 bg-white/90 dark:bg-slate-950/70 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-md">
                    <div className="relative flex items-center justify-center">
                      {/* SVG Gauge */}
                      <svg className="w-20 h-20 transform -rotate-90">
                        <circle
                          cx="40"
                          cy="40"
                          r="34"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          className="text-slate-200 dark:text-slate-800"
                        />
                        <circle
                          cx="40"
                          cy="40"
                          r="34"
                          stroke="currentColor"
                          strokeWidth="6"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 34}
                          strokeDashoffset={2 * Math.PI * 34 * (1 - currentScore / 100)}
                          className="text-indigo-500 transition-all duration-1000"
                        />
                      </svg>
                      <span className="absolute text-base font-black text-slate-900 dark:text-white">
                        {currentScore}%
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Overall Fit</p>
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 mt-0.5">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{sectionsStillNeedingImprovement} of {totalNeeded}</span> sections need improvement
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive ATS Skill & Keyword Matrix Card */}
              <div className="glass-panel rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 space-y-4 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200/80 dark:border-slate-800/80 pb-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500/15 via-purple-500/15 to-indigo-600/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0 shadow-sm">
                      <Layers className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                        ATS Skill & Keyword Matrix
                      </h3>
                      <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Match overview & 1-click keyword insertion.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={openKeywordWeaveModal}
                    disabled={isWeavingKeywords}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all duration-200 flex items-center gap-1.5 cursor-pointer shadow-md border ${
                      isKeywordsWoven
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400/30 shadow-emerald-600/25"
                        : "bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white border-white/20 shadow-indigo-500/20 hover:scale-[1.02] active:scale-[0.98]"
                    }`}
                  >
                    {isWeavingKeywords ? (
                      <>
                        <div className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Weaving Keywords...
                      </>
                    ) : isKeywordsWoven ? (
                      <>
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-200" />
                        ✓ Keywords Woven & Applied
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-amber-200 animate-pulse" />
                        ⚡ Auto-Weave All Keywords (1-Click)
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 🟢 Matched Skills — click to un-weave (woven) or remove (original) */}
                  {(() => {
                    const originalMatched = new Set(
                      (analysisResult.top_strengths || []).map((s: any) =>
                        (typeof s === "string" ? cleanKeywordName(s) : cleanKeywordName(s.name)).toLowerCase()
                      )
                    );
                    const wovenMatchedLower = new Set(
                      appliedWovenKeywords.map((k) => cleanKeywordName(k).toLowerCase())
                    );
                    const allMatched = Array.from(
                      new Set([
                        ...(analysisResult.top_strengths || []).map((s: any) =>
                          typeof s === "string" ? cleanKeywordName(s) : cleanKeywordName(s.name)
                        ),
                        ...appliedWovenKeywords.map((k) => cleanKeywordName(k)),
                      ])
                    ).filter(Boolean).filter((skill) => !manuallyRemovedSkills.has(skill.toLowerCase()));

                    return (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                          <span className="text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                            Confirmed Matched Skills ({allMatched.length})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {allMatched.map((skillName, idx) => {
                            const skillLower = skillName.toLowerCase();
                            const isWoven = wovenMatchedLower.has(skillLower);
                            const isOriginal = originalMatched.has(skillLower);

                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (isWoven) {
                                    setAppliedWovenKeywords((prev) => {
                                      const next = prev.filter((k) => cleanKeywordName(k).toLowerCase() !== skillLower);
                                      if (next.length === 0) setIsKeywordsWoven(false);
                                      return next;
                                    });
                                  } else {
                                    setManuallyRemovedSkills((prev) => {
                                      const next = new Set(prev);
                                      next.add(skillLower);
                                      return next;
                                    });
                                  }
                                  removeSkillFromRewrites(skillName);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-rose-500/10 text-emerald-700 hover:text-rose-600 dark:text-emerald-300 dark:hover:text-rose-400 border border-emerald-500/25 hover:border-rose-400/30 transition-all duration-150 cursor-pointer group shadow-xs"
                                title={isWoven ? `Click to move '${skillName}' back to ${isOriginal ? "supported" : "missing"} keywords` : `Click to remove '${skillName}' from matched skills`}
                              >
                                <CheckCircle className="h-3 w-3 shrink-0 text-emerald-500 group-hover:hidden" />
                                <X className="h-3 w-3 shrink-0 text-rose-500 hidden group-hover:block" />
                                {skillName}
                                {isWoven && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-200 font-extrabold uppercase">
                                    Woven
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 🟡 Supported in Evidence — per-section matched strengths (click to weave into skills) */}
                  {(() => {
                    // Use s.strengths (short keyword/skill strings from AI per-section analysis)
                    // NOT s.evidence_used (which contains full paragraph text for the diff UI)
                    const evidenceKeywords = (analysisResult.sections || [])
                      .flatMap((s: any) => s.strengths || [])
                      .map((e: string) => cleanKeywordName(e))
                      .filter((kw: string) => kw.length > 0 && kw.length <= 60); // max 60 chars = real keyword, not a sentence

                    const matchedLower = new Set(
                      (analysisResult.top_strengths || []).map((s: any) =>
                        (typeof s === "string" ? cleanKeywordName(s) : cleanKeywordName(s.name)).toLowerCase()
                      )
                    );

                    const appliedWovenLower = new Set(
                      appliedWovenKeywords.map((k) => cleanKeywordName(k).toLowerCase())
                    );

                    const unMatchedEvidence = Array.from(new Set(evidenceKeywords)).filter(
                      (kw: string) => !matchedLower.has(kw.toLowerCase()) && !appliedWovenLower.has(kw.toLowerCase())
                    );

                    if (unMatchedEvidence.length === 0) return null;

                    return (
                      <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-500" />
                          <span className="text-[11px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                            Supported in Evidence (Click to Weave into Skills)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {unMatchedEvidence.map((kw: string, idx: number) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleQuickWeaveKeyword(kw)}
                              disabled={weavingSingleKeyword === kw}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/25 transition-all duration-150 cursor-pointer shadow-xs hover:scale-105 active:scale-95"
                              title={`Click to weave '${kw}' into Technical Skills section`}
                            >
                              {weavingSingleKeyword === kw ? (
                                <div className="h-3 w-3 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin shrink-0" />
                              ) : (
                                <Sparkles className="h-3 w-3 shrink-0 text-amber-500" />
                              )}
                              {kw}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 🔴 Missing ATS Keywords — click to weave into skills section */}
                  {(() => {
                    const allMissing = (analysisResult.sections || [])
                      .flatMap((s: any) => s.missing_keywords || [])
                      .map((k: string) => cleanKeywordName(k))
                      .filter(Boolean);

                    const matchedLower = new Set(
                      (analysisResult.top_strengths || []).map((s: any) =>
                        (typeof s === "string" ? cleanKeywordName(s) : cleanKeywordName(s.name)).toLowerCase()
                      )
                    );

                    const appliedWovenLower = new Set(
                      appliedWovenKeywords.map((k) => cleanKeywordName(k).toLowerCase())
                    );

                    const trulyMissing = Array.from(new Set(allMissing)).filter(
                      (kw) => !matchedLower.has(kw.toLowerCase()) && !appliedWovenLower.has(kw.toLowerCase())
                    );

                    if (trulyMissing.length === 0) return null;

                    return (
                      <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/80">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          <span className="text-[11px] font-extrabold text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                            Missing ATS Keywords (Click to Weave into Skills)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {trulyMissing.map((kw, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleQuickWeaveKeyword(kw)}
                              disabled={weavingSingleKeyword === kw}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-300 hover:text-white border border-indigo-200 dark:border-indigo-800 transition-all duration-200 cursor-pointer shadow-xs hover:scale-105 active:scale-95 group"
                              title={`Click to weave missing keyword '${kw}' into Technical Skills section`}
                            >
                              {weavingSingleKeyword === kw ? (
                                <div className="h-3 w-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin shrink-0" />
                              ) : (
                                <Plus className="h-3 w-3 shrink-0 text-indigo-500 group-hover:text-white" />
                              )}
                              {kw}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* ✉️ Tailored Cover Letter Card */}
              <div className="glass-panel rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 space-y-4 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shrink-0">
                      <FileText className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        Tailored Cover Letter
                        {coverLetterText && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-semibold">
                            Ready
                          </span>
                        )}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Generate a 3-paragraph executive cover letter tailored to the job description & your resume.
                      </p>
                    </div>
                  </div>

                  {!coverLetterText && (
                    <button
                      type="button"
                      onClick={handleGenerateCoverLetter}
                      disabled={isGeneratingCoverLetter}
                      className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/20 disabled:opacity-50"
                    >
                      {isGeneratingCoverLetter ? (
                        <>
                          <div className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          Generating Cover Letter...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-purple-200 animate-pulse" />
                          ✨ Generate Cover Letter (1-Click)
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Editable Target Designation & Contact Header Controls */}
                <div className="p-3 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">
                      Target Designation:
                    </span>
                    <input
                      type="text"
                      value={customTargetRole}
                      onChange={(e) => setCustomTargetRole(e.target.value)}
                      placeholder="e.g. Full Stack Developer"
                      className="flex-1 min-w-[200px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30"
                    />
                    <button
                      type="button"
                      disabled={isGeneratingCoverLetter}
                      onClick={handleGenerateCoverLetter}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50 shadow-sm"
                    >
                      Update Header
                    </button>
                  </div>
                  {user && (user.address || user.phone_number || user.linkedin_url) ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      <strong>Header Contact Line:</strong> {[user.address, user.phone_number, user.email, user.linkedin_url].filter(Boolean).join(" | ")}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsProfileModalOpen(true)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      + Add Address, Phone & LinkedIn to Profile for Cover Letter Header
                    </button>
                  )}
                </div>

                {/* Cover Letter Content Body */}
                {coverLetterText ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                        <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                        <span>Cover Letter tailored to job description</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsEditingCoverLetter(!isEditingCoverLetter)}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                          {isEditingCoverLetter ? "Done Editing" : "Edit Text"}
                        </button>
                        <button
                          type="button"
                          disabled={isGeneratingCoverLetter}
                          onClick={handleGenerateCoverLetter}
                          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3 w-3 ${isGeneratingCoverLetter ? "animate-spin" : ""}`} />
                          Regenerate
                        </button>
                      </div>
                    </div>

                    {/* Preview / Edit Area */}
                    {isEditingCoverLetter ? (
                      <div className="space-y-2">
                        <textarea
                          value={coverLetterText}
                          onChange={(e) => setCoverLetterText(e.target.value)}
                          rows={12}
                          className="w-full p-3.5 rounded-xl border border-purple-300 dark:border-purple-800/60 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-500/30 resize-y font-sans"
                          placeholder="Edit your cover letter here..."
                        />
                        <button
                          type="button"
                          disabled={isUpdatingCoverLetter}
                          onClick={() => handleUpdateCoverLetterText(coverLetterText)}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isUpdatingCoverLetter ? (
                            <div className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5" />
                          )}
                          Save Changes to Cover Letter
                        </button>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 text-xs leading-relaxed whitespace-pre-wrap font-sans space-y-2 shadow-inner">
                        {coverLetterText}
                      </div>
                    )}

                    {/* Download Buttons Bar */}
                    {coverLetterDownloadId && (
                      <div className="flex items-center justify-end flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mr-auto">
                          Export Cover Letter:
                        </span>
                        <a
                          href={`${API_BASE_URL}/api/v1/resume/download/${coverLetterDownloadId}/cover-letter?format=docx`}
                          download
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Cover Letter (.DOCX)
                        </a>
                        <a
                          href={`${API_BASE_URL}/api/v1/resume/download/${coverLetterDownloadId}/cover-letter?format=pdf`}
                          download
                          onClick={() => setSuccessNotification("Downloading Cover Letter PDF...")}
                          className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 text-white transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download Cover Letter (.PDF)
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 text-center space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Click the button above to generate an executive 3-paragraph cover letter tailored to this role and your resume achievements.
                    </p>
                  </div>
                )}
              </div>

              {/* Section Analysis Breakdown (Actionable cards shown at the top for maximum speed) */}
              <div className="space-y-6">
                {(() => {
                  const sectionsToImprove = (analysisResult.sections || [])
                    .filter((s) => s.review_status === "improve")
                    .sort((a, b) => {
                      const priorityMap = { high: 3, medium: 2, low: 1 };
                      return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
                    });

                  const sectionsToKeep = (analysisResult.sections || [])
                    .filter((s) => s.review_status === "keep");

                  const sectionsToReduce = (analysisResult.sections || [])
                    .filter((s) => s.review_status === "reduce_emphasis");

                  return (
                    <>
                      {/* Improve Sections (🟡) */}
                      {sectionsToImprove.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-900 pb-2">
                            <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                              <span>🟡 Recommendations to Improve ({sectionsToImprove.length})</span>
                            </h3>
                            <button
                              type="button"
                              disabled={isImprovingAll || Object.values(inlineLoadingSections).some(Boolean)}
                              onClick={() => handleImproveAllClick(sectionsToImprove)}
                              className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 disabled:bg-slate-100 dark:disabled:bg-slate-900 text-amber-700 dark:text-amber-400 disabled:text-slate-400 dark:disabled:text-slate-600 border border-amber-500/25 disabled:border-slate-200 dark:disabled:border-slate-800 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed select-none"
                            >
                              {isImprovingAll ? (
                                <>
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                  Improving All...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-3 w-3 animate-pulse" />
                                  Improve All with AI
                                </>
                              )}
                            </button>
                          </div>
                          <div className="space-y-4">
                            {sectionsToImprove.map((section, idx) =>
                              renderSectionCard(
                                section,
                                idx,
                                !!expandedSections[section.section_name],
                                () => toggleSection(section.section_name),
                                rewrittenSections[section.section_name.toLowerCase()],
                                previousRewrittenSections[section.section_name.toLowerCase()],
                                handleRevert,
                                handleUndoLastRewrite,
                                handleImproveClick,
                                inlineLoadingSections,
                                triggerInlineRewrite,
                                (sectionName, excluded) => setExcludedBullets((prev) => ({ ...prev, [sectionName]: excluded })),
                                isPatchingApplied
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Keep Sections (🟢) */}
                      {sectionsToKeep.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-900 pb-2">
                            <span>🟢 Keep As-Is ({sectionsToKeep.length})</span>
                          </h3>
                          <div className="space-y-4">
                            {sectionsToKeep.map((section, idx) =>
                              renderSectionCard(
                                section,
                                idx,
                                !!expandedSections[section.section_name],
                                () => toggleSection(section.section_name),
                                rewrittenSections[section.section_name.toLowerCase()],
                                previousRewrittenSections[section.section_name.toLowerCase()],
                                handleRevert,
                                handleUndoLastRewrite,
                                handleImproveClick,
                                inlineLoadingSections,
                                triggerInlineRewrite,
                                (sectionName, excluded) => setExcludedBullets((prev) => ({ ...prev, [sectionName]: excluded })),
                                isPatchingApplied
                              )
                            )}
                          </div>
                        </div>
                      )}

                      {/* Reduce Emphasis Sections (⚪) */}
                      {sectionsToReduce.length > 0 && (
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-900 pb-2">
                            <span>⚪ Reduce Emphasis ({sectionsToReduce.length})</span>
                          </h3>
                          <div className="space-y-4">
                            {sectionsToReduce.map((section, idx) =>
                              renderSectionCard(
                                section,
                                idx,
                                !!expandedSections[section.section_name],
                                () => toggleSection(section.section_name),
                                rewrittenSections[section.section_name.toLowerCase()],
                                previousRewrittenSections[section.section_name.toLowerCase()],
                                handleRevert,
                                handleUndoLastRewrite,
                                handleImproveClick,
                                inlineLoadingSections,
                                triggerInlineRewrite,
                                (sectionName, excluded) => setExcludedBullets((prev) => ({ ...prev, [sectionName]: excluded })),
                                isPatchingApplied
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Detailed Recruitment Insights Toggle (Collapsible by default at the bottom) */}
              <div className="pt-4 border-t border-slate-900/60">
                <button
                  type="button"
                  onClick={() => setShowDetailedInsights(!showDetailedInsights)}
                  className="w-full py-3 bg-slate-950/40 hover:bg-slate-950/80 text-slate-400 hover:text-white rounded-xl text-xs font-semibold border border-slate-900 transition-all flex items-center justify-center gap-2 select-none"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showDetailedInsights ? "transform rotate-180" : ""}`} />
                  {showDetailedInsights ? "Hide Detailed Recruiter Insights" : "Show Detailed Recruiter Insights (Strengths & Gap Highlights)"}
                </button>
              </div>

              {showDetailedInsights && (
                <div className="space-y-6 pt-2 animate-fade-in-up">
                  {/* Top Strengths Panel */}
                  {analysisResult.top_strengths && analysisResult.top_strengths.length > 0 && (
                    <div className="rounded-2xl p-6 border border-emerald-200 bg-emerald-50/60 space-y-4 shadow-sm">
                      <h3 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-2 border-b border-emerald-200 pb-2">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        Top Strengths Match
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {analysisResult.top_strengths.map((strength, i) => (
                          <div key={i} className="flex items-start gap-3 bg-white p-3.5 rounded-xl border border-emerald-200/80 shadow-xs">
                            <div className="h-7 w-7 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0 mt-0.5">
                              <CategoryIcon category={strength.category} className="h-4 w-4 text-emerald-700" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">{strength.name}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase font-extrabold">
                                  {strength.category}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 font-medium leading-relaxed">{strength.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Improvements Panel */}
                  {analysisResult.top_improvements && analysisResult.top_improvements.length > 0 && (
                    <div className="rounded-2xl p-6 border border-amber-200 bg-amber-50/60 space-y-4 shadow-sm">
                      <h3 className="text-xs font-black text-amber-900 uppercase tracking-wider flex items-center gap-2 border-b border-amber-200 pb-2">
                        <ShieldAlert className="h-4 w-4 text-amber-600" />
                        Top Recommended Improvements
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {(() => {
                          const sortedImprovements = [...(analysisResult.top_improvements || [])].sort(
                            (a, b) => a.priority - b.priority
                          );

                          return sortedImprovements.map((imp, i) => {
                            const isExpanded = !!expandedImprovements[imp.name];
                            const priorityColor = [
                              "bg-rose-100 text-rose-800 border-rose-300 font-extrabold",
                              "bg-rose-100 text-rose-800 border-rose-300 font-extrabold",
                              "bg-amber-100 text-amber-800 border-amber-300 font-extrabold",
                              "bg-sky-100 text-sky-800 border-sky-300 font-extrabold",
                              "bg-slate-100 text-slate-800 border-slate-300 font-bold"
                            ][imp.priority - 1] || "bg-slate-100 text-slate-800 border-slate-300 font-bold";

                            return (
                              <div
                                key={i}
                                className="rounded-xl border border-slate-200 hover:border-slate-300 transition-all duration-300 bg-white shadow-xs"
                              >
                                {/* Clickable Header for Collapsing */}
                                <div
                                  onClick={() => toggleImprovement(imp.name)}
                                  className="flex flex-wrap items-center justify-between gap-4 p-4 cursor-pointer select-none"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border uppercase ${priorityColor}`}>
                                      Priority #{imp.priority}
                                    </span>
                                    <span className="text-sm font-bold text-slate-900">{imp.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isExpanded ? "transform rotate-180" : ""}`} />
                                  </div>
                                </div>

                                {/* Collapsible Details */}
                                {isExpanded && (
                                  <div className="px-4 pb-4 border-t border-slate-200 pt-3 space-y-3.5 animate-fade-in-up">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                      {/* Rationale */}
                                      <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block">
                                          Hiring Manager Rationale
                                        </span>
                                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed italic">
                                          "{imp.reason}"
                                        </p>
                                      </div>

                                      {/* Expected Impact */}
                                      <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <span className="text-[10px] font-black text-indigo-800 uppercase tracking-wider block">
                                          Expected Interview Impact
                                        </span>
                                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                                          {imp.expected_interview_impact}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                      {/* Evidence Reused */}
                                      <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">
                                          Evidence Reused or Adjacent Skills
                                        </span>
                                        <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                                          {imp.evidence_reused || "No direct/adjacent evidence found. Recommended with caution."}
                                        </p>
                                      </div>

                                      {/* Metrics (Section & Confidence) */}
                                      <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                                        <div className="flex items-center justify-between text-[11px]">
                                          <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Target Section</span>
                                          <span className="text-slate-900 font-bold capitalize">{imp.section}</span>
                                        </div>
                                        <div className="space-y-1 pt-1 border-t border-slate-200">
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-bold text-slate-600 uppercase tracking-wider text-[10px]">Recruiter Confidence</span>
                                            <span className="text-indigo-700 font-extrabold">{Math.round(imp.confidence * 100)}%</span>
                                          </div>
                                          <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-indigo-600 rounded-full transition-all duration-500"
                                              style={{ width: `${imp.confidence * 100}%` }}
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      )}

      {/* ─── ⚡ Keyword Weave Selection Modal ───────────────────────────────── */}
      {isKeywordWeaveModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-5 bg-gradient-to-r from-emerald-50 to-indigo-50">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600 animate-pulse" />
                  Select Keywords to Weave
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Choose which ATS keywords to weave into your skills section.
                </p>
              </div>
              <button
                onClick={() => setIsKeywordWeaveModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Quick Select Bar */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/80">
              <span className="text-xs font-bold text-slate-600">
                {selectedKeywordsToWeave.size} / {keywordsForWeaveModal.length} selected
              </span>
              <div className="flex-1" />
              <button
                type="button"
                onClick={() => setSelectedKeywordsToWeave(new Set(keywordsForWeaveModal.map((k) => k.kw)))}
                className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-all cursor-pointer"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedKeywordsToWeave(new Set())}
                className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
              >
                Deselect All
              </button>
            </div>

            {/* Keyword Checklist */}
            <div className="overflow-y-auto flex-1 p-5">
              {keywordsForWeaveModal.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No keywords available to weave.</p>
              ) : (
                <div className="space-y-4">
                  {/* Supported keywords group */}
                  {keywordsForWeaveModal.filter((k) => k.type === 'supported').length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block">
                        🟡 Supported in Evidence
                      </span>
                      <div className="space-y-1.5">
                        {keywordsForWeaveModal.filter((k) => k.type === 'supported').map((item, i) => {
                          const isChecked = selectedKeywordsToWeave.has(item.kw);
                          return (
                            <label
                              key={i}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                                isChecked
                                  ? "bg-amber-50 border-amber-300"
                                  : "bg-slate-50 border-slate-200 hover:border-slate-300 opacity-60"
                              }`}
                            >
                              <div
                                className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                                  isChecked ? "border-amber-500 bg-amber-500" : "border-slate-300 bg-white"
                                }`}
                                onClick={() => {
                                  setSelectedKeywordsToWeave((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.kw)) next.delete(item.kw);
                                    else next.add(item.kw);
                                    return next;
                                  });
                                }}
                              >
                                {isChecked && (
                                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              <span className={`text-sm font-semibold ${isChecked ? "text-slate-900" : "text-slate-400"}`}>
                                {item.kw}
                              </span>
                              <span className="ml-auto text-[10px] text-amber-600 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded font-bold">
                                evidence
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Missing keywords group */}
                  {keywordsForWeaveModal.filter((k) => k.type === 'missing').length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">
                        🔴 Missing from Resume
                      </span>
                      <div className="space-y-1.5">
                        {keywordsForWeaveModal.filter((k) => k.type === 'missing').map((item, i) => {
                          const isChecked = selectedKeywordsToWeave.has(item.kw);
                          return (
                            <label
                              key={i}
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                                isChecked
                                  ? "bg-rose-50 border-rose-300"
                                  : "bg-slate-50 border-slate-200 hover:border-slate-300 opacity-60"
                              }`}
                            >
                              <div
                                className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${
                                  isChecked ? "border-rose-500 bg-rose-500" : "border-slate-300 bg-white"
                                }`}
                                onClick={() => {
                                  setSelectedKeywordsToWeave((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.kw)) next.delete(item.kw);
                                    else next.add(item.kw);
                                    return next;
                                  });
                                }}
                              >
                                {isChecked && (
                                  <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                  </svg>
                                )}
                              </div>
                              <span className={`text-sm font-semibold ${isChecked ? "text-slate-900" : "text-slate-400"}`}>
                                {item.kw}
                              </span>
                              <span className="ml-auto text-[10px] text-rose-600 bg-rose-100 border border-rose-200 px-1.5 py-0.5 rounded font-bold">
                                missing
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center gap-3 p-5 border-t border-slate-200 bg-slate-50/80">
              <button
                type="button"
                onClick={() => setIsKeywordWeaveModalOpen(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={selectedKeywordsToWeave.size === 0 || isWeavingKeywords}
                onClick={() => handleWeaveAllKeywords(Array.from(selectedKeywordsToWeave))}
                className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                Weave {selectedKeywordsToWeave.size} Selected Keyword{selectedKeywordsToWeave.size !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Rewrite Modal */}
      {isRewriteModalOpen && activeRewriteSection && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/50">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400 animate-pulse" />
                  AI Section Rewrite: {cleanSectionModalTitle(activeRewriteSection)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Review changes, hiring manager reasoning, and customize section text.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsRewriteModalOpen(false);
                  rewriteMutation.reset();
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {rewriteMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                    AI hiring manager is polishing your section...
                  </p>
                  <p className="text-xs text-slate-500 max-w-xs text-center leading-relaxed">
                    Analyzing full resume evidence context to safely embed required keywords.
                  </p>
                </div>
              ) : rewriteMutation.isError ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                    <ShieldAlert className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-rose-600 dark:text-rose-400 font-semibold">
                    Failed to generate AI rewrite
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm text-center leading-relaxed">
                    {rewriteMutation.error?.message || "An unexpected error occurred while communicating with the AI. Please verify your connection or OpenAI API Key and try again."}
                  </p>
                  <button
                    onClick={() => {
                      const recommendations = (analysisResult?.sections || []).find(
                        (s) => s.section_name.toLowerCase() === activeRewriteSection.toLowerCase()
                      )?.recommendations || [];
                      rewriteMutation.mutate({
                        document_id: documentId!,
                        section_name: activeRewriteSection,
                        job_description_text: jobDescription,
                        recommendations: recommendations,
                        user_instructions: userInstructions,
                        metric_inputs: (metricPercentage.trim() || metricScale.trim()) ? {
                          metric_or_percentage: metricPercentage.trim(),
                          scale_or_volume: metricScale.trim()
                        } : undefined
                      });
                    }}
                    className="mt-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-300 flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry Generation
                  </button>
                </div>
              ) : rewriteData ? (
                <>
                  {/* Mode Selector and Split Headers */}
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-3">
                    <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Compare & Tailor Content
                    </span>
                    <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                      <button
                        onClick={() => setDiffModeActive(false)}
                        className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${!diffModeActive ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                      >
                        Edit Mode
                      </button>
                      <button
                        onClick={() => setDiffModeActive(true)}
                        className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${diffModeActive ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                      >
                        Visual Diff
                      </button>
                    </div>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Original Content */}
                    <div className="space-y-2 flex flex-col">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                          Original Section
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">Read Only</span>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/80 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed min-h-[220px] max-h-[360px] overflow-y-auto select-none whitespace-pre-wrap flex-1 shadow-inner">
                        {rewriteData.original_text}
                      </div>
                    </div>

                    {/* Rewritten Content */}
                    <div className="space-y-2 flex flex-col">
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
                          {diffModeActive ? "Visual Diff Highlight" : "AI Rewritten Section (Editable)"}
                        </span>
                        <div className="flex items-center gap-2">
                          {!diffModeActive && draftRewrittenText !== rewriteData.rewritten_text && (
                            <button
                              type="button"
                              onClick={() => setDraftRewrittenText(rewriteData.rewritten_text)}
                              className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                              title="Reset text to original AI generation"
                            >
                              <RotateCcw className="h-3 w-3" /> Reset AI
                            </button>
                          )}
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-extrabold border border-indigo-500/20">
                            ✨ Tailored & Fact-Checked
                          </span>
                        </div>
                      </div>

                      {diffModeActive ? (
                        <div className="bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/30 dark:from-indigo-950/30 dark:via-slate-900 dark:to-purple-950/20 p-4 sm:p-5 rounded-2xl border border-indigo-200 dark:border-indigo-500/30 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed min-h-[220px] max-h-[360px] overflow-y-auto whitespace-pre-wrap select-all flex-1 shadow-md">
                          {diffWords(rewriteData.original_text, draftRewrittenText).map((token, index) => {
                            if (token.added) {
                              return (
                                <span key={index} className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 px-1 py-0.5 mx-0.5 rounded border-b-2 border-emerald-500 font-semibold shadow-2xs">
                                  {token.value}
                                </span>
                              );
                            }
                            if (token.removed) {
                              return (
                                <span key={index} className="bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 line-through opacity-75 px-1 py-0.5 mx-0.5 rounded border-b border-rose-300">
                                  {token.value}
                                </span>
                              );
                            }
                            return <span key={index}>{token.value}</span>;
                          })}
                        </div>
                      ) : (
                        <div className="relative flex flex-col flex-1">
                          <textarea
                            value={draftRewrittenText}
                            onChange={(e) => setDraftRewrittenText(e.target.value)}
                            className="w-full bg-white dark:bg-slate-950 p-4 sm:p-5 pb-10 rounded-2xl border-2 border-indigo-500/40 hover:border-indigo-500 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed min-h-[220px] max-h-[360px] overflow-y-auto focus:outline-none resize-none font-sans shadow-md transition-all"
                            placeholder="Loading rewrite text..."
                          />
                          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] text-slate-400 pointer-events-none select-none">
                            <span className="bg-slate-100 dark:bg-slate-900/90 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 font-mono font-semibold text-slate-600 dark:text-slate-400">
                              {draftRewrittenText.split("\n").filter(l => l.trim()).length} Bullets • {draftRewrittenText.trim().split(/\s+/).length} Words
                            </span>
                            <span className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/80 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                              ✏️ Click text to customize
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Google XYZ Formula & Metric Synthesizer Card */}
                  <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-slate-100 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-950 p-4 rounded-xl border border-indigo-200 dark:border-indigo-500/20 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                        </div>
                        <span className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                          Google XYZ Formula & Metric Synthesizer
                        </span>
                      </div>
                      <span className="text-[10px] bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-500/20 font-mono">
                        Accomplished [X] as measured by [Y], by doing [Z]
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                      Quantify your impact using Google's formula. Enter real numbers or scale metrics below so AI can seamlessly weave them into your achievement bullets.
                    </p>

                    {/* Metric Input Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Metric / % Improvement [Y]
                        </label>
                        <input
                          type="text"
                          value={metricPercentage}
                          onChange={(e) => setMetricPercentage(e.target.value)}
                          placeholder="e.g. '35% latency reduction', '$120k revenue growth'"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
                          disabled={rewriteMutation.isPending}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                          Scale / Scope / Volume [Y]
                        </label>
                        <input
                          type="text"
                          value={metricScale}
                          onChange={(e) => setMetricScale(e.target.value)}
                          placeholder="e.g. 'across 15 microservices', '100k daily users'"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
                          disabled={rewriteMutation.isPending}
                        />
                      </div>
                    </div>

                    {/* Quick Preset Prompt Chips */}
                    <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">Presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setUserInstructions("Format all bullets strictly using Google's XYZ formula (Accomplished X as measured by Y, by doing Z)");
                        }}
                        className="text-[10px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-indigo-700 dark:text-indigo-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                      >
                        ⚡ Google XYZ Bullets
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserInstructions("Use high-impact active verbs and emphasize quantifiable metrics");
                        }}
                        className="text-[10px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                      >
                        📊 Action Verbs + Metrics
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserInstructions("Make bullet points concise, impactful, and tailored for senior engineering leadership");
                        }}
                        className="text-[10px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-amber-700 dark:text-amber-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                      >
                        🎯 Concise Pitch
                      </button>
                    </div>
                  </div>

                  {/* Refinement User Instructions Bar */}
                  <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Refine Rewrite with Instructions
                    </span>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <input
                        type="text"
                        value={userInstructions}
                        onChange={(e) => setUserInstructions(e.target.value)}
                        placeholder="e.g. 'make it shorter', 'use stronger action verbs', 'emphasize leadership'"
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
                        disabled={rewriteMutation.isPending}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!activeRewriteSection || !documentId) return;
                          rewriteMutation.mutate({
                            document_id: documentId,
                            section_name: activeRewriteSection,
                            job_description_text: jobDescription,
                            recommendations: rewriteData?.recommendations || [],
                            user_instructions: userInstructions,
                            metric_inputs: (metricPercentage.trim() || metricScale.trim()) ? {
                              metric_or_percentage: metricPercentage.trim(),
                              scale_or_volume: metricScale.trim()
                            } : undefined
                          });
                        }}
                        disabled={rewriteMutation.isPending}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-650 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/25 transition-all duration-300 flex items-center justify-center gap-1.5 shrink-0"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Regenerate
                      </button>
                    </div>
                  </div>

                  {/* Hiring Manager Reasoning */}
                  <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-900 space-y-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Hiring Manager Reasoning
                    </span>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                      "{rewriteData.reasoning}"
                    </p>
                  </div>

                  {/* AI Changes Log */}
                  {rewriteData.changes && rewriteData.changes.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Edits Made
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {rewriteData.changes.map((change: any, idx: number) => {
                          const badgeColorMap: Record<string, string> = {
                            keyword: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30",
                            clarity: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/30",
                            structure: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20 dark:border-indigo-500/30",
                            emphasis: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30"
                          };
                          const badgeColor = badgeColorMap[change.type] || "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 dark:border-slate-500/30";

                          return (
                            <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-lg border border-slate-200 dark:border-slate-900 flex items-start gap-2.5">
                              <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-medium shrink-0 mt-0.5 ${badgeColor}`}>
                                {change.type}
                              </span>
                              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                                {change.description}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No rewrite data available.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="border-t border-slate-200 dark:border-slate-800 p-5 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-950/30">
              <button
                onClick={() => {
                  setIsRewriteModalOpen(false);
                  rewriteMutation.reset();
                }}
                disabled={rewriteMutation.isPending}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 disabled:opacity-40 disabled:hover:border-slate-200 dark:disabled:hover:border-slate-800 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-semibold transition-all duration-300"
              >
                Cancel
              </button>
              {rewriteData && (
                <button
                  onClick={() => {
                    const lowerSec = activeRewriteSection.toLowerCase();
                    const currentAccepted = rewrittenSections[lowerSec];
                    if (currentAccepted) {
                      setPreviousRewrittenSections((prev) => ({
                        ...prev,
                        [lowerSec]: currentAccepted
                      }));
                    }
                    setRewrittenSections((prev) => ({
                      ...prev,
                      [lowerSec]: draftRewrittenText
                    }));
                    setIsPatchingApplied(false);
                    setIsRewriteModalOpen(false);
                    rewriteMutation.reset();
                  }}
                  disabled={rewriteMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all duration-300 flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  Accept Rewrite
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Floating Sticky Action Dock */}
      {Object.keys(rewrittenSections).length > 0 && isBottomBarVisible && (
        <>
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] sm:w-auto max-w-2xl bg-slate-900/90 dark:bg-slate-900/90 backdrop-blur-2xl border border-slate-800/90 border-t-slate-700/60 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-white animate-fade-in-up transition-all duration-300">
            <div className="w-full mx-auto space-y-3">

              {/* Expandable Drawer for Accepted Improvements */}
              {isCartOpen && !isPatchingApplied && (
                <div className="border-b border-slate-800/80 pb-3 space-y-2 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold text-indigo-400 uppercase tracking-wider">
                      Accepted Improvements
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setRewrittenSections({});
                        setPreviousRewrittenSections({});
                        setIsPatchingApplied(false);
                        setIsCartOpen(false);
                      }}
                      className="text-[11px] text-rose-400 hover:text-rose-300 font-extrabold transition-colors select-none cursor-pointer"
                    >
                      Clear All
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto pr-1">
                    {Object.keys(rewrittenSections).map((secKey) => {
                      const originalSection = (analysisResult?.sections || []).find(
                        (s) => s.section_name.toLowerCase() === secKey
                      );
                      const displayName = originalSection?.section_name || secKey;

                      return (
                        <div key={secKey} className="flex items-center gap-1.5 text-xs bg-slate-950/80 border border-slate-800/80 px-3 py-1 rounded-xl">
                          <span className="text-slate-200 font-bold truncate capitalize max-w-[140px]">
                            {displayName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRevert(displayName)}
                            className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors rounded hover:bg-slate-900 cursor-pointer"
                            title="Revert this section"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Main Footer Row */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 border ${isPatchingApplied ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'}`}>
                    {isPatchingApplied ? <CheckCircle className="h-4.5 w-4.5" /> : <Sparkles className="h-4.5 w-4.5 animate-pulse text-amber-200" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-black text-white block truncate">
                      {isPatchingApplied ? "✅ Resume Tailored & Ready" : `${Object.keys(rewrittenSections).length} improvement${Object.keys(rewrittenSections).length > 1 ? 's' : ''} ready`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 truncate hidden xs:inline">
                        {isPatchingApplied ? "Preserved formatting" : "Ready to apply"}
                      </span>
                      {!isPatchingApplied && (
                        <button
                          type="button"
                          onClick={() => setIsCartOpen(!isCartOpen)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-300 underline font-bold select-none cursor-pointer shrink-0"
                        >
                          {isCartOpen ? "Hide" : "Details"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Download buttons — shown after successful apply, alongside re-apply */}
                    {isPatchingApplied && downloadUrl && (
                      <div className="flex items-center gap-2">
                        <a
                          href={`${API_BASE_URL}${downloadUrl}?filename=${encodeURIComponent(
                            buildResumeFilename(
                              jobDescription,
                              user?.name,
                              analysisResult?.overall_summary?.job_title,
                              file?.name
                            )
                          )}`}
                          download
                          onClick={() => setSuccessNotification("Downloading updated DOCX...")}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-500/25 transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95 border border-emerald-400/30"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>DOCX</span>
                        </a>

                        <a
                          href={`${API_BASE_URL}${downloadUrl}/pdf?filename=${encodeURIComponent(
                            buildResumeFilename(
                              jobDescription,
                              user?.name,
                              analysisResult?.overall_summary?.job_title,
                              file?.name
                            ).replace(/\.docx$/i, ".pdf")
                          )}`}
                          download
                          onClick={() => setSuccessNotification("Downloading PDF...")}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95"
                        >
                          <Download className="h-3.5 w-3.5 text-slate-300" />
                          <span>PDF</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => setIsPdfPreviewOpen(true)}
                          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
                        >
                          <FileText className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Preview</span>
                        </button>
                      </div>
                    )}

                    {/* Apply to Resume — always shown when rewrites exist (with re-apply label after first apply) */}
                    <button
                      onClick={handleApplyRewrites}
                      disabled={applyMutation.isPending}
                      className={`px-5 py-2.5 ${isPatchingApplied ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white' : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white border border-white/20 shadow-xl shadow-emerald-500/25 hover:scale-105 active:scale-95'} disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer`}
                    >
                      {applyMutation.isPending ? (
                        <>
                          <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Applying...
                        </>
                      ) : isPatchingApplied ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
                          Re-Apply Changes
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5 text-amber-200 animate-pulse" />
                          Apply to Resume
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (isPatchingApplied) {
                          setRewrittenSections({});
                          setPreviousRewrittenSections({});
                          setIsPatchingApplied(false);
                          setDownloadUrl(null);
                          setDownloadId(null);
                        }
                        setIsBottomBarVisible(false);
                        setIsCartOpen(false);
                      }}
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer select-none shrink-0"
                      title={isPatchingApplied ? "Clear and start new tailoring pass" : "Dismiss bar"}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </>
      )}

      {/* Floating Success Notification Toast */}
      {successNotification && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 p-4 rounded-xl bg-emerald-950/90 backdrop-blur-md border border-emerald-500/30 text-emerald-300 text-xs shadow-2xl animate-fade-in-down max-w-sm">
          <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-white text-xs">Success</p>
            <p className="text-emerald-400/90 text-[10px] mt-0.5">{successNotification}</p>
          </div>
          <button
            onClick={() => setSuccessNotification(null)}
            className="text-emerald-400/60 hover:text-white transition-colors ml-2 shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Popover Authentication Modal */}
      <AuthModal />

      {/* Popover Billing & Subscription Modal */}
      <SubscriptionModal isOpen={isSubscriptionModalOpen} onClose={() => setIsSubscriptionModalOpen(false)} />

      {/* Live PDF Preview Modal */}
      {isPdfPreviewOpen && (downloadId || documentId) && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live PDF Preview</h3>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`${API_BASE_URL}/api/v1/resume/download/${downloadId || documentId}/pdf?filename=${encodeURIComponent(
                    buildResumeFilename(jobDescription, user?.name, analysisResult?.overall_summary?.job_title, file?.name).replace(/\.docx$/i, ".pdf")
                  )}`}
                  download
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
                <button
                  onClick={() => setIsPdfPreviewOpen(false)}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {/* Viewer Body */}
            <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 flex items-center justify-center relative overflow-hidden">
              {isPdfLoading ? (
                <div className="flex flex-col items-center justify-center space-y-3 text-slate-500 dark:text-slate-400">
                  <div className="h-8 w-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-xs font-medium">Rendering live PDF preview...</p>
                </div>
              ) : pdfError ? (
                <div className="flex flex-col items-center justify-center space-y-4 max-w-md text-center p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <ShieldAlert className="h-10 w-10 text-amber-500" />
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{pdfError}</p>
                  <a
                    href={`${API_BASE_URL}/api/v1/resume/download/${downloadId || documentId}/pdf`}
                    download
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" /> Download PDF File
                  </a>
                </div>
              ) : pdfBlobUrl ? (
                <object
                  data={pdfBlobUrl}
                  type="application/pdf"
                  className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900"
                >
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900"
                    title="Resume PDF Preview"
                  />
                </object>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* History & Goals Modal */}
      {isHistoryModalOpen && (
        <HistoryModal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false);
            fetchDailyGoal().catch(() => {});
          }}
          onRestoreSession={handleRestoreSession}
        />
      )}

      {/* Profile & Base Documents Modal */}
      {isProfileModalOpen && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          token={token}
          onProfileUpdated={() => {
            refreshMe().catch(() => {});
          }}
        />
      )}
    </div>
  );
}
