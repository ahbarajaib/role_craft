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
  User
} from "lucide-react";
import { uploadResume, analyzeResume, rewriteSection, applyRewrites, API_BASE_URL, ResumeAnalysisResult, ReviewedSection, StrengthItem, ImprovementItem } from "@/lib/api";
import { useAuth } from "@/components/auth_provider";
import AuthModal from "@/components/auth_modal";
import SubscriptionModal from "@/components/subscription_modal";

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
    <div className={`space-y-2.5 text-[13px] text-slate-200 leading-relaxed ${className || ""}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const bulletMatch = bulletSymbols.find((s) => trimmed.startsWith(s));

        // Case 1: Explicit bullet symbol prefix
        if (bulletMatch) {
          const content = trimmed.substring(bulletMatch.length).trim();
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="text-indigo-400 font-bold shrink-0 mt-0.5 select-none">•</span>
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
              className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 select-all flex flex-wrap items-baseline gap-1.5"
            >
              <span className="font-bold text-indigo-300 text-xs tracking-wide uppercase">
                {label}
              </span>
              <span className="text-slate-200 text-xs">{rest}</span>
            </div>
          );
        }

        // Case 3: Implicit bullet — long achievement sentences without explicit symbol
        if (isImplicitBulletBlock) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="text-indigo-400 font-bold shrink-0 mt-0.5 select-none">•</span>
              <p className="flex-1 select-all">{trimmed}</p>
            </div>
          );
        }

        // Case 4: Plain paragraph (short lines, descriptions, summaries)
        return (
          <p key={idx} className="select-all leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

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
  triggerInlineRewrite?: (name: string, recs: string[]) => void
) {
  // Status-based styles
  const statusStyles = {
    improve: "border-amber-500/30 dark:border-amber-500/20 hover:border-indigo-500/40",
    keep: "border-emerald-500/30 dark:border-emerald-500/20 hover:border-slate-350 dark:hover:border-slate-700 bg-emerald-50/10 dark:bg-slate-950/10",
    reduce_emphasis: "border-slate-200 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-800/80 bg-slate-100/25 dark:bg-slate-950/20 opacity-70"
  };

  const badgeStyles = {
    improve: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30",
    keep: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30",
    reduce_emphasis: "bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-500/30"
  };

  const priorityStyles = {
    high: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 dark:border-rose-500/30",
    medium: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30",
    low: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30"
  };

  return (
    <div
      key={`${section.section_name}-${idx}`}
      className={`glass-panel rounded-xl border transition-all duration-300 ${statusStyles[section.review_status]}`}
    >
      {/* Clickable Header for Collapsing */}
      <div
        onClick={onToggle}
        className="flex flex-wrap items-center justify-between gap-4 p-5 cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-bold capitalize text-slate-850 dark:text-white">
            {section.section_name}
          </span>
          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${badgeStyles[section.review_status]}`}>
            {section.review_status === "improve"
              ? "🟡 Improve"
              : section.review_status === "keep"
                ? "🟢 Keep"
                : "⚪ Reduce Emphasis"}
          </span>
          {section.review_status === "improve" && (
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium uppercase ${priorityStyles[section.priority]}`}>
              {section.priority} priority
            </span>
          )}
          {rewrittenText && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 font-bold flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-indigo-400" />
              Rewrite Applied
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform duration-300 ${isExpanded ? "transform rotate-180" : ""}`} />
        </div>
      </div>

      {/* Collapsible Details */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-200 dark:border-slate-800/80 pt-4 space-y-4 animate-fade-in-up">
          {/* AI Reason Summary */}
          <p className="text-sm text-slate-300 leading-relaxed italic">
            "{section.reason}"
          </p>

          {/* Rewritten Preview Text */}
          {rewrittenText && (
            <div className="bg-indigo-950/20 p-4 rounded-xl border border-indigo-500/30 space-y-2 animate-fade-in-up">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                  Rewritten Section Preview
                </span>
                <div className="flex items-center gap-2">
                  {previousRewrittenText && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onUndoLastRewrite(section.section_name);
                      }}
                      className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-semibold px-2.5 py-1 border border-amber-500/20 rounded-lg bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30 transition-all duration-300 select-none cursor-pointer"
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
                    className="flex items-center gap-1 text-[10px] text-rose-400 hover:text-rose-350 font-semibold px-2.5 py-1 border border-rose-500/20 rounded-lg bg-rose-500/5 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all duration-300 select-none cursor-pointer"
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
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-semibold px-2.5 py-1 border border-indigo-500/20 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 hover:border-indigo-500/30 transition-all duration-300 select-none cursor-pointer"
                  >
                    <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                    Regenerate AI
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onImproveClick(section.section_name, section.recommendations);
                    }}
                    className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white font-semibold px-2.5 py-1 border border-slate-800 rounded-lg bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-700 transition-all duration-300 select-none cursor-pointer"
                  >
                    <Edit className="h-2.5 w-2.5" />
                    Manual Edit
                  </button>
                </div>
              </div>
              <div className="pt-1">
                <FormattedSectionText text={rewrittenText} />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Strengths */}
            {section.strengths.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                  Strengths
                </span>
                <ul className="space-y-1.5">
                  {section.strengths.map((str, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {section.recommendations.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider block">
                  Recommendations
                </span>
                <ul className="space-y-1.5">
                  {section.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-slate-300 flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Evidence Used Badges */}
          {section.evidence_used && section.evidence_used.length > 0 && (
            <div className="pt-3 border-t border-slate-900">
              <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block mb-2">
                Evidence Reused from Resume
              </span>
              <div className="flex flex-wrap gap-1.5">
                {section.evidence_used.map((ev, i) => (
                  <span key={i} className="text-[10px] bg-indigo-950/40 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded">
                    {ev}
                  </span>
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
              className="mt-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900/40 text-white disabled:text-indigo-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/10 transition-all duration-300 select-none cursor-pointer disabled:cursor-not-allowed"
            >
              {inlineLoadingSections[section.section_name] ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Generating AI Rewrite...
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
    .trim();
}

/**
 * Builds a smart resume filename from available context:
 * [Company] - [Candidate Name] - [Role].docx
 * Only includes parts that are available; falls back to "resume_updated.docx".
 */
function buildResumeFilename(
  jobDescription: string,
  userName: string | null | undefined,
  jobTitle: string | undefined
): string {
  // --- Extract company name from job description ---
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
  for (const pattern of companyPatterns) {
    const match = jobDescription.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim().replace(/[^a-zA-Z0-9& ]/g, "").trim();
      if (
        candidate.length > 2 &&
        !/^(full job description|job description|description|company|about|organization|role)$/i.test(candidate)
      ) {
        companyName = candidate;
        break;
      }
    }
  }

  // --- Use name from user account ---
  const candidateName = userName?.trim() || null;

  // --- Use detected role from analysis ---
  const role = jobTitle?.trim() || null;

  // --- Build final filename from available parts ---
  const parts = [companyName, candidateName, role].filter(Boolean);
  if (parts.length === 0) return "resume_updated.docx";
  return parts.join(" - ").replace(/[/\\?%*:|"<>]/g, "") + ".docx";
}

export default function Home() {
  const { user, token, logout, setShowAuthModal, refreshMe } = useAuth();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [file, setFile] = useState<File | null>(null);


  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as "dark" | "light" | null;
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
  }, [theme]);

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
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [metricPercentage, setMetricPercentage] = useState("");
  const [metricScale, setMetricScale] = useState("");

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
  const improvedCount = sectionsToImproveList.filter(
    (s) => !!rewrittenSections[s.section_name.toLowerCase()]
  ).length;
  const sectionsStillNeedingImprovement = totalNeeded - improvedCount;

  // Find how many improvement items have been resolved by matching rewritten sections
  const normalizedRewrittenKeys = new Set(
    Object.keys(rewrittenSections).map((k) => k.replace(/\s+/g, " ").trim())
  );

  const resolvedCount = (analysisResult?.top_improvements || []).filter((imp) =>
    normalizedRewrittenKeys.has(imp.section.toLowerCase().replace(/\s+/g, " ").trim())
  ).length;

  const initialScore = analysisResult?.overall_summary.overall_coverage_percentage || 0;
  const initialMissingCount = (analysisResult?.top_improvements || []).length;

  const currentScore = initialMissingCount > 0
    ? Math.round(initialScore + (100 - initialScore) * (resolvedCount / initialMissingCount))
    : initialScore;


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

      console.log("📋 [RoleCraft Audit] Sections queued for 1-Click Auto-Tailor:", sectionsToImprove.map(s => s.section_name));

      if (sectionsToImprove.length === 0) {
        setSuccessNotification("Your resume is already highly optimized for this role!");
        setIsAutoTailoring(false);
        return;
      }

      const newRewrites: Record<string, string> = {};
      await Promise.all(
        sectionsToImprove.map(async (sec) => {
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
            (s) => s.section_name.toLowerCase() === secKey
          );
          return {
            section: origSec?.section_name || secKey,
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
        setSuccessNotification("⚡ Resume 1-Click Auto-Tailored Successfully!");
        setIsPdfPreviewOpen(true);
      }
    } catch (err: any) {
      console.error("❌ [RoleCraft Audit] Auto-tailor error:", err);
    } finally {
      setIsAutoTailoring(false);
    }
  };

  const handleWeaveAllKeywords = async () => {
    console.log(
      "%c ⚡ [RoleCraft Audit] 'Auto-Weave All Keywords (1-Click)' Clicked ",
      "background: #d97706; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { documentId }
    );
    if (!analysisResult || !documentId) return;
    setIsWeavingKeywords(true);
    try {
      // Target ONLY the Technical Skills section for keyword weaving
      const skillsSection = (analysisResult.sections || []).find(
        (s) => s.section_name.toLowerCase().includes("skill") || s.section_name.toLowerCase().includes("technical")
      );

      const targetSections = skillsSection ? [skillsSection] : (analysisResult.sections || []).slice(0, 1);

      const missingKeywords = Array.from(
        new Set([
          ...(analysisResult.sections || []).flatMap((s) => s.missing_keywords || []),
          ...(analysisResult.top_improvements || []).map((imp) => cleanKeywordName(imp.name)),
        ])
      ).filter(Boolean);

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

        setDownloadId(applyRes.download_id);
        setDownloadUrl(applyRes.download_url);
        setIsPatchingApplied(true);
        setSuccessNotification("⚡ All ATS Keywords Woven & Resume Updated!");
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
      return {
        section: section ? section.section_name : sectionName,
        rewritten_text: rewrittenText
      };
    });

    if (rewrites.length === 0) return;

    console.log("💾 [RoleCraft Audit] Sending Patch Payload to API:", rewrites);

    applyMutation.mutate({
      document_id: documentId,
      accepted_rewrites: rewrites
    });
  };

  // 1. File Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: uploadResume,
    onSuccess: (data) => {
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

      // Refresh credits balance in header
      refreshMe().catch(() => { });

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

  const clearFile = () => {
    setFile(null);
    setDocumentId(null);
    setAnalysisResult(null);
    setError(null);
    setRewrittenSections({});
    setPreviousRewrittenSections({});
    setDownloadId(null);
    setDownloadUrl(null);
    setIsPatchingApplied(false);
    setBaseResumeLoaded(false);
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
    <div className={`relative min-h-screen ${theme} ${theme === "dark" ? "bg-[#050a0d] text-emerald-50" : "bg-[#f4f8f6] text-emerald-950"} bg-grid p-6 lg:p-12 overflow-x-hidden transition-colors duration-300`}>
      {/* Decorative Glow Elements */}
      <div className="glow-effect bg-emerald-500 w-[550px] h-[550px] -top-40 -left-40" />
      <div className="glow-effect bg-amber-500 w-[450px] h-[450px] top-[35%] -right-20" />

      {/* Header */}
      <header className="relative z-[200] max-w-[1440px] mx-auto flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-8 sm:mb-12">
        <div className="flex items-center gap-3">
          <img
            src={theme === "dark" ? "/logo.png" : "/logo-light.png"}
            alt="Role Craft Logo"
            className="h-10 w-10 sm:h-14 sm:w-14 object-contain rounded-xl shadow-lg shadow-emerald-600/10 dark:shadow-emerald-600/20 transition-all duration-300 shrink-0"
          />
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
              <span>Role Craft</span>
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-bold shrink-0">
                Engine v1.0
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium truncate">
              Craft every resume for the role.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          {/* Theme Switcher Toggle Button */}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex items-center gap-1.5 bg-white/90 dark:bg-slate-900/90 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs font-bold transition-all cursor-pointer select-none"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                <span className="hidden sm:inline">Dark</span>
              </>
            )}
          </button>

          {user ? (
            <div className="relative z-[300]">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2 bg-slate-900 dark:bg-slate-900 hover:bg-slate-800 dark:hover:bg-slate-800 text-white px-3 py-1.5 rounded-xl border border-slate-700 dark:border-slate-800 shadow-md text-xs transition-all cursor-pointer select-none"
              >
                <div className="h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-sm">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <span className="font-bold text-slate-100 max-w-[70px] sm:max-w-[120px] truncate">
                  {user.name || user.email.split("@")[0]}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold text-[10px] border border-emerald-500/30">
                  {user.plan_type === "elite" ? "∞" : user.credits} CR
                </span>
                <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isProfileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Profile Dropdown Card */}
              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[310]"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 z-[320] bg-slate-900 dark:bg-slate-900 rounded-2xl border border-slate-700 dark:border-slate-800 shadow-[0_25px_60px_rgba(0,0,0,0.9)] p-4 space-y-4 animate-fade-in-up">
                    {/* User Header */}
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black flex items-center justify-center text-sm shadow-md shadow-indigo-600/30 shrink-0">
                        {(user.name || user.email)[0].toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-white truncate">
                          {user.name || "User Account"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    {/* Account Status Details */}
                    <div className="space-y-2.5 text-xs">
                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                        <span className="text-slate-400 font-medium">Plan</span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-black uppercase text-[10px] tracking-wider">
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

                      <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                        <span className="text-slate-400 font-medium">Credits Available</span>
                        <span className="font-extrabold text-emerald-400">
                          {user.plan_type === "elite" ? "Unlimited" : `${user.credits} Credits`}
                        </span>
                      </div>

                      {user.base_resume_filename && (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                          <span className="text-slate-400 font-medium">Base Resume</span>
                          <span className="font-semibold text-slate-300 truncate max-w-[110px]" title={user.base_resume_filename}>
                            {user.base_resume_filename}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Sign Out Button */}
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Container */}
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

            {/* Job Description Textarea */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                Job Description
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description or requirement spec here (minimum 50 characters)..."
                rows={8}
                maxLength={8000}
                className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm placeholder-slate-400 dark:placeholder-slate-600 transition-all outline-none resize-y shadow-inner"
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Min: 50 chars</span>
                <span className={jobDescription.length < 50 ? "text-amber-500/70" : "text-emerald-600 dark:text-emerald-500 font-semibold"}>
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
              <div className="bg-gradient-to-r from-emerald-950/60 via-indigo-950/60 to-purple-950/60 border border-emerald-500/40 rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl animate-fade-in">
                <div className="flex items-center gap-3.5">
                  <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                    <Sparkles className="h-5 w-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      ⚡ 1-Click Full Resume Auto-Tailor
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Automatically rewrite all weak sections with ATS keywords & Google XYZ metrics in one click.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAutoTailor}
                  disabled={isAutoTailoring}
                  className="px-6 py-3.5 rounded-xl font-bold text-xs bg-gradient-to-r from-emerald-500 via-indigo-600 to-purple-600 hover:from-emerald-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30 transition-all duration-300 flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0"
                >
                  {isAutoTailoring ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ⚡ Auto-Tailoring Resume...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      ⚡ Auto-Tailor Full Resume (1-Click)
                    </>
                  )}
                </button>
              </div>

              {/* Summary Dashboard Card */}
              <div className="glass-panel rounded-2xl p-6 border-indigo-500/35 dark:border-indigo-500/20 bg-gradient-to-r from-white/95 to-indigo-500/5 dark:from-slate-900/50 dark:to-indigo-950/10">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/30">
                        Summary
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">Position Detected</span>
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight">
                      {analysisResult.overall_summary.job_title || "Target Role"}
                    </h3>
                  </div>

                  {/* Overall Score Circle */}
                  <div className="flex items-center gap-4 bg-white/80 dark:bg-slate-950/50 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-md">
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
                          className="text-slate-200 dark:text-slate-850"
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
                      <span className="absolute text-base font-black text-slate-850 dark:text-white">
                        {currentScore}%
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Overall Fit</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {sectionsStillNeedingImprovement} of {totalNeeded} sections need improvement
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive ATS Skill & Keyword Matrix Card */}
              <div className="glass-panel rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 space-y-4 shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
                      <Layers className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                        ATS Skill & Keyword Matrix
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Match overview & 1-click keyword insertion.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleWeaveAllKeywords}
                    disabled={isWeavingKeywords}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isWeavingKeywords ? (
                      <>
                        <div className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Weaving Keywords...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-emerald-200 animate-pulse" />
                        ⚡ Auto-Weave All Keywords (1-Click)
                      </>
                    )}
                  </button>
                </div>

                <div className="space-y-4">
                  {/* 🟢 Matched Skills */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                      🟢 Confirmed Matched Skills ({((analysisResult.top_strengths || []).length)})
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(analysisResult.top_strengths || []).map((s: any, idx: number) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20"
                        >
                          <CheckCircle className="h-3 w-3 shrink-0" />
                          {typeof s === "string" ? cleanKeywordName(s) : cleanKeywordName(s.name)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* 🟡 Supported Skills in Evidence */}
                  {(() => {
                    const supported = (analysisResult.top_improvements || [])
                      .filter((imp) => imp.evidence_reused && imp.evidence_reused.trim())
                      .map((imp) => ({ name: cleanKeywordName(imp.name), section: imp.section, evidence: imp.evidence_reused }));

                    if (supported.length === 0) return null;

                    return (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                          🟡 Supported in Evidence (Click to surface)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {supported.map((item, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const targetSec = item.section || "Experience";
                                const recs = (analysisResult.sections || []).find(
                                  (s) => s.section_name.toLowerCase() === targetSec.toLowerCase()
                                )?.recommendations || [];
                                setUserInstructions(`Surface and emphasize supported keyword: '${item.name}' (Evidence: ${item.evidence})`);
                                handleImproveClick(targetSec, recs);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30 transition-colors cursor-pointer group"
                              title={`Click to rewrite ${item.section} and surface ${item.name}`}
                            >
                              <Sparkles className="h-3 w-3 shrink-0 text-amber-500 group-hover:scale-110 transition-transform" />
                              {item.name}
                              <span className="text-[9px] opacity-75">({item.section})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 🔴 Missing Keywords / Gaps */}
                  {(() => {
                    const supportedNames = new Set(
                      (analysisResult.top_improvements || [])
                        .filter((imp) => imp.evidence_reused && imp.evidence_reused.trim())
                        .map((imp) => cleanKeywordName(imp.name))
                    );

                    const missingFromSections = (analysisResult.sections || []).flatMap((s) => s.missing_keywords || []);
                    const missingFromImps = (analysisResult.top_improvements || []).map((imp) => cleanKeywordName(imp.name));

                    const allMissing = Array.from(
                      new Set([...missingFromSections, ...missingFromImps].map((k) => cleanKeywordName(k)))
                    ).filter((k) => k && !supportedNames.has(k));

                    if (allMissing.length === 0) return null;

                    return (
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
                          🔴 Missing ATS Keywords (Click to weave)
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {allMissing.map((kw, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                const firstImproveSection = (analysisResult.sections || []).find(
                                  (s) => s.review_status === "improve"
                                )?.section_name || "Experience";
                                const recs = (analysisResult.sections || []).find(
                                  (s) => s.section_name.toLowerCase() === firstImproveSection.toLowerCase()
                                )?.recommendations || [];
                                setUserInstructions(`Weave and surface missing ATS keyword naturally: '${kw}'`);
                                handleImproveClick(firstImproveSection, recs);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 transition-colors cursor-pointer group"
                              title={`Click to weave '${kw}' into section rewrite`}
                            >
                              <span className="font-bold text-rose-500 group-hover:scale-125 transition-transform">+</span>
                              {kw}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
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
                                triggerInlineRewrite
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
                                triggerInlineRewrite
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
                                triggerInlineRewrite
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
                    <div className="glass-panel rounded-2xl p-6 border-emerald-500/20 bg-emerald-950/5 space-y-4">
                      <h3 className="text-sm font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-2">
                        <TrendingUp className="h-4 w-4" />
                        Top Strengths Match
                      </h3>
                      <div className="grid grid-cols-1 gap-3">
                        {analysisResult.top_strengths.map((strength, i) => (
                          <div key={i} className="flex items-start gap-3 bg-slate-950/45 p-3 rounded-xl border border-slate-900/60">
                            <div className="h-7 w-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                              <CategoryIcon category={strength.category} className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-white">{strength.name}</span>
                                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-slate-800 uppercase font-medium">
                                  {strength.category}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed">{strength.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top Improvements Panel */}
                  {analysisResult.top_improvements && analysisResult.top_improvements.length > 0 && (
                    <div className="glass-panel rounded-2xl p-6 border-amber-500/20 bg-amber-950/5 space-y-4">
                      <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2 border-b border-slate-900 pb-2">
                        <ShieldAlert className="h-4 w-4" />
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
                              "bg-rose-500/10 text-rose-400 border-rose-500/30",
                              "bg-rose-500/10 text-rose-400 border-rose-500/30",
                              "bg-amber-500/10 text-amber-400 border-amber-500/30",
                              "bg-sky-500/10 text-sky-400 border-sky-500/30",
                              "bg-slate-500/10 text-slate-400 border-slate-500/30"
                            ][imp.priority - 1] || "bg-slate-500/10 text-slate-400 border-slate-500/30";

                            return (
                              <div
                                key={i}
                                className="glass-panel rounded-xl border border-slate-900/60 hover:border-slate-800 transition-all duration-300 bg-slate-950/20"
                              >
                                {/* Clickable Header for Collapsing */}
                                <div
                                  onClick={() => toggleImprovement(imp.name)}
                                  className="flex flex-wrap items-center justify-between gap-4 p-4 cursor-pointer select-none"
                                >
                                  <div className="flex items-center gap-3">
                                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-medium uppercase ${priorityColor}`}>
                                      Priority #{imp.priority}
                                    </span>
                                    <span className="text-sm font-semibold text-white">{imp.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${isExpanded ? "transform rotate-180" : ""}`} />
                                  </div>
                                </div>

                                {/* Collapsible Details */}
                                {isExpanded && (
                                  <div className="px-4 pb-4 border-t border-slate-900/60 pt-3 space-y-3.5 animate-fade-in-up">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                      {/* Rationale */}
                                      <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                                        <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider block">
                                          Hiring Manager Rationale
                                        </span>
                                        <p className="text-[11px] text-slate-300 leading-relaxed italic">
                                          "{imp.reason}"
                                        </p>
                                      </div>

                                      {/* Expected Impact */}
                                      <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                                        <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block">
                                          Expected Interview Impact
                                        </span>
                                        <p className="text-[11px] text-slate-300 leading-relaxed">
                                          {imp.expected_interview_impact}
                                        </p>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                      {/* Evidence Reused */}
                                      <div className="space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                                        <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider block">
                                          Evidence Reused or Adjacent Skills
                                        </span>
                                        <p className="text-[11px] text-slate-300 leading-relaxed">
                                          {imp.evidence_reused || "No direct/adjacent evidence found. Recommended with caution."}
                                        </p>
                                      </div>

                                      {/* Metrics (Section & Confidence) */}
                                      <div className="space-y-2 bg-slate-950/40 p-3 rounded-lg border border-slate-900/60">
                                        <div className="flex items-center justify-between text-[11px]">
                                          <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Target Section</span>
                                          <span className="text-white font-medium capitalize">{imp.section}</span>
                                        </div>
                                        <div className="space-y-1 pt-1 border-t border-slate-900">
                                          <div className="flex items-center justify-between text-[11px]">
                                            <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Recruiter Confidence</span>
                                            <span className="text-indigo-400 font-bold">{Math.round(imp.confidence * 100)}%</span>
                                          </div>
                                          <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                            <div
                                              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
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

      {/* Side-by-Side Rewrite Modal */}
      {isRewriteModalOpen && activeRewriteSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 p-5 bg-slate-950/50">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
                  AI Section Rewrite: {activeRewriteSection}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Review changes, hiring manager reasoning, and customize section text.
                </p>
              </div>
              <button
                onClick={() => {
                  setIsRewriteModalOpen(false);
                  rewriteMutation.reset();
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {rewriteMutation.isPending ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <div className="h-10 w-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm text-indigo-400 font-semibold animate-pulse">
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
                  <p className="text-sm text-rose-400 font-semibold">
                    Failed to generate AI rewrite
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm text-center leading-relaxed">
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
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Compare & Edit
                    </span>
                    <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800 text-[10px]">
                      <button
                        onClick={() => setDiffModeActive(false)}
                        className={`px-3 py-1 rounded font-semibold transition-all ${!diffModeActive ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                      >
                        Edit Mode
                      </button>
                      <button
                        onClick={() => setDiffModeActive(true)}
                        className={`px-3 py-1 rounded font-semibold transition-all ${diffModeActive ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
                      >
                        Visual Diff
                      </button>
                    </div>
                  </div>

                  {/* Side-by-Side Comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Original Content */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Original Section
                      </span>
                      <div className="bg-slate-950 p-4 rounded-xl border border-slate-900 text-xs text-slate-400 leading-relaxed min-h-[160px] max-h-[300px] overflow-y-auto select-none opacity-80 whitespace-pre-wrap">
                        {rewriteData.original_text}
                      </div>
                    </div>

                    {/* Rewritten Content */}
                    <div className="space-y-2.5">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">
                        {diffModeActive ? "Visual Diff Highlight" : "AI Rewritten Section (Editable)"}
                      </span>
                      {diffModeActive ? (
                        <div className="bg-indigo-950/10 p-4 rounded-xl border border-indigo-500/30 text-xs text-slate-200 leading-relaxed min-h-[160px] max-h-[300px] overflow-y-auto whitespace-pre-wrap select-all">
                          {diffWords(rewriteData.original_text, draftRewrittenText).map((token, index) => {
                            if (token.added) {
                              return (
                                <span key={index} className="bg-emerald-500/20 text-emerald-300 px-0.5 rounded border-b border-emerald-500/30 font-medium">
                                  {token.value}
                                </span>
                              );
                            }
                            if (token.removed) {
                              return (
                                <span key={index} className="bg-rose-500/20 text-rose-300 line-through px-0.5 rounded border-b border-rose-500/30">
                                  {token.value}
                                </span>
                              );
                            }
                            return <span key={index}>{token.value}</span>;
                          })}
                        </div>
                      ) : (
                        <textarea
                          value={draftRewrittenText}
                          onChange={(e) => setDraftRewrittenText(e.target.value)}
                          className="w-full bg-indigo-950/10 p-4 rounded-xl border border-indigo-500/30 text-xs text-slate-200 leading-relaxed min-h-[160px] max-h-[300px] overflow-y-auto focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
                          placeholder="Loading rewrite text..."
                        />
                      )}
                    </div>
                  </div>

                  {/* Google XYZ Formula & Metric Synthesizer Card */}
                  <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-950 p-4 rounded-xl border border-indigo-500/20 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                        </div>
                        <span className="text-xs font-bold text-indigo-200">
                          Google XYZ Formula & Metric Synthesizer
                        </span>
                      </div>
                      <span className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/20 font-mono">
                        Accomplished [X] as measured by [Y], by doing [Z]
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Quantify your impact using Google's formula. Enter real numbers or scale metrics below so AI can seamlessly weave them into your achievement bullets.
                    </p>

                    {/* Metric Input Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Metric / % Improvement [Y]
                        </label>
                        <input
                          type="text"
                          value={metricPercentage}
                          onChange={(e) => setMetricPercentage(e.target.value)}
                          placeholder="e.g. '35% latency reduction', '$120k revenue growth'"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                          disabled={rewriteMutation.isPending}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Scale / Scope / Volume [Y]
                        </label>
                        <input
                          type="text"
                          value={metricScale}
                          onChange={(e) => setMetricScale(e.target.value)}
                          placeholder="e.g. 'across 15 microservices', '100k daily users'"
                          className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
                          disabled={rewriteMutation.isPending}
                        />
                      </div>
                    </div>

                    {/* Quick Preset Prompt Chips */}
                    <div className="pt-2 border-t border-slate-800/60 flex flex-wrap gap-2 items-center">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase">Presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setUserInstructions("Format all bullets strictly using Google's XYZ formula (Accomplished X as measured by Y, by doing Z)");
                        }}
                        className="text-[10px] bg-slate-900 hover:bg-slate-850 text-indigo-300 hover:text-indigo-200 px-2.5 py-1 rounded-md border border-slate-800 transition-colors cursor-pointer"
                      >
                        ⚡ Google XYZ Bullets
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserInstructions("Use high-impact active verbs and emphasize quantifiable metrics");
                        }}
                        className="text-[10px] bg-slate-900 hover:bg-slate-850 text-emerald-300 hover:text-emerald-200 px-2.5 py-1 rounded-md border border-slate-800 transition-colors cursor-pointer"
                      >
                        📊 Action Verbs + Metrics
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserInstructions("Make bullet points concise, impactful, and tailored for senior engineering leadership");
                        }}
                        className="text-[10px] bg-slate-900 hover:bg-slate-850 text-amber-300 hover:text-amber-200 px-2.5 py-1 rounded-md border border-slate-800 transition-colors cursor-pointer"
                      >
                        🎯 Concise Pitch
                      </button>
                    </div>
                  </div>

                  {/* Refinement User Instructions Bar */}
                  <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 space-y-2.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Refine Rewrite with Instructions
                    </span>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <input
                        type="text"
                        value={userInstructions}
                        onChange={(e) => setUserInstructions(e.target.value)}
                        placeholder="e.g. 'make it shorter', 'use stronger action verbs', 'emphasize leadership'"
                        className="flex-1 bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-indigo-500 rounded-xl px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-colors"
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
                  <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-900 space-y-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                      Hiring Manager Reasoning
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed italic">
                      "{rewriteData.reasoning}"
                    </p>
                  </div>

                  {/* AI Changes Log */}
                  {rewriteData.changes && rewriteData.changes.length > 0 && (
                    <div className="space-y-3">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                        Edits Made
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {rewriteData.changes.map((change: any, idx: number) => {
                          const badgeColorMap: Record<string, string> = {
                            keyword: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
                            clarity: "bg-sky-500/10 text-sky-400 border-sky-500/30",
                            structure: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
                            emphasis: "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          };
                          const badgeColor = badgeColorMap[change.type] || "bg-slate-500/10 text-slate-400 border-slate-500/30";

                          return (
                            <div key={idx} className="p-3 bg-slate-950/30 rounded-lg border border-slate-900 flex items-start gap-2.5">
                              <span className={`text-[9px] px-2 py-0.5 rounded border uppercase font-medium shrink-0 mt-0.5 ${badgeColor}`}>
                                {change.type}
                              </span>
                              <p className="text-xs text-slate-400 leading-relaxed">
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
            <div className="border-t border-slate-800 p-5 flex items-center justify-end gap-3 bg-slate-950/30">
              <button
                onClick={() => {
                  setIsRewriteModalOpen(false);
                  rewriteMutation.reset();
                }}
                disabled={rewriteMutation.isPending}
                className="px-4 py-2 border border-slate-800 hover:border-slate-700 disabled:opacity-40 disabled:hover:border-slate-800 disabled:cursor-not-allowed text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all duration-300"
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
          <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 z-40 sm:max-w-2xl bg-slate-900/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 dark:border-slate-800 p-3.5 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] animate-fade-in-up transition-all duration-300">
            <div className="w-full mx-auto space-y-3">

              {/* Expandable Drawer for Accepted Improvements */}
              {isCartOpen && !isPatchingApplied && (
                <div className="border-b border-slate-800 pb-3 space-y-2 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
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
                      className="text-[10px] text-rose-455 hover:text-rose-400 font-bold transition-colors select-none cursor-pointer"
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
                        <div key={secKey} className="flex items-center gap-1.5 text-xs bg-slate-950/60 border border-slate-850/40 px-2.5 py-1 rounded-lg">
                          <span className="text-slate-200 font-semibold truncate capitalize max-w-[140px]">
                            {displayName}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRevert(displayName)}
                            className="text-slate-500 hover:text-rose-455 p-0.5 transition-colors rounded hover:bg-slate-900 cursor-pointer"
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
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${isPatchingApplied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {isPatchingApplied ? <CheckCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4 animate-pulse" />}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-white block truncate">
                      {isPatchingApplied ? "✅ Resume Updated" : `${Object.keys(rewrittenSections).length} improvement${Object.keys(rewrittenSections).length > 1 ? 's' : ''} ready`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 truncate hidden xs:inline">
                        {isPatchingApplied ? "Applied to file" : "Ready to apply"}
                      </span>
                      {!isPatchingApplied && (
                        <button
                          type="button"
                          onClick={() => setIsCartOpen(!isCartOpen)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-350 underline font-semibold select-none cursor-pointer shrink-0"
                        >
                          {isCartOpen ? "Hide" : "Details"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    {isPatchingApplied && downloadUrl ? (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`${API_BASE_URL}${downloadUrl}?filename=${encodeURIComponent(
                            buildResumeFilename(
                              jobDescription,
                              user?.name,
                              analysisResult?.overall_summary?.job_title
                            )
                          )}`}
                          download
                          onClick={() => setSuccessNotification("Downloading updated DOCX...")}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>DOCX</span>
                        </a>

                        <a
                          href={`${API_BASE_URL}${downloadUrl}/pdf?filename=${encodeURIComponent(
                            buildResumeFilename(
                              jobDescription,
                              user?.name,
                              analysisResult?.overall_summary?.job_title
                            ).replace(/\.docx$/i, ".pdf")
                          )}`}
                          download
                          onClick={() => setSuccessNotification("Downloading PDF...")}
                          className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1"
                        >
                          <Download className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </a>

                        <button
                          type="button"
                          onClick={() => setIsPdfPreviewOpen(true)}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Preview</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={handleApplyRewrites}
                        disabled={applyMutation.isPending}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 disabled:opacity-50 text-slate-950 rounded-xl text-xs font-extrabold shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                      >
                        {applyMutation.isPending ? (
                          <>
                            <div className="h-3 w-3 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin" />
                            Applying...
                          </>
                        ) : (
                          <>
                            Apply to Resume
                          </>
                        )}
                      </button>
                    )}
                  </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Live PDF Preview</h3>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`${API_BASE_URL}/api/v1/resume/download/${downloadId || documentId}/pdf?filename=${encodeURIComponent(
                    buildResumeFilename(jobDescription, user?.name, analysisResult?.overall_summary?.job_title).replace(/\.docx$/i, ".pdf")
                  )}`}
                  download
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download PDF
                </a>
                <button
                  onClick={() => setIsPdfPreviewOpen(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            {/* Viewer Body */}
            <div className="flex-1 bg-slate-950 p-2 flex items-center justify-center relative overflow-hidden">
              {isPdfLoading ? (
                <div className="flex flex-col items-center justify-center space-y-3 text-slate-400">
                  <div className="h-8 w-8 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-xs font-medium">Rendering live PDF preview...</p>
                </div>
              ) : pdfError ? (
                <div className="flex flex-col items-center justify-center space-y-4 max-w-md text-center p-6 bg-slate-900 rounded-2xl border border-slate-800">
                  <ShieldAlert className="h-10 w-10 text-amber-400" />
                  <p className="text-sm font-semibold text-slate-200">{pdfError}</p>
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
                  className="w-full h-full rounded-xl border border-slate-800/80 bg-slate-900"
                >
                  <iframe
                    src={pdfBlobUrl}
                    className="w-full h-full rounded-xl border border-slate-800/80 bg-slate-900"
                    title="Resume PDF Preview"
                  />
                </object>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
