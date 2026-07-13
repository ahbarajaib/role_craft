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
  PenTool
} from "lucide-react";
import { uploadResume, analyzeResume, applyRewrites, API_BASE_URL, ResumeAnalysisResult, ReviewedSection, StrengthItem, ImprovementItem } from "@/lib/api";
import { useAuth } from "@/components/auth_provider";
import AuthModal from "@/components/auth_modal";

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
            <span className={`text-xs px-2.5 py-0.5 rounded-full border capitalize font-medium ${priorityStyles[section.priority]}`}>
              {section.priority} priority
            </span>
          )}
          {rewrittenText && (
            <span className="text-xs px-2.5 py-0.5 rounded-full border bg-indigo-500/10 border-indigo-500/30 text-indigo-400 font-semibold animate-pulse">
              ✨ Rewritten
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-300 ${isExpanded ? "transform rotate-180" : ""}`} />
        </div>
      </div>

      {/* Collapsible Details */}
      {isExpanded && (
        <div className="px-5 pb-5 border-t border-slate-900/60 pt-4 space-y-4 animate-fade-in-up">
          {/* AI Reason Summary */}
          <p className="text-sm text-slate-300 leading-relaxed italic">
            "{section.reason}"
          </p>

          {/* Rewritten Preview Text */}
          {rewrittenText && (
            <div className="space-y-3 bg-slate-950/40 p-4.5 rounded-xl border border-indigo-500/25 shadow-inner text-xs animate-fade-in-up">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800/50">
                <span className="font-bold text-indigo-400 uppercase tracking-wider text-xs flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
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
                      onImproveClick(section.section_name, section.recommendations);
                    }}
                    className="flex items-center gap-1 text-[10px] text-slate-300 hover:text-white font-semibold px-2.5 py-1 border border-slate-800 rounded-lg bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-700 transition-all duration-300 select-none cursor-pointer"
                  >
                    <Edit className="h-2.5 w-2.5" />
                    Manual Edit
                  </button>
                </div>
              </div>
              <p className="text-[13px] text-slate-200 leading-relaxed whitespace-pre-wrap select-all font-medium pt-1">
                {rewrittenText}
              </p>
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

  useEffect(() => {
    if (Object.keys(rewrittenSections).length > 0) {
      setIsBottomBarVisible(true);
    } else {
      setIsBottomBarVisible(false);
      setIsCartOpen(false);
    }
  }, [rewrittenSections]);


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
    if (!documentId) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    setInlineLoadingSections((prev) => ({ ...prev, [sectionName]: true }));
    try {
      const { rewriteSection } = require("@/lib/api");
      const data = await rewriteSection({
        document_id: documentId,
        section_name: sectionName,
        job_description_text: jobDescription,
        recommendations: recommendations
      });
      const lowerSec = sectionName.toLowerCase();
      if (rewrittenSections[lowerSec]) {
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
      setError(err?.message || `Failed to rewrite ${sectionName}. Please try again.`);
    } finally {
      setInlineLoadingSections((prev) => ({ ...prev, [sectionName]: false }));
    }
  };

  const handleImproveAllClick = async (sectionsToImprove: any[]) => {
    if (!documentId || sectionsToImprove.length === 0) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    setIsImprovingAll(true);
    try {
      await Promise.all(
        sectionsToImprove.map((s) => triggerInlineRewrite(s.section_name, s.recommendations))
      );
      setSuccessNotification("All recommended sections tailored successfully!");
    } catch (err: any) {
      // Individual errors caught in triggerInlineRewrite
    } finally {
      setIsImprovingAll(false);
    }
  };

  const handleImproveClick = (sectionName: string, recommendations: string[]) => {
    if (!documentId) return;
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    setActiveRewriteSection(sectionName);
    setRewriteData(null);
    setDraftRewrittenText("");
    setUserInstructions("");
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
      setDownloadId(data.download_id);
      setDownloadUrl(data.download_url);
      setIsPatchingApplied(true);
      setError(null);
      setSuccessNotification("Changes applied to resume.");
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to apply modifications. Please try again.");
    }
  });

  const handleApplyRewrites = () => {
    if (!documentId) return;
    if (!token) {
      setShowAuthModal(true);
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

    applyMutation.mutate({
      document_id: documentId,
      accepted_rewrites: rewrites
    });
  };

  // 1. File Upload Mutation
  const uploadMutation = useMutation({
    mutationFn: uploadResume,
    onSuccess: (data) => {
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
      setError(err?.message || "File upload failed. Only .docx files up to 5MB are accepted.");
      setFile(null);
    }
  });

  // 2. Full Workflow Analysis Mutation
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      if (!documentId) throw new Error("Please upload a resume first");
      if (jobDescription.trim().length < 50) {
        throw new Error("Job description must be at least 50 characters long");
      }
      return analyzeResume(documentId, jobDescription);
    },
    onSuccess: (data) => {
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
    <div className={`relative min-h-screen ${theme} ${theme === "dark" ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"} bg-grid p-6 lg:p-12 overflow-x-hidden transition-colors duration-300`}>
      {/* Decorative Glow Elements */}
      <div className="glow-effect bg-indigo-500 w-[500px] h-[500px] -top-40 -left-40" />
      <div className="glow-effect bg-purple-500 w-[400px] h-[400px] top-[40%] -right-20" />

      {/* Header */}
      <header className="relative max-w-[1440px] mx-auto flex items-center justify-between mb-12 animate-fade-in-up">
        <div className="flex items-center gap-3">
          <img
            src={theme === "dark" ? "/logo.png" : "/logo-light.png"}
            alt="Role Craft Logo"
            className="h-14 w-14 object-contain rounded-xl shadow-lg shadow-indigo-600/10 dark:shadow-indigo-600/20 transition-all duration-300"
          />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Role Craft <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">Engine v1.0</span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">Craft every resume for the role.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3 bg-white/80 dark:bg-slate-900/80 pl-3 pr-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm text-xs select-none">
              <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={user.email}>
                {user.email}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold">
                {user.credits} CR
              </span>
              <button
                onClick={logout}
                className="ml-1 p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded transition-colors cursor-pointer"
                title="Sign Out"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg shadow-md shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all cursor-pointer"
            >
              Sign In
            </button>
          )}

          <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 bg-white/80 dark:bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
            <span>Local Engine Active</span>
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-sm transition-colors cursor-pointer select-none"
            title={theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme"}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
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
                <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                      <FileText className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div className="max-w-[200px] md:max-w-xs">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isUploading ? (
                      <span className="text-xs text-indigo-500 dark:text-indigo-400 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-500 animate-ping" />
                        Uploading...
                      </span>
                    ) : documentId ? (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Uploaded
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={clearFile}
                      className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
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
                className="w-full bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border border-slate-200 dark:border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl p-3 text-sm placeholder-slate-400 dark:placeholder-slate-600 transition-all outline-none resize-y shadow-inner"
              />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Min: 50 chars</span>
                <span className={jobDescription.length < 50 ? "text-amber-500/70" : "text-emerald-600 dark:text-emerald-500"}>
                  {jobDescription.length} characters
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

            {/* Analyze Button */}
            <button
              type="submit"
              disabled={!documentId || jobDescription.trim().length < 50 || isAnalyzing}
              className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all duration-300 flex items-center justify-center gap-2 glow-btn ${documentId && jobDescription.trim().length >= 50 && !isAnalyzing
                  ? "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 cursor-pointer"
                  : "bg-slate-200 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border border-slate-350 dark:border-slate-800 cursor-not-allowed"
                }`}
            >
              {isAnalyzing ? (
                <>
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running AI Analysis...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyze Gaps & Fit
                </>
              )}
            </button>
          </form>

          {/* Guidelines Box */}
          <div className="glass-panel rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-950/20 space-y-4">
            <h3 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-slate-200/50 dark:border-slate-900">
              <Info className="h-4.5 w-4.5 text-indigo-500 dark:text-indigo-400" />
              Developer Principles
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 shrink-0">
                  <Target className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Role Focused</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Tailored to the job that matters.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20 shrink-0">
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Truthful</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">100% honest. Always.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center border border-indigo-500/20 shrink-0">
                  <PenTool className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Smart Crafted</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">AI-powered edits that elevate you.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center border border-purple-500/20 shrink-0">
                  <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Results Driven</h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Stronger resume. Better opportunities.</p>
                </div>
              </div>
            </div>
          </div>
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
                        user_instructions: userInstructions
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
                            user_instructions: userInstructions
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

      {/* Sticky Action Footer */}
      {Object.keys(rewrittenSections).length > 0 && isBottomBarVisible && (
        <>
          <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 p-4 shadow-2xl animate-fade-in-up transition-all duration-300">
            <div className="max-w-3xl mx-auto">

              {/* Expandable Drawer for Accepted Improvements */}
              {isCartOpen && !isPatchingApplied && (
                <div className="border-b border-slate-800/80 pb-4 mb-4 space-y-3 animate-fade-in-up">
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
                  <div className="flex flex-wrap gap-2 max-h-[140px] overflow-y-auto pr-1">
                    {Object.keys(rewrittenSections).map((secKey) => {
                      const originalSection = (analysisResult?.sections || []).find(
                        (s) => s.section_name.toLowerCase() === secKey
                      );
                      const displayName = originalSection?.section_name || secKey;

                      return (
                        <div key={secKey} className="flex items-center gap-1.5 text-xs bg-slate-950/60 border border-slate-850/40 px-3 py-1.5 rounded-xl">
                          <span className="text-slate-200 font-semibold truncate capitalize max-w-[200px]">
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
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isPatchingApplied ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                    {isPatchingApplied ? <CheckCircle className="h-4 w-4" /> : <Sparkles className="h-4 w-4 animate-pulse" />}
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white block">
                      {isPatchingApplied ? "✅ Resume Updated" : `${Object.keys(rewrittenSections).length} accepted improvement${Object.keys(rewrittenSections).length > 1 ? 's' : ''}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">
                        {isPatchingApplied ? "Your modifications have been applied." : "Ready to apply edits to your original Word file."}
                      </span>
                      {!isPatchingApplied && (
                        <button
                          type="button"
                          onClick={() => setIsCartOpen(!isCartOpen)}
                          className="text-[10px] text-indigo-400 hover:text-indigo-350 underline font-semibold select-none cursor-pointer"
                        >
                          {isCartOpen ? "Hide Details" : "View Details"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {isPatchingApplied && downloadUrl ? (
                      <a
                        href={`${API_BASE_URL}${downloadUrl}`}
                        download
                        onClick={() => setSuccessNotification("Downloading updated resume...")}
                        className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-emerald-600/25 transition-all duration-300 flex items-center gap-1.5"
                      >
                        <FileText className="h-4 w-4" />
                        Download Updated Resume
                      </a>
                    ) : (
                      <button
                        onClick={handleApplyRewrites}
                        disabled={applyMutation.isPending}
                        className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-650 text-white rounded-xl text-xs font-bold shadow-lg shadow-indigo-600/25 hover:shadow-indigo-600/35 transition-all duration-300 flex items-center gap-1.5"
                      >
                        {applyMutation.isPending ? (
                          <>
                            <div className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                            Applying edits...
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
                    className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer select-none"
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
    </div>
  );
}
