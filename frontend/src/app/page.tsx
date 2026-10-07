"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useIsMobile } from "@/lib/use_is_mobile";
import { usePathname, useRouter } from "next/navigation";
import { FREE_TIER_CREDITS, PRO_CREDITS, ELITE_CREDITS } from "@/lib/constants";
import Link from "next/link";
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
  Menu,
  ArrowLeft,
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
  Plus,
  Copy,
  Check,
  CheckCircle2,
  Zap,
  SlidersHorizontal,
  LifeBuoy,
  Phone,
  Eye,
  Scissors,
  Search,
  BarChart2,
  ShieldCheck,
  GitMerge,
  GraduationCap,
  Award,
  Star,
} from "lucide-react";
import { uploadResume, analyzeResume, rewriteSection, applyRewrites, generateCoverLetter, updateCoverLetter, downloadCoverLetterFile, calculateProfileCompletion, API_BASE_URL, ResumeAnalysisResult, ReviewedSection, StrengthItem, ImprovementItem, fetchAnalysisHistory, DailyTargetSummary, updateDailyTarget } from "@/lib/api";
import { DailyGoalCard } from "@/components/daily_goal_card";
import { useAuth } from "@/components/auth_provider";
import AuthModal from "@/components/auth_modal";
import SubscriptionModal from "@/components/subscription_modal";
import ExtensionModal from "@/components/extension_modal";
import ExtensionPreviewModal from "@/components/extension_preview_modal";
import HistoryModal from "@/components/history_modal";
import FeaturesShowcase from "@/components/features_showcase";
import TestimonialsSection from "@/components/testimonials_section";
import FaqSection from "@/components/faq_section";
import { ProfileModal } from "@/components/profile_modal";
import { WordLogoIcon, PdfLogoIcon } from "@/components/file_format_icons";
import ResumeCompletionModal, { getFullProfilePhotoUrl } from "@/components/resume_completion_modal";
import TailorPreviewModal from "@/components/tailor_preview_modal";
import ResumeDownloadPanel from "@/components/resume_download_panel";
import IssueReportModal from "@/components/issue_report_modal";
import { MobileBottomNav } from "@/components/mobile_bottom_nav";
import {
  StructuredResume,
  parseAndSaveStructuredResume,
  fetchStructuredResume,
  tailorResume,
  TailorResponse,
} from "@/lib/structured_resume_api";
import { trackEvent, trackError } from "@/lib/telemetry";

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
              <span className="text-teal-600 dark:text-teal-400 font-bold shrink-0 mt-0.5 select-none">•</span>
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
              <span className="font-bold text-teal-700 dark:text-teal-300 text-xs tracking-wide uppercase">
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
              <span className="text-teal-600 dark:text-teal-400 font-bold shrink-0 mt-0.5 select-none">•</span>
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

// ─── Helper: parse raw section lines into segregated role entries ──────────────
interface StructuredRoleEntry {
  title: string;
  companyAndDates?: string;
  bullets: string[];
}

function parseTextIntoStructuredEntries(lines: string[]): StructuredRoleEntry[] {
  const result: StructuredRoleEntry[] = [];
  let currentEntry: StructuredRoleEntry | null = null;

  const bulletSymbols = ["•", "-", "*", "–", "—", "▪", "▸"];
  const actionVerbStarters = [
    "engineered", "spearheaded", "achieved", "optimized", "designed", "developed",
    "implemented", "configured", "conducted", "streamlined", "automated", "collaborated",
    "resolved", "handled", "delivered", "maintained", "consistently", "assisted", "created",
    "built", "provided", "utilized", "authors", "authored", "increased", "reduced", "led"
  ];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    const isExplicitBullet = bulletSymbols.some((s) => trimmed.startsWith(s));
    const startsWithVerb = actionVerbStarters.some((v) => lower.startsWith(v));
    const hasDatePattern = /\b(19|20)\d{2}\b/.test(trimmed) || lower.includes("present");

    // A true Title Line must be short (< 55 chars), not end with period, not start with an action verb
    const isTitleLine =
      !isExplicitBullet &&
      !startsWithVerb &&
      trimmed.length < 55 &&
      !trimmed.endsWith(".") &&
      (
        i + 1 < lines.length && (lines[i + 1].includes("|") || lines[i + 1].includes(",") || /\b(19|20)\d{2}\b/.test(lines[i + 1]))
      );

    const isCompanyLine =
      !isExplicitBullet &&
      !startsWithVerb &&
      !isTitleLine &&
      (trimmed.includes("|") || (hasDatePattern && trimmed.length < 90 && (trimmed.includes(",") || trimmed.includes("–") || trimmed.includes("-"))));

    if (isTitleLine) {
      if (currentEntry) result.push(currentEntry);
      currentEntry = { title: trimmed, bullets: [] };
    } else if (isCompanyLine && currentEntry && !currentEntry.companyAndDates) {
      currentEntry.companyAndDates = trimmed;
    } else {
      let bulletContent = trimmed;
      const matchSymbol = bulletSymbols.find((s) => trimmed.startsWith(s));
      if (matchSymbol) {
        bulletContent = trimmed.substring(matchSymbol.length).trim();
      }
      if (!currentEntry) {
        currentEntry = { title: "Overview / Highlights", bullets: [] };
      }
      currentEntry.bullets.push(bulletContent);
    }
  }

  if (currentEntry) result.push(currentEntry);
  return result;
}

function RenderSegregatedContent({
  lines,
  masterResume,
  sectionName,
  variant = "rose",
}: {
  lines: string[];
  masterResume?: StructuredResume | null;
  sectionName?: string;
  variant?: "rose" | "emerald";
}) {
  if (!lines || lines.length === 0) return null;

  const isEmerald = variant === "emerald";
  const borderStyle = isEmerald
    ? "border-emerald-200/80 dark:border-emerald-900/50 hover:border-emerald-300 dark:hover:border-emerald-700"
    : "border-rose-200/80 dark:border-rose-900/50 hover:border-rose-300 dark:hover:border-rose-700";
  const iconStyle = isEmerald
    ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400"
    : "bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400";
  const badgeStyle = isEmerald
    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-950/50 border-emerald-200/60 dark:border-emerald-800/40"
    : "text-rose-700 dark:text-rose-300 bg-rose-50/80 dark:bg-rose-950/50 border-rose-200/60 dark:border-rose-800/40";
  const bulletDotStyle = isEmerald ? "text-emerald-500 font-bold" : "text-rose-500 font-bold";
  const dividerStyle = isEmerald ? "border-emerald-100 dark:border-emerald-900/40" : "border-rose-100 dark:border-rose-900/40";

  // Try retrieving structured entries directly from masterResume if available
  if (masterResume && sectionName) {
    const secNameLower = sectionName.toLowerCase();
    const matchingSec = masterResume.sections.find(
      (s) => s.section_title.toLowerCase().includes(secNameLower) || s.section_type.toLowerCase().includes(secNameLower)
    );
    if (matchingSec && matchingSec.section_type === "experience" && matchingSec.content?.entries?.length > 0) {
      return (
        <div className="space-y-3.5">
          {matchingSec.content.entries.map((entry: any, eIdx: number) => {
            const companyPart = entry.company || "";
            const locationPart = entry.location ? `, ${entry.location}` : "";
            const datePart = entry.start_date ? ` | ${entry.start_date} - ${entry.end_date || "Present"}` : "";
            const metaStr = `${companyPart}${locationPart}${datePart}`;

            return (
              <div
                key={eIdx}
                className={`p-4 bg-white dark:bg-slate-900 rounded-xl border ${borderStyle} shadow-2xs space-y-2.5 transition-all`}
              >
                <div className={`flex flex-wrap items-center justify-between gap-2 pb-2 border-b ${dividerStyle}`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-lg ${iconStyle} flex items-center justify-center font-bold text-xs shrink-0`}>
                      💼
                    </div>
                    <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                      {entry.job_title || "Experience Role"}
                    </span>
                  </div>
                  {metaStr && (
                    <span className={`text-[11px] font-bold ${badgeStyle} px-2.5 py-1 rounded-md border`}>
                      {metaStr}
                    </span>
                  )}
                </div>
                {entry.bullets && entry.bullets.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {entry.bullets.map((bullet: string, bIdx: number) => (
                      <li key={bIdx} className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed flex items-start gap-2 select-all">
                        <span className={`${bulletDotStyle} shrink-0 mt-0.5`}>•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      );
    }
  }

  // Fallback to intelligent line parser
  const entries = parseTextIntoStructuredEntries(lines);

  if (entries.length === 1 && entries[0].title === "Overview / Highlights") {
    return (
      <div className={`space-y-2 bg-white/90 dark:bg-slate-900/80 p-3.5 rounded-xl border ${borderStyle} text-xs text-slate-800 dark:text-slate-200 font-medium`}>
        {lines.map((l, i) => (
          <p key={i} className="leading-relaxed border-b border-slate-200/50 dark:border-slate-800/50 last:border-b-0 pb-1.5 last:pb-0 select-all">
            {l}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {entries.map((entry, eIdx) => (
        <div
          key={eIdx}
          className={`p-4 bg-white dark:bg-slate-900 rounded-xl border ${borderStyle} shadow-2xs space-y-2.5 transition-all`}
        >
          <div className={`flex flex-wrap items-center justify-between gap-2 pb-2 border-b ${dividerStyle}`}>
            <div className="flex items-center gap-2">
              <div className={`h-6 w-6 rounded-lg ${iconStyle} flex items-center justify-center font-bold text-xs shrink-0`}>
                💼
              </div>
              <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                {entry.title}
              </span>
            </div>
            {entry.companyAndDates && (
              <span className={`text-[11px] font-bold ${badgeStyle} px-2.5 py-1 rounded-md border`}>
                {entry.companyAndDates}
              </span>
            )}
          </div>
          {entry.bullets.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {entry.bullets.map((bullet, bIdx) => (
                <li key={bIdx} className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed flex items-start gap-2 select-all">
                  <span className={`${bulletDotStyle} shrink-0 mt-0.5`}>•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Helper: convert StructuredResume object into rewrites text dictionary ────
function convertTailoredResumeToRewrites(tailoredResume: any): Record<string, string> {
  const rewrites: Record<string, string> = {};
  if (!tailoredResume || !tailoredResume.sections) return rewrites;

  for (const sec of tailoredResume.sections) {
    const titleLower = (sec.section_title || "").toLowerCase().trim();
    const typeLower = (sec.section_type || "").toLowerCase().trim();

    let textBlock = "";
    if (sec.section_type === "summary") {
      textBlock = sec.content?.text || "";
    } else if (sec.section_type === "skills") {
      const cats = sec.content?.categories || [];
      textBlock = cats.map((c: any) => `${c.category_name}: ${(c.skills || []).join(", ")}`).join("\n");
    } else if (sec.section_type === "experience") {
      const entries = sec.content?.entries || [];
      const lines: string[] = [];
      for (const e of entries) {
        if (e.job_title) lines.push(e.job_title);
        let meta = e.company || "";
        if (e.location) meta += `, ${e.location}`;
        if (e.start_date) meta += ` | ${e.start_date} - ${e.end_date || "Present"}`;
        if (meta) lines.push(meta);
        if (e.bullets && e.bullets.length > 0) {
          lines.push(...e.bullets.map((b: string) => `• ${b}`));
        }
      }
      textBlock = lines.join("\n");
    } else if (sec.section_type === "projects") {
      const entries = sec.content?.entries || [];
      const lines: string[] = [];
      for (const e of entries) {
        if (e.name) lines.push(e.name);
        if (e.technologies && e.technologies.length > 0) {
          lines.push(`Technologies: ${e.technologies.join(", ")}`);
        }
        if (e.bullets && e.bullets.length > 0) {
          lines.push(...e.bullets.map((b: string) => `• ${b}`));
        }
      }
      textBlock = lines.join("\n");
    }

    if (textBlock.trim()) {
      if (titleLower) rewrites[titleLower] = textBlock;
      if (typeLower) rewrites[typeLower] = textBlock;
    }
  }

  return rewrites;
}

// ─── Helper: get rewritten text with fuzzy key & sectionType matching ────────
function getRewrittenTextForSection(
  sectionName: string,
  rewrites: Record<string, string>,
  sectionType?: string
): string | undefined {
  if (!rewrites || !sectionName) return undefined;
  const nameLower = (sectionName || "").toLowerCase().trim();
  const typeLower = (sectionType || "").toLowerCase().trim();

  // 1. Direct match on exact normalized section name
  if (rewrites[nameLower]) return rewrites[nameLower];
  if (typeLower && rewrites[typeLower]) return rewrites[typeLower];

  // 2. Direct match on key contained in sectionName or vice-versa
  for (const [key, val] of Object.entries(rewrites)) {
    const kLower = key.toLowerCase().trim();
    if (kLower === nameLower) return val;
    if (kLower.length > 3 && (nameLower.includes(kLower) || kLower.includes(nameLower))) {
      return val;
    }
  }

  // 3. Sub-role matching inside multi-entry experience / project text blocks
  const cleanTitleWords = nameLower.split(/[\t\-\|\,\–\—\:]/)[0].trim().split(" ").filter((w) => w.length > 2);
  for (const [key, textVal] of Object.entries(rewrites)) {
    if (!textVal || typeof textVal !== "string") continue;
    const blocks = textVal.split(/\n\n+/);
    for (const block of blocks) {
      const blockLower = block.toLowerCase();
      const matchesTitle = cleanTitleWords.length > 0 && cleanTitleWords.every((word) => blockLower.includes(word));
      if (matchesTitle) {
        return block.trim();
      }
    }
  }

  // 4. Overall section type fallback
  if (typeLower === "experience" || nameLower.includes("experience") || nameLower.includes("work")) {
    const expKey = Object.keys(rewrites).find((k) => k.includes("experience") || k.includes("work") || k === "experience");
    if (expKey && rewrites[expKey]) return rewrites[expKey];
  }
  if (typeLower === "skills" || nameLower.includes("skill")) {
    const skillKey = Object.keys(rewrites).find((k) => k.includes("skill"));
    if (skillKey && rewrites[skillKey]) return rewrites[skillKey];
  }
  if (typeLower === "summary" || nameLower.includes("summary")) {
    const sumKey = Object.keys(rewrites).find((k) => k.includes("summary"));
    if (sumKey && rewrites[sumKey]) return rewrites[sumKey];
  }

  return undefined;
}

// ─── Helper: clean cover letter word-splitting and kerning artifacts ─────────
function cleanCoverLetterText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\bto\s+jo\s*n\b/gi, "to join")
    .replace(/\bdel\s*ver\b/gi, "deliver")
    .replace(/\brel\s*iabl\s*e\b/gi, "reliable")
    .replace(/\butil\s*iz\s*ing\b/gi, "utilizing")
    .replace(/\bfacil\s*itated\b/gi, "facilitated")
    .replace(/\benabl\s*ing\b/gi, "enabling")
    .replace(/\bequi\s*p\s+me\b/gi, "equip me")
    .replace(/\bworkfl\s*ows\b/gi, "workflows")
    .replace(/\bspecifcat\s*ons\b/gi, "specifications")
    .replace(/\bexcel\s*ence\b/gi, "excellence")
    .replace(/\bw\s+th\b/gi, "with")
    .replace(/Node\s*\.\s*j\s*s/gi, "Node.js")
    .replace(/React\s*\.\s*j\s*s/gi, "React.js")
    .replace(/\baFull\s+Stack/gi, "a Full Stack")
    .replace(/Full\s+Stack\s+Devel\s*oper/gi, "Full Stack Developer");
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
        (isDateHeader || ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst", "executive", "specialist", "director"].some(r => lowerLine.includes(r)));

      const isCompanyHeader =
        !isExplicitBullet &&
        trimmed.length < 80 &&
        (trimmed.includes(",") || trimmed.includes("|") || trimmed.endsWith(".")) &&
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

// ─── Summary Leadership & Role Positioning Presets ───────────────────────────
export interface SummaryPositioningPreset {
  id: string;
  label: string;
  badge: string;
  shortLabel: string;
  icon: string;
  desc: string;
  instruction: string;
}

export const SUMMARY_POSITIONING_PRESETS: SummaryPositioningPreset[] = [
  {
    id: "team_lead_transition",
    label: "Step Up to Team Lead",
    badge: "🚀 Team Lead Transition",
    shortLabel: "Team Lead",
    icon: "🚀",
    desc: "Position senior engineering depth for lead ownership: architecture, code reviews, mentoring, and sprint delivery without claiming false past titles.",
    instruction: "Position the candidate as a senior developer transitioning to Team Lead; emphasize architecture, code reviews, developer mentorship, and reliable delivery without claiming a formal Team Lead title."
  },
  {
    id: "hands_on_tech_lead",
    label: "Hands-on Tech Lead",
    badge: "👑 Hands-on Tech Lead",
    shortLabel: "Tech Lead",
    icon: "👑",
    desc: "Dual-track credibility: deep coding craftsmanship paired with technical direction, system architecture, and engineering standards.",
    instruction: "Position as a Hands-on Tech Lead with dual-track excellence in core coding, system architecture, standards, and technical direction."
  },
  {
    id: "senior_ic",
    label: "Senior IC (Specialist)",
    badge: "💻 Senior IC",
    shortLabel: "Senior IC",
    icon: "💻",
    desc: "Pure deep technical execution, resilient architecture, and specialized engineering problem solving.",
    instruction: "Position as a deep technical Senior Individual Contributor; emphasize technical mastery, resilient architecture design, and complex implementation."
  },
  {
    id: "default",
    label: "Target Job Match",
    badge: "🎯 Job Match",
    shortLabel: "Job Match",
    icon: "🎯",
    desc: "Direct alignment matching the target job description title and core technical requirements.",
    instruction: "Align professional summary directly with the target job title and core technical requirements."
  }
];

export function isSummarySection(sectionName?: string | null): boolean {
  if (!sectionName) return false;
  const lower = sectionName.toLowerCase().trim();
  return (
    lower.includes("summary") ||
    lower.includes("profile") ||
    lower.includes("about") ||
    lower.includes("objective") ||
    lower === "executive summary" ||
    lower === "professional summary"
  );
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
  onImproveClick: (name: string, recs: string[], positioningMode?: string) => void;
  inlineLoadingSections?: Record<string, boolean>;
  triggerInlineRewrite?: (name: string, recs: string[], positioningMode?: string) => void;
  onBulletExclusionChange?: (sectionName: string, excludedIndexes: Set<number>) => void;
  isPatchingApplied?: boolean;
  masterResume?: StructuredResume | null;
  isTailoringEnabled?: boolean;
  onToggleTailoring?: (name: string) => void;
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
  masterResume = null,
  isTailoringEnabled = true,
  onToggleTailoring,
}: SectionCardProps) {
  // Check if this card represents a professional summary/profile section
  const isSummary = isSummarySection(section.section_name);
  const [selectedPositioning, setSelectedPositioning] = useState<string>("team_lead_transition");

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

  // Status-based styles with elegant left accent border
  const statusStyles = {
    improve: "border-amber-200/90 hover:border-amber-300 bg-amber-50/15 shadow-2xs border-l-4 border-l-amber-400",
    keep: "border-teal-200/80 hover:border-teal-300 bg-teal-50/10 shadow-2xs border-l-4 border-l-teal-500",
    reduce_emphasis: "border-slate-200 bg-slate-50/50 opacity-80 border-l-4 border-l-slate-300"
  };

  const badgeStyles = {
    improve: "bg-amber-50 text-amber-900 border-amber-200 font-extrabold",
    keep: "bg-[#E6F7F4] text-teal-900 border-[#99F6E4] font-extrabold",
    reduce_emphasis: "bg-slate-100 text-slate-700 border-slate-200 font-bold"
  };

  const priorityStyles = {
    high: "bg-rose-50 text-rose-700 border-rose-200 font-black",
    medium: "bg-amber-50 text-amber-700 border-amber-200 font-bold",
    low: "bg-slate-100 text-slate-600 border-slate-200 font-medium"
  };

  const parsedBullets = rewrittenText ? parseBulletsFromText(rewrittenText) : [];
  const hasBullets = parsedBullets.some((b) => b.isBullet);

  const originalTextRaw = section.evidence_used && section.evidence_used.length > 0 ? section.evidence_used.join("\n") : "";
  const parsedOriginalBullets = originalTextRaw ? parseBulletsFromText(originalTextRaw) : [];
  const hasOriginalBullets = parsedOriginalBullets.some((b) => b.isBullet);

  return (
    <div
      key={`${section.section_name}-${idx}`}
      className={`rounded-2xl border transition-all duration-300 bg-white shadow-2xs ${statusStyles[section.review_status]}`}
    >
      {/* Clickable Header for Collapsing */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between gap-3 p-3.5 sm:p-4 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`px-2 py-0.5 text-[10px] font-black rounded-md border uppercase tracking-wider shrink-0 ${badgeStyles[section.review_status]}`}
          >
            {section.review_status === "improve"
              ? "Needs Review"
              : section.review_status === "keep"
                ? "Good As Is"
                : "Reduce Emphasis"}
          </span>
          <h3 className="font-black text-slate-900 dark:text-white text-xs sm:text-sm md:text-base truncate flex items-center gap-1.5">
            <span className="truncate">{section.section_name}</span>
            {inlineLoadingSections[section.section_name] ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-teal-700 dark:text-teal-300 bg-[#E6F7F4] dark:bg-slate-900/90 border border-teal-300 dark:border-teal-700 px-2 py-0.5 rounded-full animate-pulse shrink-0">
                <div className="h-2 w-2 border-2 border-teal-600 border-t-transparent rounded-full animate-spin shrink-0" />
                Tailoring...
              </span>
            ) : rewrittenText ? (
              <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border shrink-0 ${isPatchingApplied
                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300"
                : "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/90 border-amber-300"
                }`}>
                {isPatchingApplied ? (
                  <>
                    <CheckCircle className="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
                    Applied
                  </>
                ) : (
                  <>
                    <span className="h-1 w-1 rounded-full bg-amber-500 animate-pulse" />
                    Pending
                  </>
                )}
                {isSummary && rewrittenText && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 rounded-full border bg-teal-50 dark:bg-slate-900/90 text-teal-800 dark:text-teal-300 border-teal-300 shrink-0">
                    {SUMMARY_POSITIONING_PRESETS.find(p => p.id === selectedPositioning)?.badge || "🚀 Team Lead"}
                  </span>
                )}
              </span>
            ) : null}
          </h3>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onToggleTailoring && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleTailoring(section.section_name);
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer select-none ${isTailoringEnabled
                ? "bg-teal-600 hover:bg-teal-700 text-white shadow-2xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 border border-slate-200 dark:border-slate-700"
                }`}
              title={isTailoringEnabled ? "AI Tailoring ENABLED for this section. Click to DISABLE." : "AI Tailoring DISABLED for this section. Click to ENABLE."}
            >
              {isTailoringEnabled ? (
                <>
                  <Zap className="h-3 w-3 text-amber-300 fill-amber-300 shrink-0" />
                  <span className="hidden sm:inline">Tailor: </span>
                  <span>ON</span>
                </>
              ) : (
                <>
                  <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                  <span className="hidden sm:inline">Tailor: </span>
                  <span>OFF</span>
                </>
              )}
            </button>
          )}

          <span
            className={`hidden md:inline-block px-1.5 py-0.5 text-[9px] font-extrabold rounded border uppercase tracking-wider shrink-0 ${priorityStyles[section.priority]}`}
          >
            {section.priority}
          </span>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-slate-100 dark:border-slate-800/60">

          {/* Inline AI Loading Cue */}
          {inlineLoadingSections[section.section_name] && (
            <div className="p-5 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-emerald-50/70 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-emerald-950/40 rounded-2xl border border-teal-200 dark:border-slate-800 space-y-3.5 animate-pulse">
              <div className="flex items-center justify-between border-b border-teal-200/80 dark:border-slate-800/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400 animate-spin" />
                  <span className="text-xs font-black text-[#0F172A] dark:text-teal-200 uppercase tracking-wider">
                    {isSummary ? `AI Positioning Summary for ${SUMMARY_POSITIONING_PRESETS.find(p => p.id === selectedPositioning)?.shortLabel || "Leadership"}...` : `AI Tailoring ${section.section_name}...`}
                  </span>
                </div>
                <span className="text-[10px] font-extrabold text-teal-700 dark:text-teal-300 bg-[#E6F7F4] dark:bg-slate-900/60 px-2 py-0.5 rounded-md border border-teal-200">
                  {isSummary ? "🛡️ Anti-AI Authentic Voice" : "Google XYZ Action-Impact Formula"}
                </span>
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-3 bg-indigo-200/60 dark:bg-slate-900/40 rounded-md w-3/4" />
                <div className="h-3 bg-indigo-200/40 dark:bg-slate-900/30 rounded-md w-full" />
                <div className="h-3 bg-indigo-200/50 dark:bg-slate-900/35 rounded-md w-5/6" />
              </div>
            </div>
          )}

          {/* Rewritten Preview Text with Side-by-Side Comparison */}
          {rewrittenText && (
            <div className="space-y-3 animate-fade-in-up">
              {/* Header Action Bar */}
              <div className="flex items-center justify-between flex-wrap gap-2 bg-teal-50/70 dark:bg-slate-900/40 p-3 rounded-xl border border-teal-200 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-[#0F172A] dark:text-teal-200 uppercase tracking-wider block">
                    ⚡ AI Section Rewrite Comparison
                  </span>
                  {hasBullets && (
                    <span className="text-[9px] font-semibold text-teal-600 dark:text-teal-400 bg-[#E6F7F4] dark:bg-slate-900/60 border border-teal-200 dark:border-slate-800 px-1.5 py-0.5 rounded-md">
                      ✓ Uncheck bullets to exclude
                    </span>
                  )}
                  {isSummary && (
                    <span className="text-[9px] font-extrabold text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700 px-1.5 py-0.5 rounded-md flex items-center gap-1">
                      🛡️ Authentic Anti-AI
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
                        triggerInlineRewrite(
                          section.section_name,
                          section.recommendations,
                          isSummary ? selectedPositioning : undefined
                        );
                      } else {
                        onImproveClick(
                          section.section_name,
                          section.recommendations,
                          isSummary ? selectedPositioning : undefined
                        );
                      }
                    }}
                    className="flex items-center gap-1 text-[10px] text-teal-700 dark:text-teal-300 font-extrabold px-2.5 py-1 border border-teal-300 dark:border-teal-700 rounded-lg bg-[#E6F7F4] dark:bg-slate-900/80 hover:bg-indigo-200 transition-all duration-300 select-none cursor-pointer"
                  >
                    <Sparkles className="h-2.5 w-2.5 animate-pulse" />
                    Regenerate AI
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onImproveClick(
                        section.section_name,
                        section.recommendations,
                        isSummary ? selectedPositioning : undefined
                      );
                    }}
                    className="flex items-center gap-1 text-[10px] text-slate-800 dark:text-slate-200 font-extrabold px-2.5 py-1 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 transition-all duration-300 select-none cursor-pointer"
                  >
                    <Edit className="h-2.5 w-2.5" />
                    Manual Edit
                  </button>
                </div>
              </div>

              {/* Quick Positioning Switcher for Summary */}
              {isSummary && (
                <div className="bg-gradient-to-r from-teal-50/70 via-purple-50/50 to-slate-50 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900/40 p-2.5 rounded-xl border border-teal-200/80 dark:border-teal-500/20 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <span>🎯 Role:</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {SUMMARY_POSITIONING_PRESETS.map((preset) => {
                        const isSelected = selectedPositioning === preset.id;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPositioning(preset.id);
                              if (triggerInlineRewrite) {
                                triggerInlineRewrite(section.section_name, section.recommendations, preset.id);
                              }
                            }}
                            className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? "bg-teal-600 text-white shadow-xs ring-1 ring-teal-500"
                                : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-800"
                            }`}
                            title={`Switch positioning to ${preset.label} and re-tailor`}
                          >
                            <span>{preset.icon}</span>
                            <span>{preset.shortLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <span className="text-[9px] text-teal-800 dark:text-teal-300 font-medium italic">
                    Click any role above to switch & re-tailor instantly
                  </span>
                </div>
              )}

              {/* Side-by-side Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Left Column: Original Resume Text */}
                <div className="bg-rose-50/60 dark:bg-rose-950/30 p-4 rounded-xl border border-rose-200/80 dark:border-rose-900/50 space-y-3 flex flex-col">
                  <div className="flex items-center justify-between border-b border-rose-200 dark:border-rose-900/50 pb-2">
                    <span className="text-[10px] font-black text-rose-800 dark:text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" />
                      Original Resume Text (Before)
                    </span>
                  </div>
                  <div className="pt-1 space-y-2 flex-1">
                    <RenderSegregatedContent
                      lines={section.evidence_used && section.evidence_used.length > 0 ? section.evidence_used : [section.section_name]}
                      masterResume={masterResume}
                      sectionName={section.section_name}
                      variant="rose"
                    />
                  </div>
                </div>

                {/* Right Column: AI Tailored Rewritten Text */}
                <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 space-y-3 flex flex-col">
                  <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-900/50 pb-2">
                    <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
                      AI Tailored & Rewritten Text (After)
                    </span>
                  </div>
                  <div className="pt-1 space-y-2 flex-1">
                    <RenderSegregatedContent
                      lines={rewrittenText.split("\n")}
                      masterResume={masterResume}
                      sectionName={section.section_name}
                      variant="emerald"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dedicated Professional Summary Positioning Control Box */}
          {isSummary && (
            <div className="p-4 bg-gradient-to-r from-teal-50/70 via-purple-50/50 to-slate-50 dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900/40 rounded-xl border border-teal-200/90 dark:border-teal-500/30 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400 animate-pulse" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Summary Role & Leadership Positioning
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700 flex items-center gap-1">
                    🛡️ Anti-AI Authentic Voice (Zero Clichés)
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Applying for a Team Lead or Senior role? Position your senior engineering background for technical ownership (architecture, code reviews, mentoring, delivery) with grounded human phrasing — without fabricating false past titles or using robotic buzzwords.
              </p>

              {/* Preset Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-1">
                {SUMMARY_POSITIONING_PRESETS.map((preset) => {
                  const isSelected = selectedPositioning === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPositioning(preset.id);
                      }}
                      className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-teal-600 text-white border-teal-700 shadow-sm ring-2 ring-teal-500/20"
                          : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-teal-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-bold flex items-center gap-1">
                          <span>{preset.icon}</span>
                          <span className="truncate">{preset.shortLabel}</span>
                        </span>
                        {isSelected && (
                          <span className="text-[8px] bg-white/20 text-white font-extrabold px-1.5 py-0.2 rounded-full uppercase">
                            Active
                          </span>
                        )}
                      </div>
                      <div className={`text-[10px] mt-1 line-clamp-2 leading-tight ${isSelected ? "text-indigo-100" : "text-slate-500 dark:text-slate-400"}`}>
                        {preset.desc}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Action Buttons inside Positioning Box */}
              <div className="pt-1 flex items-center justify-between flex-wrap gap-2 border-t border-slate-200/80 dark:border-slate-800/60 pt-2.5">
                <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium">
                  Mode: <strong className="text-teal-700 dark:text-teal-300 font-bold">{SUMMARY_POSITIONING_PRESETS.find(p => p.id === selectedPositioning)?.label}</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={!!inlineLoadingSections[section.section_name]}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (triggerInlineRewrite) {
                        triggerInlineRewrite(section.section_name, section.recommendations, selectedPositioning);
                      } else {
                        onImproveClick(section.section_name, section.recommendations, selectedPositioning);
                      }
                    }}
                    className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Tailor Summary ({SUMMARY_POSITIONING_PRESETS.find(p => p.id === selectedPositioning)?.shortLabel})</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onImproveClick(section.section_name, section.recommendations, selectedPositioning);
                    }}
                    className="px-2.5 py-1.5 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    title="Open Side-by-Side Rewrite Modal with this positioning"
                  >
                    <Edit className="h-3.5 w-3.5" />
                    <span>Side-by-Side Modal</span>
                  </button>
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
              <div className="space-y-2 bg-teal-50/70 dark:bg-slate-900/40 p-3.5 rounded-xl border border-teal-200 dark:border-slate-800/60">
                <span className="text-xs font-black text-[#0F172A] dark:text-teal-300 uppercase tracking-wider block">
                  RECOMMENDATIONS
                </span>
                <ul className="space-y-1.5">
                  {section.recommendations.map((rec, i) => (
                    <li key={i} className="text-xs text-slate-800 dark:text-slate-200 font-semibold flex items-start gap-2">
                      <AlertCircle className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
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
              <RenderSegregatedContent lines={section.evidence_used} masterResume={masterResume} sectionName={section.section_name} />
            </div>
          )}

          {/* CTA Action - Available on Improve & Good-As-Is sections, excluded for Reduce Emphasis */}
          {(section.review_status as string) !== "reduce_emphasis" && !rewrittenText && (
            <button
              disabled={!!inlineLoadingSections[section.section_name]}
              onClick={(e) => {
                e.stopPropagation();
                if (triggerInlineRewrite) {
                  triggerInlineRewrite(
                    section.section_name,
                    section.recommendations,
                    isSummary ? selectedPositioning : undefined
                  );
                } else {
                  onImproveClick(
                    section.section_name,
                    section.recommendations,
                    isSummary ? selectedPositioning : undefined
                  );
                }
              }}
              className={`mt-2 w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2.5 shadow-md transition-all duration-200 select-none ${inlineLoadingSections[section.section_name]
                ? "bg-slate-900 dark:bg-slate-950 text-white border border-slate-700 shadow-slate-900/30 cursor-wait"
                : section.review_status === "improve"
                  ? "bg-teal-600 hover:bg-teal-700 text-white shadow-teal-600/20 cursor-pointer"
                  : "bg-slate-800 hover:bg-slate-900 dark:bg-slate-800 dark:hover:bg-slate-700 text-white shadow-slate-900/20 cursor-pointer"
                }`}
            >
              {inlineLoadingSections[section.section_name] ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin text-cyan-400 shrink-0" />
                  <span className="text-white text-xs font-black tracking-wide">
                    {isSummary ? `Generating AI Summary for ${SUMMARY_POSITIONING_PRESETS.find(p => p.id === selectedPositioning)?.shortLabel}...` : "Generating AI Rewrite..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-300" />
                  <span>
                    {isSummary
                      ? `Tailor Summary for ${SUMMARY_POSITIONING_PRESETS.find(p => p.id === selectedPositioning)?.shortLabel || "Team Lead"} with AI`
                      : section.review_status === "improve"
                        ? "Improve with AI"
                        : "Tailor Section with AI"}
                  </span>
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
  onImproveClick: (name: string, recs: string[], positioningMode?: string) => void,
  inlineLoadingSections: Record<string, boolean> = {},
  triggerInlineRewrite?: (name: string, recs: string[], positioningMode?: string) => void,
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
      masterResume={null}
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
  }, []);

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
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
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
            const isPending = idx > currentStep;
            const StepIcon = step.icon;

            return (
              <div
                key={idx}
                className={`relative flex items-start gap-3.5 px-4 py-3 rounded-xl transition-all duration-500 ${isCurrent
                  ? "bg-teal-50 border border-teal-200 shadow-sm"
                  : isDone
                    ? "bg-emerald-50/50 border border-emerald-100"
                    : "border border-transparent"
                  }`}
              >
                {/* Left timeline line */}
                {idx < PIPELINE_STEPS.length - 1 && (
                  <div className={`absolute left-[22px] top-[42px] w-0.5 h-[calc(100%-8px)] ${isDone ? "bg-emerald-300" : "bg-slate-200"} transition-colors duration-700`} />
                )}

                {/* Step circle */}
                <div className={`relative shrink-0 h-7 w-7 rounded-full flex items-center justify-center mt-0.5 z-10 transition-all duration-500 ${isDone
                  ? "bg-emerald-500 shadow-md shadow-emerald-500/30"
                  : isCurrent
                    ? "bg-white border-2 border-teal-500 shadow-md shadow-teal-500/20"
                    : "bg-white border-2 border-slate-200"
                  }`}>
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
                    <span className={`text-sm font-bold leading-tight transition-colors duration-300 ${isDone ? "text-emerald-700" : isCurrent ? "text-teal-700" : "text-slate-400"
                      }`}>
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
                  <p className={`text-xs mt-0.5 transition-colors duration-300 ${isDone ? "text-emerald-600/70" : isCurrent ? "text-teal-600/80" : "text-slate-400"
                    }`}>
                    {step.sub}
                  </p>
                </div>

                {/* Step icon */}
                <div className={`shrink-0 p-1.5 rounded-lg transition-all duration-300 ${isDone ? "bg-emerald-100 text-emerald-600" : isCurrent ? "bg-[#E6F7F4] text-teal-600" : "bg-slate-100 text-slate-300"
                  }`}>
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

function AutoTailoringProgressModal({
  targetRole,
  controlledStepIndex,
  controlledProgress,
  isComplete,
  onClose,
}: {
  targetRole: string;
  controlledStepIndex?: number;
  controlledProgress?: number;
  isComplete?: boolean;
  onClose?: () => void;
}) {
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

  // Smooth realistic progress ticker:
  // Instead of racing to 94% in 8s and stopping dead, we pace across realistic AI tailoring duration (~20s-25s):
  // When reaching step 5 (>= 90%), it never dead-stops; it gently micro-creeps (91% -> 92% -> ... -> 98%)
  // so the user clearly sees live active progress.
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


// Universal conversational and grammatical noise words (domain-agnostic across all industries)
const GRAMMATICAL_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "will", "have",
  "your", "our", "you", "are", "not", "but", "can", "all", "also",
  "any", "who", "how", "what", "when", "where", "than", "been", "more",
  "they", "their", "them", "into", "its", "over", "such", "each",
  "well", "both", "about", "work", "role", "using", "able", "must",
  "should", "would", "could", "other", "some", "within", "across",
  "which", "through", "great", "excellent", "help", "high", "plus",
  "needs", "need", "deliver", "delivering", "collaborate", "collaborating",
  "driven", "drive", "drives", "very", "much", "many", "good", "best",
  "better", "daily", "overall", "overall fit", "missing", "clarify",
  "approach", "value", "values", "overview", "practices", "responsibilities",
  "requirements", "opportunity", "opportunities", "environment", "environments",
  "assistant", "corporate", "employment", "fast", "follow-up", "followup",
  "hiring", "information", "interested", "like", "platforms", "platform",
  "reimbursement", "time", "wing", "urgency", "willing", "process", "processes",
  "missing technologies", "clarify integration projects", "extensive",
  "proven expertise", "building full-stack solutions", "deal progression",
  "and deal progression", "strong full-stack development", "results-oriented",
  "hands-on", "end-to-end", "proficient", "proficient in", "experience",
  "experiences", "skills", "knowledge", "understanding", "ability",
]);

// Format any skill or competency cleanly (preserves acronyms like GAAP, SAP, AWS, EHR, ICU, CPA, SEO, CRM, API)
function formatDomainSkill(str: string): string {
  if (!str) return "";
  if (str.length <= 5 && str === str.toUpperCase() && !str.includes(" ")) {
    return str;
  }
  return str
    .split(/\s+/)
    .map((w) => {
      // Preserve standard uppercase domain acronyms (e.g. GAAP, SAP, EHR, B2B, AI, ML, CPA, P&L, KPI)
      if (w.length <= 4 && w === w.toUpperCase() && /^[A-Z0-9&]+$/.test(w)) {
        return w;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function cleanKeywordName(rawName: string): string {
  if (!rawName) return "";
  let clean = rawName
    .replace(/^[\s•\-–—*·▪▸►✓✔→\d.)\]]+/g, "") // strip leading bullets and numbers
    .replace(/^(add|include|highlight|emphasize|condense|surface|rephrase|incorporate|integrate|leverage|utilize|apply|demonstrate|showcase|built|clarify|missing|ensure)\s+/i, "")
    .replace(/^(experience (with|in)|proficien(t|cy) (in|with)|hands-on with|strong background in|knowledge of|familiarity with|understanding of|ability to|proven track record in|deep understanding of|practical experience in|specializing in|focus on|expertise in)\s+/i, "")
    .replace(/\s+(usage|skills|experience|experiences|knowledge|stack|level|concepts|proficiency|background)$/i, "")
    .replace(/^(\d+\+?\s+years?(\s+of)?)\s+/i, "")
    .replace(/^and\s+/i, "")
    .trim();

  // Strip trailing punctuation
  clean = clean.replace(/[.,;:—\-]+$/, "").trim();

  return formatDomainSkill(clean);
}

function isActualATSKeyword(kw: string): boolean {
  if (!kw) return false;
  const clean = kw.trim();
  // Length check: concise skill or domain competency
  if (clean.length < 2 || clean.length > 45) return false;

  // Sentence / clause rejection
  if (/[—;?]|when\s|where\s|which\s|with the\s|and when|in order to|ability to|because\s|although\s|missing technologies|clarify/i.test(clean)) {
    return false;
  }

  const lower = clean.toLowerCase();
  if (GRAMMATICAL_STOPWORDS.has(lower)) return false;

  const words = clean.split(/\s+/);
  // Word count check: concise 1 to 4 words
  if (words.length > 4) return false;

  // Single word: must be at least 2 chars and not generic filler
  if (words.length === 1 && (lower.length < 2 || ["with", "from", "that", "this", "have", "time", "like", "fast", "lead", "wing"].includes(lower))) {
    return false;
  }

  // Reject if first word is conjunction or noise
  if (["and", "with", "or", "to", "for", "in", "of", "the", "by"].includes(words[0].toLowerCase())) {
    return false;
  }

  return true;
}

function getSkillCategory(skillName: string): { label: string; badgeColor: string } {
  const s = skillName.toLowerCase();

  // Leadership, Strategy, Collaboration & Management
  if (/lead|manage|direct|coordinat|supervis|stakeholder|communicat|collaborat|team|agile|scrum|strategy|negotiat|client|talent|recruit|train|hiring|cross-functional/i.test(s)) {
    return { label: "Leadership & Strategy", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  // Compliance, Standards, Regulations, Audits & Quality
  if (/complian|gaap|hipaa|sox|iso|audit|standard|regul|govern|quality|qa|qc|protocol|safety|customs|tax|law|legal|policy/i.test(s)) {
    return { label: "Compliance & Standards", badgeColor: "bg-amber-50 text-amber-700 border-amber-200" };
  }

  // Analytics, Data, Financial & Quantitative
  if (/financ|budget|analyt|data|metric|report|forecast|model|p&l|revenue|cost|ledger|reconcil|math|statist|econom|pricing|kpi/i.test(s)) {
    return { label: "Analytics & Finance", badgeColor: "bg-purple-50 text-purple-700 border-purple-200" };
  }

  // Tools, Systems, Platforms & Software
  if (/system|software|tool|platform|portal|app|erp|crm|sap|oracle|cloud|db|database|server|net|api|hubspot|salesforce|jira|figma|git|linux/i.test(s) || (skillName.length <= 5 && skillName === skillName.toUpperCase())) {
    return { label: "Systems & Tools", badgeColor: "bg-teal-50 text-teal-700 border-teal-200" };
  }

  // Core Specialized Domain Competencies across all professions
  return { label: "Domain Competency", badgeColor: "bg-teal-50 text-teal-700 border-teal-200" };
}

function extractStrictKeywordsFromRaw(raw: string): string[] {
  if (!raw) return [];
  const cleaned = cleanKeywordName(raw);
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

  // Format: [Candidate Name] - [Targeted Role]
  const parts = [candidateName, designation].filter(Boolean);
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

export default function Home({ initialTab }: { initialTab?: "landing" | "workspace" } = {}) {
  const { user, token, logout, setShowAuthModal, openAuthModal, refreshMe } = useAuth();
  const isProOrElite = Boolean(user?.plan_type === "pro" || user?.plan_type === "elite" || user?.subscription_status === "active");
  const pathname = usePathname();
  const router = useRouter();
  const [theme] = useState<"light">("light");
  const [activeNavTab, setActiveNavTab] = useState<"landing" | "workspace">(() => {
    if (initialTab) return initialTab;
    if (typeof window !== "undefined") {
      if (window.location.pathname.startsWith("/workspace") || window.location.hash === "#workspace") {
        return "workspace";
      }
    }
    return "landing";
  });
  const [file, setFile] = useState<File | null>(null);
  const [dailyGoal, setDailyGoal] = useState<DailyTargetSummary | null>(null);
  const [showDailyGoalBanner, setShowDailyGoalBanner] = useState<boolean>(true);
  const [isUpdatingDailyTarget, setIsUpdatingDailyTarget] = useState<boolean>(false);

  // ── Guest Mode State ──────────────────────────────────────────────────────
  // guestResumeText: plain text extracted client-side from DOCX (for ATS scoring only)
  // The original File object stays in `file` state — intact for upload after sign-in
  const [guestResumeText, setGuestResumeText] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(false);
  const [isRunningGuestAnalysis, setIsRunningGuestAnalysis] = useState(false);
  // Stores the action to replay after sign-in completes
  const pendingActionAfterLoginRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rolecraft_show_daily_goal");
      if (saved !== null) {
        setShowDailyGoalBanner(saved === "true");
      }
    }
  }, []);

  const toggleDailyGoalBanner = () => {
    setShowDailyGoalBanner((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("rolecraft_show_daily_goal", String(next));
      }
      return next;
    });
  };

  const handleQuickUpdateTarget = async (newTarget: number) => {
    if (newTarget < 1 || newTarget > 50 || isUpdatingDailyTarget) return;
    setIsUpdatingDailyTarget(true);
    try {
      const updated = await updateDailyTarget(newTarget);
      setDailyGoal(updated);
    } catch (err) {
      console.error("Failed to update daily target:", err);
    } finally {
      setIsUpdatingDailyTarget(false);
    }
  };

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
    if (tab === "workspace") {
      router.push("/workspace", { scroll: false });
    } else {
      router.push("/", { scroll: false });
    }
  };

  useEffect(() => {
    if (pathname?.startsWith("/workspace") || (typeof window !== "undefined" && window.location.hash === "#workspace")) {
      setActiveNavTab("workspace");
    } else if (pathname === "/" && !initialTab) {
      setActiveNavTab("landing");
    }
  }, [pathname, initialTab]);

  const [jobDescription, setJobDescription] = useState("");

  const [documentId, setDocumentId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<ResumeAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [expandedImprovements, setExpandedImprovements] = useState<Record<string, boolean>>({});

  const [rewrittenSections, setRewrittenSections] = useState<Record<string, string>>({});
  const [previousRewrittenSections, setPreviousRewrittenSections] = useState<Record<string, string>>({});
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [subscriptionModalReason, setSubscriptionModalReason] = useState<"out_of_credits" | "extension_upsell" | "general">("general");
  const [subscriptionInitialPlan, setSubscriptionInitialPlan] = useState<"pro" | "elite">("pro");
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [isExtensionPreviewModalOpen, setIsExtensionPreviewModalOpen] = useState(false);

  // ── Onboarding / Empty State Tracking ──
  const isResumeUploaded = !!file;
  const isJDPopulated = jobDescription.trim().length > 20;
  const isAnalyzed = !!analysisResult;

  let onboardingStep = 1;
  if (isResumeUploaded) onboardingStep = 2;
  if (isResumeUploaded && isJDPopulated) onboardingStep = 3;
  if (isAnalyzed) onboardingStep = 4;

  const loadSampleData = () => {
    // 1. Set a dummy file name so the UI thinks a resume is uploaded
    setFile(new File([""], "John_Doe_Software_Engineer.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));

    // 2. Load a sample JD
    setJobDescription("We are looking for a Senior Backend Engineer with deep expertise in Python, FastAPI, and PostgreSQL. You will architect event-driven microservices using Apache Kafka and deploy them on AWS/Kubernetes. The ideal candidate has experience reducing system latency and scaling APIs for high throughput (100k+ daily requests).");

    // Smooth scroll to the analyze button
    setTimeout(() => {
      document.getElementById("analyze-btn")?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const openUpgradeModal = (
    reason: "out_of_credits" | "extension_upsell" | "general" = "general",
    plan: "pro" | "elite" = "pro"
  ) => {
    setSubscriptionModalReason(reason);
    setSubscriptionInitialPlan(plan);
    setIsSubscriptionModalOpen(true);
  };

  const showGuestUpgradeModal = (trigger: string, pendingAction?: () => void) => {
    if (pendingAction) {
      pendingActionAfterLoginRef.current = pendingAction;
    }
    const score =
      analysisResult?.overall_summary?.overall_coverage_percentage ??
      (analysisResult?.overall_summary as any)?.match_percentage ??
      undefined;
    openAuthModal({ score, trigger });
  };
  const [isRewriteModalOpen, setIsRewriteModalOpen] = useState(false);
  const [activeRewriteSection, setActiveRewriteSection] = useState<string | null>(null);
  const [rewriteData, setRewriteData] = useState<any | null>(null);
  const [draftRewrittenText, setDraftRewrittenText] = useState("");
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [isPatchingApplied, setIsPatchingApplied] = useState(false);
  const [userInstructions, setUserInstructions] = useState("");
  const [modalPositioningMode, setModalPositioningMode] = useState<string>("team_lead_transition");
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
  const [autoTailorStepIndex, setAutoTailorStepIndex] = useState<number | undefined>(undefined);
  const [autoTailorProgress, setAutoTailorProgress] = useState<number | undefined>(undefined);
  const [autoTailorComplete, setAutoTailorComplete] = useState<boolean>(false);
  const [tailoringSectionToggles, setTailoringSectionToggles] = useState<Record<string, boolean>>({});
  const isRestoredRef = useRef(false);
  const autoTailorAbortControllerRef = useRef<AbortController | null>(null);

  const handleCloseAutoTailoringModal = () => {
    if (autoTailorAbortControllerRef.current) {
      try {
        autoTailorAbortControllerRef.current.abort();
      } catch (e) {}
      autoTailorAbortControllerRef.current = null;
    }
    setIsAutoTailoring(false);
    setAutoTailorComplete(false);
    setAutoTailorStepIndex(undefined);
    setAutoTailorProgress(undefined);
  };

  const [isAutoTailorSettingsOpen, setIsAutoTailorSettingsOpen] = useState(false);

  const isSectionTailorEnabled = (sectionId: string, defaultOn: boolean = true) => {
    if (tailoringSectionToggles[sectionId] !== undefined) {
      return tailoringSectionToggles[sectionId];
    }
    const lower = sectionId.toLowerCase();
    if (lower === "header" || lower.includes("header") || lower.includes("targeted role") || lower.includes("target job title")) return true;
    if (lower === "keywords" || lower.includes("keyword") || lower.includes("matrix") || lower.includes("ats skill")) return true;
    if (lower.includes("education") || lower.includes("certification")) return false;
    return defaultOn;
  };

  const handleToggleSectionTailoring = (sectionId: string, defaultOn: boolean = true) => {
    setTailoringSectionToggles((prev) => {
      const current = isSectionTailorEnabled(sectionId, defaultOn);
      const nextState = !current;
      console.log(`⚡ [RoleCraft Tailor] Item '${sectionId}' toggled to:`, nextState ? "ON (Tailor)" : "OFF (Locked)");
      return { ...prev, [sectionId]: nextState };
    });
  };

  const getAutoTailorConfigSections = () => {
    const list: { id: string; name: string; desc: string; icon: any; defaultOn: boolean; category: string }[] = [
      {
        id: "header",
        name: "Targeted Role & Header Designation",
        desc: "Match resume headline & job title to the target position",
        icon: Target,
        defaultOn: true,
        category: "Header & Role",
      },
      {
        id: "keywords",
        name: "ATS Skill & Keyword Matrix (Auto-Weave)",
        desc: "Automatically integrate missing high-impact ATS keywords from the JD into rewrites",
        icon: Sparkles,
        defaultOn: true,
        category: "ATS Optimization",
      },
    ];

    const seen = new Set<string>();
    seen.add("header");
    seen.add("keywords");
    seen.add("targeted role & header designation");
    seen.add("ats skill & keyword matrix (auto-weave)");

    const candidateSections: { name: string; type?: string }[] = [];

    if (analysisResult?.sections && analysisResult.sections.length > 0) {
      analysisResult.sections.forEach((s) => {
        const lower = s.section_name.toLowerCase();
        if (!seen.has(lower) && !lower.includes("header")) {
          seen.add(lower);
          candidateSections.push({ name: s.section_name, type: (s as any).section_type });
        }
      });
    }

    if (masterResume?.sections && masterResume.sections.length > 0) {
      masterResume.sections.forEach((s) => {
        const lower = s.section_title.toLowerCase();
        if (!seen.has(lower) && !lower.includes("header")) {
          seen.add(lower);
          candidateSections.push({ name: s.section_title, type: s.section_type });
        }
      });
    }

    if (candidateSections.length === 0) {
      candidateSections.push(
        { name: "Professional Summary", type: "summary" },
        { name: "Professional Experience", type: "experience" },
        { name: "Technical & Core Skills", type: "skills" },
        { name: "Key Projects", type: "projects" },
        { name: "Education", type: "education" },
        { name: "Certifications", type: "certifications" }
      );
    }

    candidateSections.forEach((sec) => {
      const lower = sec.name.toLowerCase();
      let icon: any = Layers;
      let desc = "Optimize content & keywords for target role";
      let defaultOn = true;

      if (lower.includes("summary") || lower.includes("objective") || sec.type === "summary") {
        icon = Sparkles;
        desc = "Tailor executive summary pitch & core competencies";
        defaultOn = true;
      } else if (lower.includes("experience") || lower.includes("work") || lower.includes("employment") || sec.type === "experience") {
        icon = Briefcase;
        desc = "Google XYZ impact metrics (Accomplished [X] as measured by [Y] doing [Z])";
        defaultOn = true;
      } else if (lower.includes("skill") || sec.type === "skills") {
        icon = Code;
        desc = "Weave target ATS keywords, tools & tech stack";
        defaultOn = true;
      } else if (lower.includes("project") || sec.type === "projects") {
        icon = Layers;
        desc = "Highlight relevant project architecture & tools";
        defaultOn = true;
      } else if (lower.includes("education") || lower.includes("academic") || sec.type === "education") {
        icon = GraduationCap;
        desc = "Preserve degrees & GPA (locked by default)";
        defaultOn = false;
      } else if (lower.includes("certification") || lower.includes("certificate") || lower.includes("license")) {
        icon = Award;
        desc = "Preserve credential names (locked by default)";
        defaultOn = false;
      }

      list.push({
        id: sec.name,
        name: sec.name,
        desc,
        icon,
        defaultOn,
        category: "Resume Sections",
      });
    });

    return list;
  };

  const handleEnableRecommendedSections = () => {
    const configSections = getAutoTailorConfigSections();
    const newToggles: Record<string, boolean> = {};
    configSections.forEach((sec) => {
      newToggles[sec.id] = sec.defaultOn;
    });
    setTailoringSectionToggles(newToggles);
    setSuccessNotification("Auto-Tailor scope set to Recommended preset");
  };

  const handleEnableAllSections = () => {
    const configSections = getAutoTailorConfigSections();
    const newToggles: Record<string, boolean> = {};
    configSections.forEach((sec) => {
      newToggles[sec.id] = true;
    });
    setTailoringSectionToggles(newToggles);
    setSuccessNotification("Enabled ALL sections & items for Auto-Tailoring");
  };

  const handleDisableAllSections = () => {
    const configSections = getAutoTailorConfigSections();
    const newToggles: Record<string, boolean> = {};
    configSections.forEach((sec) => {
      newToggles[sec.id] = false;
    });
    setTailoringSectionToggles(newToggles);
    setSuccessNotification("All items locked (Auto-Tailoring will skip them)");
  };

  const [isWeavingKeywords, setIsWeavingKeywords] = useState(false);
  const [appliedWovenKeywords, setAppliedWovenKeywords] = useState<string[]>([]);
  const [isKeywordsWoven, setIsKeywordsWoven] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [customTargetRole, setCustomTargetRole] = useState<string>("");
  const [isEditingTargetRole, setIsEditingTargetRole] = useState<boolean>(false);
  const [targetRoleDraft, setTargetRoleDraft] = useState<string>("");
  const [keywordFilterTab, setKeywordFilterTab] = useState<'all' | 'matched' | 'supported' | 'missing'>('all');
  const [keywordSearchQuery, setKeywordSearchQuery] = useState<string>("");

  // ── Keyword Weave Modal state ──────────────────────────────────────────────
  const [isKeywordWeaveModalOpen, setIsKeywordWeaveModalOpen] = useState(false);
  const [keywordsForWeaveModal, setKeywordsForWeaveModal] = useState<{ kw: string; type: 'missing' | 'supported' }[]>([]);
  const [selectedKeywordsToWeave, setSelectedKeywordsToWeave] = useState<Set<string>>(new Set());

  // ── Manually removed skills (🟢 Confirmed Matched) ────────────────────────
  const [manuallyRemovedSkills, setManuallyRemovedSkills] = useState<Set<string>>(new Set());

  // ── Per-section excluded bullet indexes (for DOCX patch filtering) ─────────
  const [excludedBullets, setExcludedBullets] = useState<Record<string, Set<number>>>({});
  const handleBulletExclusionChange = (sectionName: string, excluded: Set<number>) => {
    setExcludedBullets((prev) => ({ ...prev, [sectionName]: excluded }));
    setIsPatchingApplied(false);
  };
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [metricPercentage, setMetricPercentage] = useState("");
  const [metricScale, setMetricScale] = useState("");

  // ── History & Goals State ───────────────────────────────────────────────
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // ── Unified Structured Resume & Tailor State ───────────────────────────
  const [masterResume, setMasterResume] = useState<StructuredResume | null>(null);
  const [isCompletionModalOpen, setIsCompletionModalOpen] = useState(false);
  const [isTailorPreviewOpen, setIsTailorPreviewOpen] = useState(false);
  const [tailorResult, setTailorResult] = useState<TailorResponse | null>(null);

  // ── Issue & Bug Reporting State ─────────────────────────────────────────
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<"bug" | "formatting" | "ai_quality" | "payment" | "feature_request" | "general">("bug");
  const [reportInitialError, setReportInitialError] = useState<string | null>(null);

  const openIssueReport = (
    category: "bug" | "formatting" | "ai_quality" | "payment" | "feature_request" | "general" = "bug",
    errorContext: string | null = null
  ) => {
    setReportCategory(category);
    setReportInitialError(errorContext);
    setIsReportModalOpen(true);
  };

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

  const VIP_EMAILS_FE = ["ahbarajaib@gmail.com", "absarajaib@gmail.com"];
  const [isReloadingCredits, setIsReloadingCredits] = useState(false);

  const handleReloadCredits = async () => {
    if (!token) return;
    setIsReloadingCredits(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "https://api.rolecraft.tech"}/api/v1/auth/reload-credits`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await refreshMe();
        setSuccessNotification("✅ Credits reloaded successfully!");
      }
    } catch {
      // silent fail
    } finally {
      setIsReloadingCredits(false);
    }
  };

  const handleOpenMasterResume = async () => {
    if (!token) {
      setShowAuthModal(true);
      return;
    }
    if (masterResume) {
      setIsCompletionModalOpen(true);
    } else {
      try {
        const res = await fetchStructuredResume();
        if (res) {
          setMasterResume(res);
          setIsCompletionModalOpen(true);
        } else {
          alert("No master resume found. Please upload your resume first!");
        }
      } catch {
        alert("Please upload your resume first!");
      }
    }
  };

  // ── Cover Letter State ───────────────────────────────────────────────────
  const [coverLetterText, setCoverLetterText] = useState<string | null>(null);
  const [coverLetterDownloadId, setCoverLetterDownloadId] = useState<string | null>(null);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [isUpdatingCoverLetter, setIsUpdatingCoverLetter] = useState(false);
  const [isEditingCoverLetter, setIsEditingCoverLetter] = useState(false);
  const [isCoverLetterCopied, setIsCoverLetterCopied] = useState(false);

  const handleCopyCoverLetterText = () => {
    if (!coverLetterText) return;
    navigator.clipboard.writeText(coverLetterText);
    setIsCoverLetterCopied(true);
    setSuccessNotification("📋 Entire Cover Letter text copied to clipboard!");
    setTimeout(() => {
      setIsCoverLetterCopied(false);
    }, 1000);
  };

  const handleGenerateCoverLetter = async () => {
    if (!token) {
      showGuestUpgradeModal("cover_letter", () => handleGenerateCoverLetter());
      return;
    }
    if (!documentId || !jobDescription) return;

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
      if (refreshMe) refreshMe();
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

  const [downloadingCoverLetterFormat, setDownloadingCoverLetterFormat] = useState<"docx" | "pdf" | null>(null);

  const handleDownloadCoverLetter = async (format: "docx" | "pdf") => {
    if (!coverLetterDownloadId) return;
    setDownloadingCoverLetterFormat(format);
    try {
      setSuccessNotification(`Exporting Cover Letter as ${format.toUpperCase()}...`);
      await downloadCoverLetterFile(coverLetterDownloadId, format);
      setSuccessNotification(`✨ Cover Letter (${format.toUpperCase()}) downloaded successfully!`);
      trackEvent("cover_letter_downloaded", { format });
    } catch (err: any) {
      console.error("Cover letter download error, attempting direct fallback:", err);
      trackError("cover_letter_download_failed", err, { format });
      try {
        const fallbackUrl = `${API_BASE_URL}/api/v1/resume/download/${coverLetterDownloadId}/cover-letter?format=${format}`;
        window.open(fallbackUrl, "_blank");
        setSuccessNotification(`Downloading Cover Letter (${format.toUpperCase()})...`);
      } catch (fallbackErr) {
        setError(err?.message || "Failed to download cover letter. Please try again.");
      }
    } finally {
      setDownloadingCoverLetterFormat(null);
    }
  };

  const handlePasteClipboardJD = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setJobDescription(text.trim());
          setSuccessNotification("📋 Target Job Description pasted from clipboard!");
          return;
        }
      }
      setSuccessNotification("Clipboard is empty. Please paste using Cmd+V or Ctrl+V.");
    } catch (err) {
      console.warn("Clipboard paste access:", err);
      setSuccessNotification("Please paste directly into the box using Cmd+V or Ctrl+V.");
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

  // ── Auto-restore Workspace State on page refresh ─────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem("rc_workspace_state");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.jobDescription) setJobDescription(parsed.jobDescription);
        if (parsed.documentId) setDocumentId(parsed.documentId);
        if (parsed.fileName) {
          const synthetic = new File([], parsed.fileName, {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          });
          setFile(synthetic);
          setBaseResumeLoaded(true);
        }
        if (parsed.analysisResult) setAnalysisResult(parsed.analysisResult);
        if (parsed.rewrittenSections && Object.keys(parsed.rewrittenSections).length > 0) {
          setRewrittenSections(parsed.rewrittenSections);
        }
        if (parsed.previousRewrittenSections) setPreviousRewrittenSections(parsed.previousRewrittenSections);
        if (parsed.downloadId) setDownloadId(parsed.downloadId);
        if (parsed.downloadUrl) setDownloadUrl(parsed.downloadUrl);
        if (parsed.isPatchingApplied !== undefined) setIsPatchingApplied(parsed.isPatchingApplied);
        if (parsed.customTargetRole) setCustomTargetRole(parsed.customTargetRole);
        if (parsed.appliedWovenKeywords) setAppliedWovenKeywords(parsed.appliedWovenKeywords);
        if (parsed.isKeywordsWoven !== undefined) setIsKeywordsWoven(parsed.isKeywordsWoven);
        if (parsed.coverLetterText) setCoverLetterText(parsed.coverLetterText);
        if (parsed.coverLetterDownloadId) setCoverLetterDownloadId(parsed.coverLetterDownloadId);
        if (parsed.activeNavTab) setActiveNavTab(parsed.activeNavTab);
        console.log("✨ [RoleCraft Persistence] Restored active workspace session from storage");
      }
    } catch (e) {
      console.warn("Failed to restore saved workspace state:", e);
    } finally {
      isRestoredRef.current = true;
    }
  }, []);

  // ── Auto-save Workspace State on state changes so refresh never loses work ─
  useEffect(() => {
    if (typeof window === "undefined" || !isRestoredRef.current) return;
    // Don't overwrite storage with empty state if no active workspace content
    if (!jobDescription && !documentId && !analysisResult && !file) {
      return;
    }
    const stateToSave = {
      documentId,
      fileName: file?.name || null,
      jobDescription,
      analysisResult,
      rewrittenSections,
      previousRewrittenSections,
      downloadId,
      downloadUrl,
      isPatchingApplied,
      customTargetRole,
      appliedWovenKeywords,
      isKeywordsWoven,
      coverLetterText,
      coverLetterDownloadId,
      activeNavTab,
    };
    try {
      sessionStorage.setItem("rc_workspace_state", JSON.stringify(stateToSave));
    } catch (e) {
      console.warn("Failed to persist workspace state:", e);
    }
  }, [
    documentId,
    file,
    jobDescription,
    analysisResult,
    rewrittenSections,
    previousRewrittenSections,
    downloadId,
    downloadUrl,
    isPatchingApplied,
    customTargetRole,
    appliedWovenKeywords,
    isKeywordsWoven,
    coverLetterText,
    coverLetterDownloadId,
    activeNavTab,
  ]);

  // Auto-load user's saved base resume when they log in (if no active file or session)
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
      }, 1000);
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
      if (refreshMe) refreshMe();
    },
    onError: (err: any) => {
      setError(err?.message || "Failed to generate rewrite. Please try again.");
      setIsRewriteModalOpen(false);
    }
  });

  const triggerInlineRewrite = async (
    sectionName: string,
    recommendations: string[],
    positioningMode?: string
  ) => {
    console.log(
      "%c 🤖 [RoleCraft Audit] Trigger Inline Rewrite Clicked ",
      "background: #059669; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { sectionName, recommendations, positioningMode, documentId }
    );
    if (!token) {
      showGuestUpgradeModal("improve_section", () => triggerInlineRewrite(sectionName, recommendations, positioningMode));
      return;
    }
    if (!documentId) return;
    setInlineLoadingSections((prev) => ({ ...prev, [sectionName]: true }));
    try {
      const { rewriteSection } = require("@/lib/api");
      const startTime = performance.now();
      let secContent: any = undefined;
      let secType: any = undefined;

      if (masterResume && masterResume.sections) {
        const matchSec = masterResume.sections.find((s: any) => {
          const sName = (s.section_title || "").toLowerCase();
          const tName = sectionName.toLowerCase();
          return sName === tName || sName.includes(tName) || tName.includes(sName) ||
            (s.section_type === "experience" && (tName.includes("experience") || tName.includes("work")));
        });
        if (matchSec) {
          secContent = matchSec.content;
          secType = matchSec.section_type;
        }
      }

      const data = await rewriteSection({
        document_id: documentId,
        section_name: sectionName,
        section_type: secType,
        section_content: secContent,
        job_description_text: jobDescription,
        recommendations: recommendations,
        positioning_mode: positioningMode,
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
      if (refreshMe) refreshMe();
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
    if (!token) {
      showGuestUpgradeModal("improve_all", () => handleImproveAllClick(sectionsToImprove));
      return;
    }
    if (!documentId || sectionsToImprove.length === 0) return;
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
    if (!token) {
      showGuestUpgradeModal("auto_tailor", () => handleAutoTailor());
      return;
    }
    if (!documentId) return;
    if (jobDescription.trim().length < 50) return;

    const abortController = new AbortController();
    autoTailorAbortControllerRef.current = abortController;

    setIsAutoTailoring(true);
    try {
      let result = analysisResult;
      if (!result) {
        console.log("🔍 [RoleCraft Audit] Triggering analyzeResume concurrently in background for non-blocking tailoring");
        analyzeResume(jobDescription, documentId || undefined)
          .then((res) => setAnalysisResult(res))
          .catch((err) => console.error("Background analysis error:", err));
      }

      // Determine sections to tailor: from analysisResult if ready, or directly from masterResume
      let baseSections: any[] = [];
      if (result && result.sections && result.sections.length > 0) {
        baseSections = result.sections;
      } else if (masterResume && masterResume.sections) {
        baseSections = masterResume.sections.map((s: any) => ({
          section_name: s.section_title,
          section_type: s.section_type,
          review_status: "improve",
          recommendations: [`Tailor ${s.section_title} for target job keywords and Google XYZ impact metrics`],
        }));
      }

      // Queue sections for 1-Click Auto-Tailor respecting user's section AI tailoring toggle preferences
      const sectionsToTailor = baseSections.filter((s: any) => {
        const norm = (s.section_name || "").toLowerCase();
        const isExplicitOff = tailoringSectionToggles[s.section_name] === false;
        const isExplicitOn = tailoringSectionToggles[s.section_name] === true;
        if (isExplicitOff) return false;
        if (isExplicitOn) return true;
        if (norm.includes("education") || norm.includes("certification") || norm.includes("header")) {
          return false;
        }
        return (s.review_status === "improve" || (s.recommendations && s.recommendations.length > 0)) && s.review_status !== "reduce_emphasis";
      });

      console.log("📋 [RoleCraft Audit] Sections queued for 1-Click Auto-Tailor:", sectionsToTailor.map((s: any) => s.section_name));

      const isHeaderExplicitOff = tailoringSectionToggles["header"] === false || tailoringSectionToggles["Target Job Title & Header"] === false;

      if (sectionsToTailor.length === 0 && isHeaderExplicitOff) {
        setSuccessNotification("All sections are locked. Open Settings next to Auto-Tailor to enable sections!");
        setIsAutoTailoring(false);
        return;
      }

      if (sectionsToTailor.length === 0 && !result?.overall_summary?.job_title && !customTargetRole) {
        setSuccessNotification("Your resume is already highly optimized for this role!");
        setIsAutoTailoring(false);
        return;
      }

      trackEvent("tailor_started", { sections_count: sectionsToTailor.length });

      // Set instant inline loading cue on all target section cards right away
      const loadingMap: Record<string, boolean> = {};
      const expandedMap: Record<string, boolean> = { ...expandedSections };
      sectionsToTailor.forEach((sec: any) => {
        loadingMap[sec.section_name] = true;
        expandedMap[sec.section_name] = true;
      });
      setInlineLoadingSections((prev) => ({ ...prev, ...loadingMap }));
      setExpandedSections(expandedMap);

      const parseJobTitleFromJD = (jdText: string): string => {
        if (!jdText) return "";
        const lines = jdText.split("\n").map((l) => l.trim()).filter(Boolean);

        // 1. Explicit label "Job Title: <Role>" or multi-line "JOB TITLE:\n<Role>"
        for (let i = 0; i < Math.min(lines.length, 15); i++) {
          const line = lines[i];
          if (/^(?:job title|title|role|position)\s*[:–-]?$/i.test(line) && lines[i + 1]) {
            const nextVal = lines[i + 1].trim();
            if (nextVal && !/^(about|description|requirements|responsibilities|summary|company|location|overview)/i.test(nextVal)) {
              return nextVal;
            }
          }
          const match = line.match(/(?:job title|title|role|position)\s*[:–-]\s*([A-Za-z0-9\s\-\/\&]{3,60})/i);
          if (match && match[1]) {
            const val = match[1].trim();
            if (val && !/^(about|description|requirements|responsibilities|summary|company|location|overview)/i.test(val)) {
              return val;
            }
          }
        }

        // 2. Line containing a role title keyword
        const roleKeywords = [
          "developer", "engineer", "architect", "manager", "lead", "designer",
          "consultant", "analyst", "specialist", "administrator", "executive",
          "fullstack", "full stack", "backend", "frontend", "devops", "sre", "scientist",
          "director", "head", "vp", "associate", "intern", "product"
        ];

        for (const line of lines.slice(0, 15)) {
          const clean = line.replace(/^#+\s*/, "").trim();
          const lower = clean.toLowerCase();
          if (
            clean.length >= 4 &&
            clean.length <= 80 &&
            !clean.includes("http") &&
            !clean.includes("@") &&
            !/^(about|description|requirements|responsibilities|summary|company|location|overview)/i.test(clean) &&
            roleKeywords.some((r) => lower.includes(r))
          ) {
            return clean;
          }
        }

        // 3. Preamble line
        for (const line of lines.slice(0, 5)) {
          const clean = line.replace(/^#+\s*/, "").trim();
          if (
            clean.length >= 4 &&
            clean.length <= 60 &&
            !clean.includes("http") &&
            !clean.includes("@") &&
            !/^(about|description|requirements|responsibilities|summary|company|location|overview)/i.test(clean)
          ) {
            return clean;
          }
        }

        return "";
      };

      const newRewrites: Record<string, string> = {};

      // 1. Apply Target Job Title to Header (if enabled)
      const targetHeaderTitle =
        customTargetRole.trim() ||
        result?.overall_summary?.job_title ||
        parseJobTitleFromJD(jobDescription) ||
        "Target Position";

      if (!isHeaderExplicitOff && targetHeaderTitle && targetHeaderTitle !== "Target Position") {
        setCustomTargetRole(targetHeaderTitle);
      }

      if (!isHeaderExplicitOff && targetHeaderTitle) {
        newRewrites["header"] = targetHeaderTitle;
      }

      // 2. Prepare fast batch items with structured memory for server-side 16-worker parallel execution
      const batchItems: any[] = sectionsToTailor.map((sec: any) => {
        let secContent: any = undefined;
        let secType: any = sec.section_type;
        if (masterResume && masterResume.sections) {
          const matchedSec = masterResume.sections.find((ms: any) => {
            const msTitle = (ms.section_title || "").toLowerCase();
            const sTitle = sec.section_name.toLowerCase();
            return msTitle === sTitle || msTitle.includes(sTitle) || sTitle.includes(msTitle) ||
              (ms.section_type === "experience" && (sTitle.includes("experience") || sTitle.includes("work")));
          });
          if (matchedSec) {
            secContent = matchedSec.content;
            secType = matchedSec.section_type;
          }
        }
        return {
          section_name: sec.section_name,
          section_type: secType,
          section_content: secContent,
          recommendations: sec.recommendations || [],
        };
      });

      // Explicitly include target job title header in batch payload if not disabled
      if (!isHeaderExplicitOff && targetHeaderTitle) {
        batchItems.unshift({
          section_name: "header",
          section_type: "header",
          section_content: targetHeaderTitle,
          recommendations: [`Set target job title designation to "${targetHeaderTitle}"`],
          user_instructions: targetHeaderTitle,
        });
      }

      const { batchRewriteSections } = require("@/lib/api");
      console.log("🚀 [RoleCraft Audit] Dispatching 16-worker Batch Parallel Tailor Request with Job Title Header:", batchItems);
      const batchRes = await batchRewriteSections({
        document_id: documentId,
        job_description_text: jobDescription,
        sections: batchItems,
      }, abortController.signal);

      if (batchRes.rewrites && Object.keys(batchRes.rewrites).length > 0) {
        const finalAppliedTitle = batchRes.rewrites["header"] || targetHeaderTitle;
        if (finalAppliedTitle) {
          newRewrites["header"] = finalAppliedTitle;
          setCustomTargetRole(finalAppliedTitle);
        }

        setRewrittenSections((prev) => ({ ...prev, header: finalAppliedTitle, ...newRewrites, ...batchRes.rewrites }));
        if (batchRes.download_id) setDownloadId(batchRes.download_id);
        if (batchRes.download_url) setDownloadUrl(batchRes.download_url);
        setIsPatchingApplied(true);

        const parts: string[] = [];
        if (result?.overall_summary?.job_title || finalAppliedTitle) parts.push("Target Role");
        if (sectionsToTailor.length > 0) parts.push(`${sectionsToTailor.length} section${sectionsToTailor.length > 1 ? "s" : ""}`);
        setSuccessNotification(`⚡ 1-Click Auto-Tailored in ~2s: Resume Ready! (${parts.join(", ")})`);
        trackEvent("tailor_completed", {
          tailored_sections_count: Object.keys(newRewrites).length,
        });

        if (refreshMe) refreshMe();
      }

      // Clear inline loading state on all section cards and close modal
      setInlineLoadingSections({});
      setIsAutoTailoring(false);

      // Trigger full structured resume AI tailoring asynchronously in background (for builder preview only)
      (async () => {
        try {
          const tailoredRes = await tailorResume({
            job_description: jobDescription,
            job_title: targetHeaderTitle,
          });
          setTailorResult(tailoredRes);
        } catch (te) {
          console.warn("[RoleCraft] Structured tailor warning:", te);
        }
      })();

      // ── Auto-generate Tailored Cover Letter asynchronously in background ──
      console.log("📝 [RoleCraft Audit] Auto-generating Tailored Cover Letter in background...");
      setIsGeneratingCoverLetter(true);
      (async () => {
        try {
          const originalMatched = (result?.top_strengths || []).map((s: any) =>
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

          const effectiveTargetRole = newRewrites["header"] || customTargetRole || result?.overall_summary?.job_title || undefined;
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
          trackEvent("cover_letter_generated");
          console.log("✨ [RoleCraft Audit] Background Cover Letter Generated:", clRes.download_id);
        } catch (clErr) {
          console.error("❌ [RoleCraft Audit] Auto Cover Letter Generation Failed:", clErr);
        } finally {
          setIsGeneratingCoverLetter(false);
        }
      })();
    } catch (err: any) {
      if (err?.name === "AbortError" || abortController.signal.aborted) {
        console.log("Auto-tailoring cancelled by user.");
        return;
      }
      console.error("❌ [RoleCraft Audit] Auto-tailor error:", err);
      trackError("tailor_failed", err);
      setError(err?.message || "Auto-tailor failed. Please try again.");
    } finally {
      setIsAutoTailoring(false);
      setInlineLoadingSections({});
      autoTailorAbortControllerRef.current = null;
    }
  };

  // ── 1-Click Auto-Everything (Analyze -> Tailor -> Download) ────────────────
  const handleOneShotTailor = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!token) {
      showGuestUpgradeModal("auto_tailor", () => handleOneShotTailor());
      return;
    }
    if (!documentId) return;
    if (jobDescription.trim().length < 50) return;

    if (user && user.credits <= 0) {
      const targetPlan = (user.plan_type || "").toLowerCase() === "pro" ? "elite" : "pro";
      openUpgradeModal("out_of_credits", targetPlan);
      return;
    }

    const abortController = new AbortController();
    autoTailorAbortControllerRef.current = abortController;

    setIsAutoTailoring(true); // Triggers the Progress Modal
    setAutoTailorStepIndex(undefined);
    setAutoTailorProgress(undefined);
    setAutoTailorComplete(false);

    try {
      let data = analysisResult;
      let newRewrites: Record<string, string> = {};
      let downloadIdResult: string | undefined = undefined;
      let downloadUrlResult: string | undefined = undefined;
      let effectiveRole = customTargetRole || analysisResult?.overall_summary?.job_title || "Target Position";

      if (data && data.sections && data.sections.length > 0) {
        // Fast path: resume already has analysis in state, so we execute 16-worker parallel batch tailoring directly!
        const baseSections = data.sections;
        const sectionsToTailor = baseSections.filter((s: any) => {
          const norm = (s.section_name || "").toLowerCase();
          if (tailoringSectionToggles[s.section_name] === false) return false;
          if (tailoringSectionToggles[s.section_name] === true) return true;
          if (norm.includes("education") || norm.includes("certification") || norm.includes("header")) return false;
          return (s.review_status === "improve" || (s.recommendations && s.recommendations.length > 0)) && s.review_status !== "reduce_emphasis";
        });

        const isHeaderExplicitOff = tailoringSectionToggles["header"] === false || tailoringSectionToggles["Target Job Title & Header"] === false;
        const targetHeaderTitle = customTargetRole.trim() || data.overall_summary?.job_title || "Target Position";

        const batchItems: any[] = sectionsToTailor.map((sec: any) => {
          let secContent: any = undefined;
          let secType: any = sec.section_type;
          if (masterResume && masterResume.sections) {
            const matchedSec = masterResume.sections.find((ms: any) => {
              const msTitle = (ms.section_title || "").toLowerCase();
              const sTitle = sec.section_name.toLowerCase();
              return msTitle === sTitle || msTitle.includes(sTitle) || sTitle.includes(msTitle) ||
                (ms.section_type === "experience" && (sTitle.includes("experience") || sTitle.includes("work")));
            });
            if (matchedSec) {
              secContent = matchedSec.content;
              secType = matchedSec.section_type;
            }
          }
          return {
            section_name: sec.section_name,
            section_type: secType,
            section_content: secContent,
            recommendations: sec.recommendations || [],
          };
        });

        if (!isHeaderExplicitOff && targetHeaderTitle && targetHeaderTitle !== "Target Position") {
          batchItems.unshift({
            section_name: "header",
            section_type: "header",
            section_content: targetHeaderTitle,
            recommendations: [`Set target job title designation to "${targetHeaderTitle}"`],
            user_instructions: targetHeaderTitle,
          });
        }

        const { batchRewriteSections } = require("@/lib/api");
        const batchRes = await batchRewriteSections({
          document_id: documentId,
          job_description_text: jobDescription,
          sections: batchItems,
        }, abortController.signal);

        newRewrites = batchRes.rewrites || {};
        downloadIdResult = batchRes.download_id;
        downloadUrlResult = batchRes.download_url;
        if (newRewrites["header"]) {
          effectiveRole = newRewrites["header"];
        }
      } else {
        // Complete end-to-end path: analysis + parallel batch tailoring + patch generation in one unified workflow
        const { autoTailorResume } = require("@/lib/api");
        const result = await autoTailorResume({
          document_id: documentId,
          job_description_text: jobDescription,
          target_role: customTargetRole || undefined,
          section_toggles: tailoringSectionToggles,
        }, abortController.signal);

        data = result.analysis;
        setAnalysisResult(data);
        newRewrites = result.rewrites || {};
        downloadIdResult = result.download_id;
        downloadUrlResult = result.download_url;
        effectiveRole = result.target_role || data?.overall_summary?.job_title || "Target Position";
      }

      // Atomically prepare all UI state together for a clean, unified reveal
      if (data) {
        const initialExpanded: Record<string, boolean> = {};
        (data.sections || []).forEach((sec: any) => {
          if (sec.review_status === "improve" || (newRewrites && newRewrites[sec.section_name])) {
            initialExpanded[sec.section_name] = true;
          }
        });
        setExpandedSections(initialExpanded);
      }

      if (effectiveRole && effectiveRole !== "Target Position") {
        setCustomTargetRole(effectiveRole);
      }

      if (newRewrites && Object.keys(newRewrites).length > 0) {
        setRewrittenSections(newRewrites);
        setIsPatchingApplied(true);
      }

      if (downloadIdResult) setDownloadId(downloadIdResult);
      if (downloadUrlResult) setDownloadUrl(downloadUrlResult);

      if (refreshMe) refreshMe();
      fetchDailyGoal().catch(() => { });

      // Signal completion to the progress modal
      setAutoTailorComplete(true);

      // Async structured tailor (builder)
      (async () => {
        try {
          const { tailorResume } = require("@/lib/structured_resume_api");
          const tailoredRes = await tailorResume({
            job_description: jobDescription,
            job_title: effectiveRole,
          });
          setTailorResult(tailoredRes);
        } catch (te) { }
      })();

      // Background cover letter
      setIsGeneratingCoverLetter(true);
      (async () => {
        try {
          const effectiveTargetRole = newRewrites?.["header"] || effectiveRole || customTargetRole || data?.overall_summary?.job_title || undefined;
          const clRes = await generateCoverLetter({
            document_id: documentId,
            job_description_text: jobDescription,
            target_role: effectiveTargetRole,
            contact_info: undefined,
            rewritten_sections: newRewrites || {},
            confirmed_matched_skills: [],
          });
          setCoverLetterText(clRes.cover_letter_text);
          setCoverLetterDownloadId(clRes.download_id);
          if (clRes.target_role) setCustomTargetRole(clRes.target_role);
        } catch (err) { }
        setIsGeneratingCoverLetter(false);
      })();

      setSuccessNotification(`⚡ 1-Click Auto-Everything Complete: Tailored Resume Ready!`);

      // Delay hiding the modal to show success state smoothly, then reveal ready results
      setTimeout(() => {
        setIsAutoTailoring(false);
        setAutoTailorComplete(false);
        autoTailorAbortControllerRef.current = null;
      }, 1400);

    } catch (err: any) {
      if (err?.name === "AbortError" || abortController.signal.aborted) {
        console.log("Auto-tailoring cancelled by user.");
        setIsAutoTailoring(false);
        setAutoTailorComplete(false);
        return;
      }
      console.error("1-Click Auto-Everything error:", err);
      setError(err?.message || "One-Click Auto-Everything failed. Please check your connection and try again.");
      setIsAutoTailoring(false);
      setAutoTailorStepIndex(undefined);
      setAutoTailorProgress(undefined);
      setAutoTailorComplete(false);
      autoTailorAbortControllerRef.current = null;
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
    // Pre-select ONLY Supported (Yellow/Green) keywords by default, excluding Red (JD-only) skills
    setSelectedKeywordsToWeave(new Set(supportedKws.map((k) => k.kw)));
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

      // Use provided keyword list (from modal) or compute supported evidence keywords ONLY (exclude Red JD-only skills)
      let missingKeywords: string[];
      if (keywordsToWeave && keywordsToWeave.length > 0) {
        missingKeywords = keywordsToWeave;
      } else {
        const evidenceKeywords = (analysisResult.sections || [])
          .flatMap((s: any) => s.strengths || [])
          .map((e: string) => cleanKeywordName(e))
          .filter((kw: string) => kw.length > 0 && kw.length <= 60);

        const matchedLower = new Set(
          (analysisResult.top_strengths || []).map((s: any) =>
            (typeof s === "string" ? cleanKeywordName(s) : cleanKeywordName(s.name)).toLowerCase()
          )
        );

        const wovenLower = new Set(appliedWovenKeywords.map((k) => k.toLowerCase().trim()));

        missingKeywords = Array.from(new Set(evidenceKeywords)).filter(
          (kw: string) => !matchedLower.has(kw.toLowerCase()) && !wovenLower.has(kw.toLowerCase())
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

  const handleImproveClick = (
    sectionName: string,
    recommendations: string[],
    positioningMode?: string
  ) => {
    console.log(
      "%c ✏️ [RoleCraft Audit] 'Improve with AI' (Modal) Clicked ",
      "background: #4f46e5; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
      { sectionName, recommendations, positioningMode, documentId }
    );
    if (!token) {
      showGuestUpgradeModal("improve_modal", () => handleImproveClick(sectionName, recommendations, positioningMode));
      return;
    }
    if (!documentId) return;
    setActiveRewriteSection(sectionName);
    const isSumm = isSummarySection(sectionName);
    const mode = positioningMode || (isSumm ? "team_lead_transition" : "default");
    setModalPositioningMode(mode);
    setRewriteData(null);
    setDraftRewrittenText("");
    const defaultInstruction = isSumm && mode !== "default"
      ? (SUMMARY_POSITIONING_PRESETS.find(p => p.id === mode)?.instruction || "")
      : "";
    setUserInstructions(defaultInstruction);
    setMetricPercentage("");
    setMetricScale("");
    setDiffModeActive(false);
    setIsRewriteModalOpen(true);
    rewriteMutation.mutate({
      document_id: documentId,
      section_name: sectionName,
      job_description_text: jobDescription,
      recommendations: recommendations,
      positioning_mode: isSumm && mode !== "default" ? mode : undefined,
      user_instructions: defaultInstruction || undefined,
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
    if (!token) {
      showGuestUpgradeModal("patch_docx", () => handleApplyRewrites());
      return;
    }
    if (!documentId) return;
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
    if (!token) {
      showGuestUpgradeModal("apply_title", () => handleApplyTargetTitle(titleToApply));
      return;
    }
    if (!documentId) return;

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
    if (!token) {
      showGuestUpgradeModal("weave_keyword", () => handleQuickWeaveKeyword(kw));
      return;
    }
    if (!analysisResult || !documentId) return;

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


  // 1. File Upload Mutation (Parallel upload + structured JSON parsing for maximum speed)
  const uploadMutation = useMutation({
    mutationFn: async (uploadFile: File) => {
      const [docUpload, structuredParse] = await Promise.all([
        uploadResume(uploadFile),
        parseAndSaveStructuredResume(uploadFile).catch((e) => {
          console.warn("[RoleCraft] Structured parse warning:", e);
          return null;
        }),
      ]);
      return { docUpload, structuredParse, uploadFile };
    },
    onSuccess: async ({ docUpload, structuredParse, uploadFile }) => {
      console.log(
        "%c 📄 [RoleCraft Audit] Parallel Upload & Parse Complete ",
        "background: #0284c7; color: #fff; font-weight: bold; border-radius: 4px; padding: 2px 6px;",
        { docUpload, structuredParse }
      );
      setDocumentId(docUpload.document_id);
      setError(null);
      setRewrittenSections({});
      setPreviousRewrittenSections({});
      setDownloadId(null);
      setDownloadUrl(null);
      setIsPatchingApplied(false);
      setSuccessNotification("Resume uploaded & parsed successfully.");
      trackEvent("resume_uploaded", {
        format: uploadFile.name.endsWith(".docx") ? "docx" : "pdf",
        filename: uploadFile.name,
      });

      if (structuredParse) {
        setMasterResume(structuredParse);
        const unparsed = structuredParse.parse_confidence?.low_confidence_fields || [];
        if (unparsed.length > 0) {
          setIsCompletionModalOpen(true);
        }
      }

      // Auto-save as base resume immediately (if logged in)
      if (token && uploadFile) {
        try {
          const resp = await fetch(`${API_BASE_URL}/api/v1/documents/set-base`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ document_id: docUpload.document_id, filename: uploadFile.name }),
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
      trackError("resume_upload_failed", err, { filename: file?.name });
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
      if (!documentId && !user?.base_resume_id) throw new Error("Please upload a resume first");
      if (jobDescription.trim().length < 50) {
        throw new Error("Job description must be at least 50 characters long");
      }
      trackEvent("analysis_started", {
        has_doc_id: Boolean(documentId),
        jd_length: jobDescription.length,
      });
      // JSON-first: pass documentId as optional (backend uses structured JSON if available)
      return analyzeResume(jobDescription, documentId || undefined);
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
      trackEvent("analysis_completed", {
        overall_score: data.overall_summary?.overall_coverage_percentage,
        sections_count: data.sections?.length,
        sections_to_improve: data.overall_summary?.sections_to_improve,
      });
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
      trackError("analysis_failed", err);
      setError(err?.message || "Analysis failed. Please check your backend connection and OpenAI API Key.");
      const errMsg = (err?.message || "").toLowerCase();
      if (
        errMsg.includes("credits") ||
        errMsg.includes("depleted") ||
        errMsg.includes("limit") ||
        errMsg.includes("upgrade")
      ) {
        trackEvent("credits_depleted_modal_shown", { source: "analysis", plan: user?.plan_type });
        if (token) {
          const targetPlan = (user?.plan_type || "").toLowerCase() === "pro" ? "elite" : "pro";
          openUpgradeModal("out_of_credits", targetPlan);
        } else {
          setShowAuthModal(true);
        }
      } else if (
        errMsg.includes("log in") ||
        errMsg.includes("sign up") ||
        errMsg.includes("auth")
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
      setGuestResumeText(null);
      setGuestMode(false);
      if (token) {
        // Authenticated: upload normally
        uploadMutation.mutate(selectedFile);
      } else {
        // Guest: extract text client-side; original binary stays in `file` for later upload
        import("@/lib/guest-analyze").then(({ extractDocxText }) => {
          extractDocxText(selectedFile)
            .then((text) => setGuestResumeText(text))
            .catch((err) => console.warn("[RoleCraft Guest] DOCX text extraction warning:", err));
        });
      }
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
      setCoverLetterText(null);
      setCoverLetterDownloadId(null);
      setIsEditingCoverLetter(false);
      setAppliedWovenKeywords([]);
      setIsKeywordsWoven(false);
      setGuestResumeText(null);
      setGuestMode(false);
      if (token) {
        uploadMutation.mutate(droppedFile);
      } else {
        import("@/lib/guest-analyze").then(({ extractDocxText }) => {
          extractDocxText(droppedFile)
            .then((text) => setGuestResumeText(text))
            .catch((err) => console.warn("[RoleCraft Guest] DOCX text extraction warning:", err));
        });
      }
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
    setInlineLoadingSections({});
    setIsAutoTailoring(false);

    if (!keepResume) {
      setFile(null);
      setDocumentId(null);
      setBaseResumeLoaded(false);
    }

    try {
      if (typeof window !== "undefined") {
        if (!keepResume) {
          sessionStorage.removeItem("rc_workspace_state");
        } else {
          // Keep resume info in storage so they don't have to re-upload
          const partial = {
            documentId: documentId,
            fileName: file?.name || null,
            jobDescription: "",
            analysisResult: null,
            rewrittenSections: {},
            previousRewrittenSections: {},
            downloadId: null,
            downloadUrl: null,
            isPatchingApplied: false,
            customTargetRole: "",
            appliedWovenKeywords: [],
            isKeywordsWoven: false,
            coverLetterText: null,
            coverLetterDownloadId: null,
            activeNavTab,
          };
          sessionStorage.setItem("rc_workspace_state", JSON.stringify(partial));
        }
      }
    } catch (e) {
      console.warn("Error updating workspace storage on reset:", e);
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

    if (jobDescription.trim().length < 50) {
      setError("Job description must be at least 50 characters long.");
      return;
    }

    // ── Guest path (no token) ─────────────────────────────────────────────
    if (!token) {
      if (!file) {
        setError("Please upload your resume first.");
        return;
      }
      if (!guestResumeText) {
        setError("Still extracting your resume — please try again in a moment.");
        return;
      }
      setIsRunningGuestAnalysis(true);
      setError(null);
      import("@/lib/guest-analyze").then(({ runGuestAnalysis }) => {
        runGuestAnalysis(guestResumeText, jobDescription)
          .then((data) => {
            setAnalysisResult(data);
            setGuestMode(true);
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
            const initialExpanded: Record<string, boolean> = {};
            (data.sections || []).forEach((sec: any) => {
              if (sec.review_status === "improve") {
                initialExpanded[sec.section_name] = true;
              }
            });
            setExpandedSections(initialExpanded);
            setSuccessNotification("Resume analysis complete! Sign in to fix it with AI.");
            if (isMobile) {
              setMobileTab("results");
              setMobileResultsTab("score");
            }
          })
          .catch((err: any) => {
            setError(err?.message || "Guest analysis failed. Please try again.");
          })
          .finally(() => setIsRunningGuestAnalysis(false));
      });
      return;
    }

    // ── Authenticated path (unchanged) ────────────────────────────────────
    if (!documentId && !user?.base_resume_id) {
      setError("Please wait for the file to finish uploading.");
      return;
    }
    // Intercept when out of credits and show upgrade paywall immediately
    if (user && user.credits <= 0) {
      const targetPlan = (user.plan_type || "").toLowerCase() === "pro" ? "elite" : "pro";
      openUpgradeModal("out_of_credits", targetPlan);
      return;
    }
    analyzeMutation.mutate();
  };


  const isAnalyzing = analyzeMutation.isPending || isRunningGuestAnalysis;
  const isUploading = uploadMutation.isPending;
  const isMobile = useIsMobile(1024);

  // ── Auto-upload original DOCX after guest signs in ────────────────────────
  // When a guest (who has analysed without auth) signs in via Google, we
  // automatically upload their original .docx binary so the patching pipeline
  // can run on the real document — preserving all fonts, margins, and layout.
  const prevTokenRef = useRef<string | null>(null);
  useEffect(() => {
    const wasGuest = guestMode && prevTokenRef.current === null && token !== null;
    prevTokenRef.current = token;

    if (wasGuest && file && token) {
      setSuccessNotification("Welcome! Uploading your resume for AI patching...");
      uploadMutation.mutate(file, {
        onSuccess: () => {
          setGuestMode(false);
          // Replay any action the user was trying to do when they hit the auth wall
          if (pendingActionAfterLoginRef.current) {
            const action = pendingActionAfterLoginRef.current;
            pendingActionAfterLoginRef.current = null;
            // Small delay so documentId state has propagated
            setTimeout(() => action(), 300);
          } else {
            setSuccessNotification("Your resume is uploaded and ready — start improving with AI!");
          }
        },
      });
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mobile / Tablet tab state (Setup / Results) ─────────────────────────
  const [mobileTab, setMobileTab] = useState<"setup" | "results">("setup");
  const [mobileResultsTab, setMobileResultsTab] = useState<"score" | "keywords" | "rewrites" | "export">("score");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Auto-switch to results tab when analyze completes
  useEffect(() => {
    if (analysisResult && isMobile) {
      setMobileTab("results");
      setMobileResultsTab("score");
    }
  }, [analysisResult, isMobile]);

  // Also switch when analysis starts (show results panel with loading state)
  useEffect(() => {
    if (isAnalyzing && isMobile) {
      setMobileTab("results");
      setMobileResultsTab("score");
    }
  }, [isAnalyzing, isMobile]);

  // ── Scroll-aware navbar glass ─────────────────────────────────────────
  const [navScrolled, setNavScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 28);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Scroll-reveal (IntersectionObserver) ─────────────────────────────
  useEffect(() => {
    const els = document.querySelectorAll(".reveal-on-scroll");
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("visible"); obs.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // ── Stat count-up when section enters view ───────────────────────────
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setStatsVisible(true); obs.disconnect(); } },
      { threshold: 0.3 }
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="relative min-h-screen text-slate-900 bg-grid p-3 sm:p-6 lg:p-12 overflow-x-hidden">
      {/* Decorative Glow Orbs — drifting AI ambient background */}
      <div className="glow-effect bg-teal-500 w-[600px] h-[600px] -top-48 -left-48 orb-drift-1" style={{ opacity: 0.14 }} />
      <div className="glow-effect bg-violet-400 w-[440px] h-[440px] top-[38%] -right-24 orb-drift-2" style={{ opacity: 0.10 }} />
      <div className="glow-effect bg-blue-400 w-[360px] h-[360px] top-[22%] right-[28%] orb-drift-3" style={{ opacity: 0.07 }} />
      <div className="glow-effect bg-[#FF6B4A] w-[300px] h-[300px] top-[70%] left-[20%] orb-drift-1" style={{ opacity: 0.06 }} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header className={`sticky top-0 z-30 max-w-full mx-auto flex items-center justify-between gap-2 mb-6 sm:mb-12 pb-4 border-b transition-all duration-300 px-3 sm:px-6 lg:px-12 -mx-3 sm:-mx-6 lg:-mx-12 ${navScrolled ? "bg-white/85 backdrop-blur-xl border-slate-200/90 shadow-sm shadow-teal-500/5" : "border-slate-200/80 bg-transparent"}`}>
        {/* Logo */}
        <div className="flex items-center gap-2.5 cursor-pointer group shrink-0" onClick={() => switchNavTab("landing")}>
          <div className="relative shrink-0 flex items-center justify-center">
            <img
              src="/logo.svg"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
              alt="RoleCraft Logo"
              className="h-9 w-9 sm:h-10 sm:w-10 object-contain transition-transform group-hover:scale-105"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-none flex items-center">
              <span className="text-[#0F172A]">Role</span>
              <span className="text-[#14B8A6]">Craft</span>
            </h1>
            <p className="hidden sm:block text-[10px] text-slate-500 font-extrabold tracking-wider uppercase truncate mt-0.5">
              TAILOR. MATCH. GET HIRED.
            </p>
          </div>
        </div>

        {/* Desktop Nav Links (landing page only) */}
        {activeNavTab === "landing" && (
          <nav className="hidden lg:flex items-center gap-0.5 text-xs font-bold text-slate-600">
            {[{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "FAQ", href: "#faq" }].map(({ label, href }) => (
              <a
                key={label}
                href={href}
                className="relative px-3.5 py-2 rounded-lg text-slate-600 hover:text-teal-700 transition-colors cursor-pointer whitespace-nowrap group/nav"
              >
                {label}
                <span className="absolute bottom-1 left-3.5 right-3.5 h-0.5 bg-gradient-to-r from-teal-500 to-[#14B8A6] rounded-full scale-x-0 group-hover/nav:scale-x-100 transition-transform origin-left duration-200" />
              </a>
            ))}
          </nav>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Resume Builder — desktop only (mobile uses bottom nav bar) */}
          <Link
            href="/resume-builder"
            className="hidden lg:flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-full text-xs font-bold bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 hover:border-teal-400 shadow-sm transition-all cursor-pointer"
            title="Create & Edit Structured Resume with ATS Templates"
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-500 shrink-0" />
            <span>Resume Builder</span>
          </Link>

          {/* Launch / Switch Workspace — desktop only (mobile uses bottom nav bar) */}
          <button
            type="button"
            onClick={() => switchNavTab(activeNavTab === "workspace" ? "landing" : "workspace")}
            className={`hidden lg:flex items-center justify-center gap-1.5 px-3.5 h-10 !rounded-full text-xs font-black transition-all cursor-pointer shadow-xs ${activeNavTab === "workspace"
              ? "bg-[#E6F7F4] hover:bg-[#ccfbf1] text-teal-900 border border-[#99F6E4] ring-1 ring-teal-500/20"
              : "btn-primary"
              }`}
          >
            <Sparkles className="h-3.5 w-3.5 text-[#FF6B4A] shrink-0" />
            <span>{activeNavTab === "workspace" ? "← Exit" : "⚡ Workspace"}</span>
          </button>

          {/* Daily Goal Quick Progress Pill in Header (ALWAYS visible when logged in) */}
          {user && dailyGoal && (
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className={`touch-target flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 h-10 rounded-full border text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-105 select-none ${dailyGoal.goal_achieved
                ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 ring-1 ring-emerald-500/20"
                : "bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border-slate-200 hover:border-teal-300"
                }`}
              title={`Daily Target: ${dailyGoal.today_completed}/${dailyGoal.daily_target} tailored (${dailyGoal.progress_percentage}%). Click to view full analytics.`}
            >
              <div className="flex items-center gap-1">
                <span className="text-xs sm:text-sm leading-none">{dailyGoal.goal_achieved ? "🎉" : "🎯"}</span>
                <span className="font-extrabold text-[11px] text-slate-900 dark:text-slate-100">
                  {dailyGoal.today_completed}/{dailyGoal.daily_target}
                </span>
                <span className="text-[10px] text-teal-600 font-bold hidden sm:inline">
                  ({dailyGoal.progress_percentage}%)
                </span>
              </div>
              <div className="w-8 sm:w-12 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden shrink-0">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${dailyGoal.goal_achieved ? "bg-emerald-500" : "bg-gradient-to-r from-teal-500 to-indigo-500"
                    }`}
                  style={{ width: `${Math.min(100, dailyGoal.progress_percentage)}%` }}
                />
              </div>
            </button>
          )}

          {/* User Auth Area */}
          {user ? (
            <div className="relative z-40">
              <button
                type="button"
                onClick={() => {
                  if (isMobile) {
                    setIsProfileMenuOpen(!isProfileMenuOpen);
                  } else {
                    setIsProfileMenuOpen(!isProfileMenuOpen);
                  }
                }}
                className="touch-target flex items-center justify-center gap-1.5 sm:gap-2 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 sm:px-3 h-10 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm text-xs transition-all cursor-pointer select-none"
              >
                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-sm">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline font-bold text-slate-800 dark:text-slate-200 max-w-[120px] truncate">
                  {user.name || user.email.split("@")[0]}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold text-[10px] border border-emerald-500/20 whitespace-nowrap">
                  {user.credits} CR
                </span>
                <ChevronDown className={`hidden sm:block h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isProfileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {/* Profile Dropdown (desktop) / Bottom Sheet (mobile) */}
              {isProfileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsProfileMenuOpen(false)}
                  />
                  {/* Mobile: bottom sheet */}
                  {isMobile ? (
                    <div className="modal-bottom-sheet" onClick={() => setIsProfileMenuOpen(false)}>
                      <div className="modal-inner" onClick={e => e.stopPropagation()}>
                        <div className="px-5 pb-5 pt-2 space-y-4">
                          {/* User Header */}
                          <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
                            <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black flex items-center justify-center text-base shadow-md shrink-0">
                              {(user.name || user.email)[0].toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900 truncate">{user.name || "User Account"}</p>
                              <p className="text-xs text-slate-500 truncate">{user.email}</p>
                            </div>
                          </div>
                          {/* Account Status */}
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-slate-500 font-medium">Plan</span>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-700 border border-teal-500/20 font-black uppercase text-[10px] tracking-wider">{user.plan_type}</span>
                                {user.plan_type === "free" && (
                                  <button onClick={() => { setIsProfileMenuOpen(false); setIsSubscriptionModalOpen(true); }} className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-[10px] transition-all cursor-pointer shadow-sm">Upgrade</button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                              <span className="text-slate-500 font-medium">Credits Available</span>
                              <span className="font-extrabold text-emerald-600">{user.credits} Credits</span>
                            </div>

                            {/* In-Page Goal Banner On/Off Switch */}
                            <div className="flex items-center justify-between p-3 rounded-xl bg-teal-50/50 border border-teal-200/60">
                              <div className="flex items-center gap-2 min-w-0">
                                <Target className="h-4 w-4 text-teal-600 shrink-0" />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 text-xs">In-Page Goal Strip</p>
                                  <p className="text-[10px] text-slate-500 truncate">Show extra progress strip on main workspace</p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={toggleDailyGoalBanner}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showDailyGoalBanner ? "bg-teal-600" : "bg-slate-300"
                                  }`}
                                role="switch"
                                aria-checked={showDailyGoalBanner}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showDailyGoalBanner ? "translate-x-4" : "translate-x-0"
                                    }`}
                                />
                              </button>
                            </div>
                          </div>
                          {/* Quick Actions */}
                          <div className="space-y-2">
                            <button type="button" onClick={() => { setIsProfileMenuOpen(false); handleOpenMasterResume(); }} className="touch-target w-full py-3 px-4 rounded-xl bg-teal-50 hover:bg-[#E6F7F4] text-teal-700 border border-teal-200 font-bold text-sm transition-all flex items-center justify-between cursor-pointer">
                              <span className="flex items-center gap-2"><Edit className="h-4 w-4 text-teal-600" /> Master Resume</span>
                              <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-200/60 text-teal-900">JSON</span>
                            </button>
                            <button type="button" onClick={() => { setIsProfileMenuOpen(false); if (!token) setShowAuthModal(true); else setIsHistoryModalOpen(true); }} className="touch-target w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-sm transition-all flex items-center justify-between cursor-pointer">
                              <span className="flex items-center gap-2"><History className="h-4 w-4 text-teal-500" /> History & Daily Goals</span>
                              {dailyGoal && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">{dailyGoal.progress_percentage}%</span>}
                            </button>
                            <button type="button" onClick={() => { setIsProfileMenuOpen(false); if (!token) setShowAuthModal(true); else setIsProfileModalOpen(true); }} className="touch-target w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-sm transition-all flex items-center justify-between cursor-pointer">
                              <span className="flex items-center gap-2"><User className="h-4 w-4 text-teal-600" /> Profile & Base Docs</span>
                              {user && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">{calculateProfileCompletion(user).totalPercentage}%</span>}
                            </button>
                            <button type="button" onClick={() => { setIsProfileMenuOpen(false); if (isProOrElite) { setIsExtensionModalOpen(true); } else { setIsExtensionPreviewModalOpen(true); } }} className="touch-target w-full py-3 px-4 rounded-xl bg-teal-50/70 hover:bg-teal-100/70 text-teal-950 border border-teal-200/80 font-bold text-sm transition-all flex items-center justify-between cursor-pointer">
                              <span className="flex flex-col items-start gap-0.5">
                                <span className="flex items-center gap-2"><Zap className="h-4 w-4 text-teal-600" /> Browser Extensions</span>
                                <span className="text-[10px] font-semibold text-teal-600 pl-6">
                                  {user?.plan_type === "elite" ? "LinkedIn, Indeed & Naukri" : "LinkedIn Job Copier"}
                                </span>
                              </span>
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-600 text-white shadow-2xs shrink-0">{isProOrElite ? "Download" : "Pro"}</span>
                            </button>
                            <button type="button" onClick={() => { setIsProfileMenuOpen(false); openIssueReport("general"); }} className="touch-target w-full py-3 px-4 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-sm transition-all flex items-center gap-2 cursor-pointer">
                              <LifeBuoy className="h-4 w-4 text-teal-600" />
                              Report an Issue / Feedback
                            </button>
                            <button type="button" onClick={() => { setIsProfileMenuOpen(false); logout(); }} className="touch-target w-full py-3.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer">
                              <LogOut className="h-4 w-4" />
                              Sign Out
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Desktop dropdown */
                    <div className="absolute right-0 mt-2 w-72 z-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 space-y-3.5 animate-fade-in-up">
                      {/* User Header */}
                      <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-black flex items-center justify-center text-sm shadow-md shadow-teal-600/30 shrink-0">
                          {(user.name || user.email)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user.name || "User Account"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                        </div>
                      </div>
                      {/* Account Status Details */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Plan</span>
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 font-black uppercase text-[10px] tracking-wider">{user.plan_type}</span>
                            {user.plan_type === "free" && (
                              <button onClick={() => { setIsProfileMenuOpen(false); setIsSubscriptionModalOpen(true); }} className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-[10px] transition-all cursor-pointer shadow-sm">Upgrade</button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                          <span className="text-slate-500 dark:text-slate-400 font-medium">Credits Available</span>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{user.credits} Credits</span>
                            {VIP_EMAILS_FE.includes(user.email?.toLowerCase()) && (
                              <button onClick={handleReloadCredits} disabled={isReloadingCredits} title="Reload VIP credits" className="px-2 py-0.5 rounded bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white font-extrabold text-[10px] transition-all cursor-pointer shadow-sm flex items-center gap-1">
                                {isReloadingCredits ? "..." : "↺ Reload"}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* In-Page Goal Strip On/Off Switch */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-teal-50/50 dark:bg-slate-800/60 border border-teal-200/60 dark:border-slate-700/60">
                          <div className="flex items-center gap-2 min-w-0">
                            <Target className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">In-Page Goal Strip</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">Show extra progress strip on main workspace</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={toggleDailyGoalBanner}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showDailyGoalBanner ? "bg-teal-600" : "bg-slate-300 dark:bg-slate-700"
                              }`}
                            role="switch"
                            aria-checked={showDailyGoalBanner}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showDailyGoalBanner ? "translate-x-4" : "translate-x-0"
                                }`}
                            />
                          </button>
                        </div>
                      </div>
                      {/* Quick Access Menu Items */}
                      <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
                        <button type="button" onClick={() => { setIsProfileMenuOpen(false); handleOpenMasterResume(); }} className="w-full py-2.5 px-3 rounded-xl bg-teal-50 dark:bg-slate-900/40 hover:bg-[#E6F7F4] dark:hover:bg-slate-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-slate-800/80 font-bold text-xs transition-all flex items-center justify-between cursor-pointer shadow-2xs">
                          <span className="flex items-center gap-2"><Edit className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" /> Master Resume</span>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-200/60 dark:bg-slate-900/80 text-teal-900 dark:text-teal-200">JSON</span>
                        </button>
                        <button type="button" onClick={() => { setIsProfileMenuOpen(false); if (!token) setShowAuthModal(true); else setIsHistoryModalOpen(true); }} className="w-full py-2.5 px-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 font-bold text-xs transition-all flex items-center justify-between cursor-pointer">
                          <span className="flex items-center gap-2"><History className="h-3.5 w-3.5 text-teal-500" /> History & Daily Goals</span>
                          {dailyGoal && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">{dailyGoal.progress_percentage}%</span>}
                        </button>
                        <button type="button" onClick={() => { setIsProfileMenuOpen(false); if (!token) setShowAuthModal(true); else setIsProfileModalOpen(true); }} className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs transition-all flex items-center justify-between cursor-pointer">
                          <span className="flex items-center gap-2"><User className="h-3.5 w-3.5 text-teal-600" /> Profile & Base Docs</span>
                          {user && <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">{calculateProfileCompletion(user).totalPercentage}%</span>}
                        </button>
                        <button type="button" onClick={() => { setIsProfileMenuOpen(false); if (isProOrElite) { setIsExtensionModalOpen(true); } else { setIsExtensionPreviewModalOpen(true); } }} className="w-full py-2.5 px-3 rounded-xl bg-teal-50/80 hover:bg-teal-100/80 text-teal-950 border border-teal-200 font-bold text-xs transition-all flex items-center justify-between cursor-pointer shadow-2xs">
                          <span className="flex flex-col items-start gap-0.5">
                            <span className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-teal-600" /> Browser Extensions</span>
                            <span className="text-[10px] font-semibold text-teal-500 pl-5">
                              {user?.plan_type === "elite" ? "LinkedIn, Indeed & Naukri" : "LinkedIn Job Copier"}
                            </span>
                          </span>
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-600 text-white shadow-2xs shrink-0">{isProOrElite ? "Download" : "Pro"}</span>
                        </button>
                        <button type="button" onClick={() => { setIsProfileMenuOpen(false); openIssueReport("general"); }} className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200 font-bold text-xs transition-all flex items-center gap-2 cursor-pointer">
                          <LifeBuoy className="h-3.5 w-3.5 text-teal-600" />
                          Report an Issue / Feedback
                        </button>
                      </div>
                      <button type="button" onClick={() => { setIsProfileMenuOpen(false); logout(); }} className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer">
                        <LogOut className="h-3.5 w-3.5" />
                        Sign Out
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 hover:border-teal-400 shadow-sm transition-all cursor-pointer"
            >
              Sign In
            </button>
          )}

          {/* Mobile Hamburger (landing page only, for nav links) */}
          {activeNavTab === "landing" && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="lg:hidden touch-target p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-all cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* ── Mobile Navigation Overlay ───────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 mobile-menu-overlay"
          style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(8px)" }}
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            className="mobile-menu-panel absolute top-0 left-0 right-0 bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
            style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          >
            {/* Menu Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <img src="/logo.svg" onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }} alt="RoleCraft" className="h-8 w-8 object-contain" />
                <span className="text-lg font-black"><span className="text-[#0F172A]">Role</span><span className="text-[#14B8A6]">Craft</span></span>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="touch-target p-2 rounded-xl hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Nav Links */}
            <div className="px-4 py-4 space-y-2">
              {[{ label: "Features", href: "#features" }, { label: "Pricing", href: "#pricing" }, { label: "FAQ", href: "#faq" }].map(({ label, href }) => (
                <a
                  key={label}
                  href={href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="touch-target flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-sm font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-700 transition-all"
                >
                  {label}
                </a>
              ))}
              <button
                type="button"
                onClick={() => { setIsMobileMenuOpen(false); switchNavTab("workspace"); }}
                className="touch-target w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold bg-teal-600 text-white cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                Launch Workspace Free
              </button>
            </div>
            {/* Safe area bottom */}
            <div style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }} />
          </div>
        </div>
      )}


      {activeNavTab === "landing" ? (
        <div className="relative max-w-[1440px] mx-auto space-y-12 sm:space-y-16 py-2 sm:py-4 animate-fade-in">
          {/* Prominent Daily Goal Focus Card on Landing (when logged in & enabled) */}
          {user && dailyGoal && showDailyGoalBanner && (
            <DailyGoalCard
              dailyGoal={dailyGoal}
              onUpdateTarget={handleQuickUpdateTarget}
              isUpdatingTarget={isUpdatingDailyTarget}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
              onHide={toggleDailyGoalBanner}
            />
          )}

          {/* HERO 2-COLUMN SECTION */}
          <section className="space-y-12 pt-2 pb-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
              {/* Left Column: Headline & Action CTAs */}
              <div className="lg:col-span-6 space-y-6 lg:space-y-7 text-left">
                <div className="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50/90 border border-teal-200/80 text-teal-700 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider shadow-2xs overflow-hidden">
                  <span className="absolute inset-0 ai-badge-shimmer pointer-events-none" />
                  <Sparkles className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
                  <span>Built for Indian professionals switching companies</span>
                </div>

                <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
                  Tailor Your Resume<br />
                  to Any Role in{" "}
                  <span className="bg-gradient-to-r from-teal-500 via-cyan-500 to-violet-500 bg-clip-text text-transparent" style={{ backgroundSize: "200% auto", animation: "shimmer-text 4s linear infinite" }}>1&#8209;Click</span>
                </h1>

                <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
                  Paste any job description. RoleCraft rewrites only the right sections of your resume — keywords, tone, relevance — without touching your formatting.
                </p>

                <div className="flex flex-wrap items-center gap-3.5 pt-2">
                  <button
                    onClick={() => switchNavTab("workspace")}
                    className="px-7 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-sm shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Zap className="h-4 w-4 text-amber-300" />
                    <span>Tailor My Resume Free →</span>
                  </button>
                  <a
                    href="#how-it-works"
                    className="px-5 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer hover:border-slate-300"
                  >
                    <span>See How It Works</span>
                    <span className="text-[10px] text-slate-700">▶</span>
                  </a>
                </div>
                {/* Hero Social Proof */}
                <div className="flex flex-col gap-2 pt-1">
                  {/* Avatar stack + stars row */}
                  <div className="flex items-center gap-3">
                    {/* Stacked Avatars */}
                    <div className="flex -space-x-2.5">
                      {[
                        { initials: "RS", from: "#0F172A", to: "#14B8A6" },
                        { initials: "PN", from: "#4F46E5", to: "#7C3AED" },
                        { initials: "AV", from: "#0EA5E9", to: "#06B6D4" },
                        { initials: "KM", from: "#0F766E", to: "#059669" },
                      ].map((u, idx) => (
                        <div
                          key={idx}
                          className="h-7 w-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                          style={{ background: `linear-gradient(135deg, ${u.from}, ${u.to})` }}
                        >
                          {u.initials}
                        </div>
                      ))}
                    </div>
                    {/* Stars + score */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className="text-xs font-extrabold text-slate-800">4.9</span>
                      <span className="text-xs text-slate-400 font-medium">from early adopters</span>
                    </div>
                  </div>
                  {/* Mini pull-quote */}
                  <p className="text-xs text-slate-500 font-medium italic pl-0.5">
                    <span className="text-teal-600 font-black not-italic">"</span>
                    Got 4 interview callbacks in my first week.
                    <span className="text-teal-600 font-black not-italic">"</span>
                    <span className="text-slate-400 not-italic font-semibold ml-1.5">— Rohan S., SWE</span>
                  </p>
                </div>
              </div>

              {/* Mobile-only compact preview — visible only on small screens */}
              <div className="lg:hidden mt-4 rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-white p-4 flex items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resume Match</p>
                  <p className="text-xs text-slate-600 font-medium">Rahul Sharma → Senior SWE @ Swiggy</p>
                  <div className="flex gap-2 flex-wrap pt-1">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">✓ Keywords updated</span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">✓ Summary rewritten</span>
                    <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">✓ Format preserved</span>
                  </div>
                </div>
                <div className="shrink-0 text-center">
                  <div className="text-3xl font-black text-emerald-600">98%</div>
                  <div className="text-[10px] font-bold text-slate-400">Match</div>
                </div>
              </div>

              {/* Right Column: Interactive Floating Resume Preview & ATS Score Overlay — desktop only */}
              <div className="hidden lg:block lg:col-span-6 relative">
                {/* Background Ambient Glows */}
                <div className="absolute -top-12 -right-12 w-72 h-72 bg-gradient-to-br from-blue-400/20 to-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-gradient-to-tr from-indigo-400/15 to-blue-400/15 rounded-full blur-3xl pointer-events-none" />

                {/* Main Resume Window Container */}
                <div className="relative rounded-3xl bg-white/95 border border-slate-200 shadow-2xl p-5 sm:p-7 backdrop-blur-md transition-all hover:shadow-teal-500/10">

                  {/* Internal Layout: Left Mini Tool Rail + Paper Content */}
                  <div className="flex items-start gap-4">
                    {/* Left Mini Icon Rail */}
                    <div className="hidden sm:flex flex-col items-center gap-3.5 pt-1 text-slate-400 border-r border-slate-100 pr-3.5 shrink-0 select-none">
                      <div className="h-6 w-6 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <SlidersHorizontal className="h-3.5 w-3.5 hover:text-teal-600 transition-colors" />
                      <Eye className="h-3.5 w-3.5 hover:text-teal-600 transition-colors" />
                      <Code className="h-3.5 w-3.5 hover:text-teal-600 transition-colors" />
                      <FileText className="h-3.5 w-3.5 hover:text-teal-600 transition-colors" />
                      <Copy className="h-3.5 w-3.5 hover:text-teal-600 transition-colors" />
                      <Download className="h-3.5 w-3.5 hover:text-teal-600 transition-colors" />
                      <Scissors className="h-3.5 w-3.5 hover:text-teal-600 transition-colors" />
                    </div>

                    {/* Resume Paper Content */}
                    <div className="flex-1 space-y-3.5 text-left text-slate-800 pr-0 sm:pr-24">
                      {/* Candidate Header */}
                      <div className="space-y-0.5">
                        <h3 className="text-base font-black text-slate-900">Rahul Sharma</h3>
                        <p className="text-[11px] font-semibold text-slate-500">Software Engineer, 4 yrs exp</p>
                        <p className="text-[10px] text-slate-400 font-medium pt-0.5 flex flex-wrap gap-2">
                          <span>✉ rahul.sharma@email.com</span>
                          <span>•</span>
                          <span>📱 +91 98765 43210</span>
                          <span>•</span>
                          <span>📍 Bengaluru, India</span>
                        </p>
                      </div>

                      {/* Section: Professional Summary */}
                      <div className="space-y-1 pt-1 border-t border-slate-100">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">Professional Summary</span>
                        <p className="text-[10px] text-slate-500 leading-relaxed">
                          Accomplished Full Stack Developer with 7+ years of experience architecting resilient distributed cloud systems and AI-powered workflow automation.
                        </p>
                      </div>

                      {/* Section: Technical Skills */}
                      <div className="space-y-1 pt-1 border-t border-slate-100">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">Technical Skills</span>
                        <div className="text-[10px] space-y-0.5 text-slate-600 font-medium">
                          <div><strong className="text-slate-800">Languages:</strong> JavaScript, TypeScript, Python, Java, SQL</div>
                          <div><strong className="text-slate-800">Frameworks:</strong> React, Next.js, Node.js, Express, Django</div>
                          <div><strong className="text-slate-800">Databases:</strong> PostgreSQL, MongoDB, MySQL</div>
                          <div><strong className="text-slate-800">Tools:</strong> Docker, Kubernetes, AWS, Git, CI/CD</div>
                        </div>
                      </div>

                      {/* Section: Professional Experience */}
                      <div className="space-y-1 pt-1 border-t border-slate-100">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-black text-slate-800">Senior Full Stack Developer</span>
                          <span className="text-slate-400 text-[9px]">Jan 2022 – Present</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium">Tech Solutions Inc.</p>
                        <ul className="text-[10px] text-slate-500 space-y-0.5 list-disc list-inside">
                          <li>Engineered real-time document transformation pipelines reducing latency by 45%.</li>
                          <li>Mentored cross-functional engineering teams across frontend and backend services.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Floating ATS Match Score Badge Overlay */}
                  <div className="absolute top-4 right-4 sm:-right-4 w-48 sm:w-52 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xl space-y-2.5 z-20 animate-fade-in-up">
                    <div>
                      <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ATS Match Score</div>
                      <div className="flex items-baseline justify-between pt-0.5">
                        <span className="text-3xl font-black text-emerald-600 tracking-tight">98%</span>
                        <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Excellent Match
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-slate-100 text-[10px] font-semibold text-slate-600">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          Keywords Matched
                        </span>
                        <span className="font-extrabold text-slate-800">32/32</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          Skills Alignment
                        </span>
                        <span className="font-extrabold text-slate-800">98%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          Format Preserved
                        </span>
                        <span className="font-extrabold text-slate-800">100%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                          Content Quality
                        </span>
                        <span className="font-extrabold text-emerald-600">Excellent</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            {/* Live Trust Metrics Row (4 Colored Icon Tiles with AI glow orbs) */}
            <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              {/* Card 1: Teal */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center gap-3.5 hover:shadow-lg hover:shadow-teal-500/10 hover:border-teal-200 transition-all glass-card-interactive">
                <div className="ai-icon-wrap glow-teal shrink-0">
                  <div className="h-11 w-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-500/30">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                </div>
                <div className="text-left">
                  <div className={`text-2xl font-black text-slate-900 leading-tight ${statsVisible ? "stat-number-in" : "opacity-0"}`}>60 sec</div>
                  <div className="text-xs font-semibold text-slate-500">To tailor your resume per job</div>
                </div>
              </div>

              {/* Card 2: Purple */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center gap-3.5 hover:shadow-lg hover:shadow-violet-500/10 hover:border-violet-200 transition-all glass-card-interactive">
                <div className="ai-icon-wrap glow-purple shrink-0">
                  <div className="h-11 w-11 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md shadow-violet-500/30">
                    <Phone className="h-5 w-5" />
                  </div>
                </div>
                <div className="text-left">
                  <div className={`text-2xl font-black text-slate-900 leading-tight ${statsVisible ? "stat-number-in" : "opacity-0"}`} style={{ animationDelay: "0.12s" }}>0 hrs</div>
                  <div className="text-xs font-semibold text-slate-500">Wasted rewriting manually</div>
                </div>
              </div>

              {/* Card 3: Blue */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center gap-3.5 hover:shadow-lg hover:shadow-blue-500/10 hover:border-blue-200 transition-all glass-card-interactive">
                <div className="ai-icon-wrap glow-blue shrink-0">
                  <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30">
                    <Zap className="h-5 w-5" />
                  </div>
                </div>
                <div className="text-left">
                  <div className={`text-2xl font-black text-slate-900 leading-tight ${statsVisible ? "stat-number-in" : "opacity-0"}`} style={{ animationDelay: "0.22s" }}>&lt;15s</div>
                  <div className="text-xs font-semibold text-slate-500">Full 1-Click Tailor</div>
                </div>
              </div>

              {/* Card 4: Coral */}
              <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center gap-3.5 hover:shadow-lg hover:shadow-orange-500/10 hover:border-orange-200 transition-all glass-card-interactive">
                <div className="ai-icon-wrap glow-coral shrink-0">
                  <div className="h-11 w-11 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30">
                    <Shield className="h-5 w-5" />
                  </div>
                </div>
                <div className="text-left">
                  <div className={`text-2xl font-black text-slate-900 leading-tight ${statsVisible ? "stat-number-in" : "opacity-0"}`} style={{ animationDelay: "0.32s" }}>100%</div>
                  <div className="text-xs font-semibold text-slate-500">DOCX Layout Integrity</div>
                </div>
              </div>
            </div>
          </section>

          {/* FOUNDER STORY + WHO IS THIS FOR */}
          <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 reveal-on-scroll">
            {/* Founder Story */}
            <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-white p-7 flex flex-col justify-between space-y-5 shadow-sm">
              <div className="space-y-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-teal-600">Why I Built This</span>
                <p className="text-base sm:text-lg font-semibold text-slate-800 leading-relaxed">
                  &ldquo;I was applying to jobs and spending 2+ hours rewriting my resume for every application. If I sent the same resume everywhere, I heard nothing back. So I built RoleCraft — paste the job description and it updates your resume in under 60 seconds, without touching the formatting.&rdquo;
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-sm shrink-0">A</div>
                <div>
                  <div className="text-sm font-bold text-slate-900">Ahbar</div>
                  <div className="text-xs text-slate-500">Founder, RoleCraft</div>
                </div>
              </div>
            </div>

            {/* Who Is This For */}
            <div className="rounded-3xl border border-slate-200 bg-white p-7 space-y-5 shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Who Is This For?</span>
                <h3 className="text-lg font-black text-slate-900">RoleCraft is built for you if&hellip;</h3>
              </div>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                  <span className="text-sm text-slate-700 font-medium">You have 2–10+ years of experience and are switching companies</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                  <span className="text-sm text-slate-700 font-medium">You're applying to 5+ jobs a week and can't manually rewrite your resume each time</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                  <span className="text-sm text-slate-700 font-medium">You've sent 50 applications and gotten 2 callbacks — and you know your resume is the problem</span>
                </li>
              </ul>
            </div>
          </section>

          {/* HOW IT WORKS SECTION */}
          <section id="how-it-works" className="space-y-8 scroll-mt-24">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="section-eyebrow">
                <Sparkles className="h-3 w-3 text-teal-600" />
                <span>Simple. Fast. Effective.</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                How RoleCraft Works in 3 Simple Steps
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                No manual retyping. No broken Word formatting. Instant tailored results.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {/* Step 1: Upload Base Resume */}
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-xl hover:shadow-teal-500/10 hover:border-teal-200 transition-all flex flex-col justify-between space-y-6 relative overflow-hidden group glass-card-interactive reveal-on-scroll">
                {/* Step card top accent line */}
                <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-teal-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-[#E6F7F4] border border-[#99F6E4] text-teal-800 font-black text-xs">
                      Step 01
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Input Stage
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#0F172A] group-hover:text-teal-700 transition-colors">
                      Upload Base Resume
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                      Upload your existing Word (.docx) or PDF resume. RoleCraft parses low-level XML tags to map fonts, tables, and styles.
                    </p>
                  </div>
                </div>

                {/* Mini Mockup 1: DOCX XML Parser */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs font-sans">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-teal-600" />
                      resume_base.docx
                    </span>
                    <span className="text-emerald-600 font-bold">100% Parsed</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200/60 font-mono text-[10px] text-slate-500 flex items-center justify-between">
                    <span>&lt;w:pPr&gt; Calibri 11pt</span>
                    <span className="text-teal-700 font-bold">0 XML Drift</span>
                  </div>
                </div>
              </div>

              {/* Step 2: Paste Job Description */}
              <div className="rounded-3xl border border-teal-300/60 bg-white p-6 shadow-md shadow-teal-500/10 hover:shadow-xl hover:shadow-teal-500/15 hover:border-teal-400 transition-all flex flex-col justify-between space-y-6 relative overflow-hidden group glass-card-interactive reveal-on-scroll reveal-delay-1">
                {/* Active AI card accent — this is the AI step */}
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-400 via-cyan-400 to-violet-400" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-[#E6F7F4] border border-[#99F6E4] text-teal-800 font-black text-xs">
                      Step 02
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      AI Audit
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#0F172A] group-hover:text-teal-700 transition-colors">
                      Extract Competencies
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                      Paste the target job description. The AI extracts core requirements, priority ATS keywords, and missing gaps.
                    </p>
                  </div>
                </div>

                {/* Mini Mockup 2: Keyword Cloud */}
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700">
                    <span>Detected ATS Targets</span>
                    <span className="text-teal-700 font-bold">98% Fit</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold">
                      + Cloud Arch
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                      + Distributed Systems
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#FFF1EE] text-[#FF6B4A] border border-[#FFCFC4] text-[10px] font-bold">
                      + CI/CD
                    </span>
                  </div>
                </div>
              </div>

              {/* Step 3: 1-Click Auto-Tailor */}
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm hover:shadow-xl hover:shadow-teal-500/10 hover:border-teal-200 transition-all flex flex-col justify-between space-y-6 relative overflow-hidden group glass-card-interactive reveal-on-scroll reveal-delay-2">
                <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-violet-400 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-full bg-[#E6F7F4] border border-[#99F6E4] text-teal-800 font-black text-xs">
                      Step 03
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Export
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#0F172A] group-hover:text-teal-700 transition-colors">
                      1-Click Tailor &amp; Download
                    </h3>
                    <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                      Click &quot;Auto-Tailor&quot; to update your resume sections to match the job description and download the file instantly.
                    </p>
                  </div>
                </div>

                {/* Mini Mockup 3: Tailored File Ready */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50/60 border border-teal-200 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-extrabold text-teal-900">
                    <span className="flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-[#FF6B4A]" />
                      Tailoring Complete
                    </span>
                    <span className="text-emerald-700 font-bold">&lt; 15s</span>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] font-mono text-slate-600">tailored_resume.docx</span>
                    <span className="px-2 py-0.5 rounded-md bg-teal-600 text-white font-extrabold text-[10px] shadow-2xs">
                      Ready
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* KEY CAPABILITIES */}
          <section id="features" className="space-y-8 scroll-mt-24">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                Everything You Need to Get More Interviews
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                Simple tools that do the hard work of tailoring your resume, so you don't have to.
              </p>
            </div>
            <FeaturesShowcase />
          </section>

          {/* RECRUITER STATS & TESTIMONIALS */}
          <section className="space-y-8">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
                What People Are Saying
              </h2>
              <p className="text-sm sm:text-base text-slate-600 font-medium">
                Early feedback from professionals who tried RoleCraft.
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
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-teal-200 transition-all flex flex-col justify-between space-y-6 glass-card-interactive">
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Free Tier</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-slate-900">₹0</span>
                    <span className="text-xs text-slate-400 font-semibold">/ forever</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-slate-600 font-medium pt-4 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span><strong className="text-slate-800">{FREE_TIER_CREDITS} Credits</strong> / Month</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Standard AI Resume Analysis</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Basic Keyword Matching</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-400 opacity-60">
                      <X className="h-4 w-4 text-slate-300 shrink-0" />
                      <span className="line-through">LinkedIn 1-Click Chrome Extension</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => switchNavTab("workspace")}
                  className="w-full py-3 rounded-xl bg-[#E6F7F4] hover:bg-[#ccfbf1] text-teal-900 font-bold text-xs transition-all cursor-pointer border border-[#99F6E4]"
                >
                  Start Free
                </button>
              </div>

              {/* Pro Plan Card — Featured */}
              <div className="pricing-popular rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 relative">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-teal-600 to-teal-500 text-white font-extrabold text-[10px] uppercase tracking-widest shadow-lg shadow-teal-500/30 whitespace-nowrap">
                  ✦ Most Popular
                </div>
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase text-teal-700 tracking-widest">Pro Plan</span>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-4xl font-black text-slate-900">₹399</span>
                    <span className="text-xs text-slate-500 font-semibold">/ month</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">⚡ One-time 30-day pass available</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-slate-700 font-medium pt-4 border-t border-teal-200/60">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span><strong className="text-slate-900">{PRO_CREDITS} Credits</strong> / Month</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>1-Click Full Resume Auto-Tailor</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>AI-powered bullet point rewriter</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>100% DOCX &amp; PDF Downloads</span>
                    </li>
                    <li className="flex items-center gap-2 text-teal-950 font-bold bg-teal-50/90 -mx-2 px-2 py-1.5 rounded-lg border border-teal-200/80 shadow-2xs">
                      <Sparkles className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>✦ LinkedIn 1-Click Copier Extension</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => setIsSubscriptionModalOpen(true)}
                  className="w-full py-3.5 rounded-xl btn-primary text-xs cursor-pointer"
                >
                  Upgrade to Pro Plan
                </button>
              </div>

              {/* Elite Plan Card */}
              <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm hover:shadow-md hover:border-teal-200 transition-all flex flex-col justify-between space-y-6 glass-card-interactive">
                <div className="space-y-4">
                  <span className="text-xs font-black uppercase text-teal-700 tracking-widest">Elite Plan</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black text-slate-900">₹599</span>
                    <span className="text-xs text-slate-400 line-through">₹3,000</span>
                    <span className="text-xs text-slate-500 font-semibold">/ month</span>
                  </div>
                  <ul className="space-y-2.5 text-xs text-slate-600 font-medium pt-4 border-t border-slate-100">
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span><strong className="text-slate-900">{ELITE_CREDITS} Credits</strong> / Month</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Everything in Pro Plan</span>
                    </li>
                    <li className="flex items-center gap-2 text-teal-950 font-bold bg-teal-50/90 -mx-2 px-2 py-1.5 rounded-lg border border-teal-200/80 shadow-2xs">
                      <Sparkles className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>✦ LinkedIn, Indeed &amp; Naukri Copier Extensions</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                      <span>Priority Support &amp; Maximum Capacity</span>
                    </li>
                  </ul>
                </div>
                <button
                  onClick={() => setIsSubscriptionModalOpen(true)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0F172A] via-teal-800 to-[#14B8A6] hover:from-slate-800 hover:to-teal-600 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                >
                  Upgrade to Elite Plan
                </button>
              </div>
            </div>
          </section>

          {/* HIGH-IMPACT FINAL CTA BANNER — dark gradient with AI orbs */}
          <section className="relative overflow-hidden rounded-3xl p-8 sm:p-14 cta-dark shadow-2xl shadow-teal-900/40 max-w-5xl mx-auto text-center space-y-6 reveal-on-scroll">
            {/* Vivid AI glow orbs */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/25 rounded-full blur-3xl pointer-events-none orb-drift-2" />
            <div className="absolute bottom-0 left-0 w-72 h-72 bg-violet-500/20 rounded-full blur-3xl pointer-events-none orb-drift-3" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 space-y-3 max-w-2xl mx-auto">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-teal-300 text-[11px] font-black uppercase tracking-wider backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5 text-[#FF6B4A]" />
                <span>Start In 15 Seconds</span>
              </span>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
                Stop Sending the Same Resume to Every Job
              </h2>
              <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
                Join professionals across India tailoring smarter. Upload your resume and try it free in under a minute.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => switchNavTab("workspace")}
                className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-black text-sm shadow-2xl shadow-teal-500/40 hover:shadow-teal-400/50 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Sparkles className="h-4 w-4 text-white" />
                <span>⚡ Tailor My Resume Free</span>
              </button>
              <Link
                href="/resume-builder"
                className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-sm border border-white/20 backdrop-blur-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Open Resume Builder</span>
              </Link>
            </div>

            <div className="relative z-10 flex items-center justify-center gap-6 text-xs text-slate-400 font-semibold pt-2 flex-wrap">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-teal-400" /> No Credit Card Required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-teal-400" /> 100% DOCX Format Match
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-teal-400" /> Instant PDF &amp; Word Export
              </span>
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
          <footer className="pt-12 pb-8 text-center space-y-6">
            <div className="gradient-divider mb-8" />
            <div className="flex items-center justify-center gap-3">
              <div className="relative flex items-center justify-center">
                <img
                  src="/logo.svg"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                  alt="RoleCraft Logo"
                  className="h-9 w-9 object-contain"
                />
              </div>
              <span className="text-lg font-black text-gradient">RoleCraft</span>
            </div>
            <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
              Craft every resume for the role. Recruiter-grade AI tailoring with 100% visual DOCX formatting preservation.
            </p>
            <div className="flex items-center justify-center gap-6 text-xs font-semibold text-slate-500 flex-wrap">
              <a href="#how-it-works" onClick={() => switchNavTab("landing")} className="hover:text-teal-600 transition-colors">How It Works</a>
              <Link href="/guide" className="hover:text-teal-600 transition-colors font-bold text-teal-700">Official Guide</Link>
              <a href="#features" onClick={() => switchNavTab("landing")} className="hover:text-teal-600 transition-colors">Features</a>
              <a href="#pricing" onClick={() => switchNavTab("landing")} className="hover:text-teal-600 transition-colors">Pricing</a>
              <button onClick={() => switchNavTab("workspace")} className="hover:text-teal-600 transition-colors cursor-pointer">Workspace</button>
              <button onClick={() => openIssueReport("general")} className="hover:text-teal-600 transition-colors cursor-pointer flex items-center gap-1">
                <LifeBuoy className="h-3 w-3" />
                <span>Report Issue / Feedback</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 font-medium pt-2">
              © 2026 RoleCraft Inc. All rights reserved. Built for job seekers worldwide.
            </p>
          </footer>
        </div>
      ) : (
        /* Main Workspace Container */
        <main className="relative max-w-[1440px] mx-auto animate-fade-in-up space-y-5 has-mobile-nav">
          {/* Prominent Daily Goal Focus Card in Workspace (when logged in & enabled) */}
          {user && dailyGoal && showDailyGoalBanner && (
            <DailyGoalCard
              dailyGoal={dailyGoal}
              onUpdateTarget={handleQuickUpdateTarget}
              isUpdatingTarget={isUpdatingDailyTarget}
              onOpenHistory={() => setIsHistoryModalOpen(true)}
              onHide={toggleDailyGoalBanner}
            />
          )}

          {/* Mobile Tab Bar */}
          <div className="lg:hidden mobile-tab-bar mb-4 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
            <button
              className={mobileTab === "setup" ? "active" : ""}
              onClick={() => setMobileTab("setup")}
            >
              📋 Setup
            </button>
            <button
              className={mobileTab === "results" ? "active" : ""}
              onClick={() => setMobileTab("results")}
            >
              📊 Results {analysisResult ? `· ${Math.round(analysisResult.overall_summary?.overall_coverage_percentage ?? 0)}%` : ""}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Form Panel */}
            <div className={`lg:col-span-4 space-y-6 animate-fade-in-up ${mobileTab !== "setup" ? "hidden lg:block" : "block"}`} style={{ animationDelay: "0.1s" }}>
              <form onSubmit={handleAnalyze} className="glass-panel rounded-2xl p-6 space-y-6">
                <h2 className="text-lg font-bold text-slate-800 border-b border-teal-100 pb-3 flex items-center gap-2">
                  <Layers className="h-5 w-5 text-teal-500" />
                  Configure Analysis
                </h2>

                {/* Resume Upload Box */}
                <div className={`space-y-2 p-4 rounded-xl transition-all ${onboardingStep === 1 ? 'bg-teal-50/50 border border-teal-200 ring-2 ring-teal-500/20 shadow-md' : ''}`}>
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                    <span className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] text-white ${onboardingStep >= 1 ? 'bg-teal-600' : 'bg-slate-300'}`}>1</span>
                    Upload Resume (DOCX only)
                  </label>

                  {!file ? (
                    <div
                      onDragOver={handleDragOver}
                      onDrop={handleDrop}
                      className="relative group cursor-pointer border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-teal-500/50 rounded-xl p-6 sm:p-8 text-center bg-slate-100/30 dark:bg-slate-900/30 hover:bg-slate-200/40 dark:hover:bg-slate-900/50 transition-all duration-300 min-h-[140px] flex flex-col items-center justify-center"
                    >
                      <input
                        type="file"
                        title=""
                        accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <UploadCloud className="h-10 w-10 text-slate-400 dark:text-slate-500 group-hover:text-teal-500 dark:group-hover:text-teal-400 mx-auto mb-3 transition-colors" />
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        <span className="hidden sm:inline">Drag &amp; drop or click to upload</span>
                        <span className="sm:hidden">Tap to upload resume</span>
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Word (.docx) &amp; PDF (.pdf) up to 5MB
                      </p>
                    </div>
                  ) : isUploading ? (
                    <div className="relative overflow-hidden p-5 rounded-2xl bg-white border border-teal-200/90 shadow-md shadow-teal-500/5 space-y-4 text-slate-800">
                      {/* Ambient Glow Background Effect */}
                      <div className="absolute -top-10 -right-10 w-36 h-36 bg-gradient-to-br from-blue-500/10 via-indigo-500/10 to-emerald-500/10 rounded-full blur-2xl animate-pulse pointer-events-none" />
                      <div className="absolute -bottom-10 -left-10 w-36 h-36 bg-gradient-to-tr from-purple-500/10 via-indigo-500/10 to-teal-500/10 rounded-full blur-2xl animate-pulse pointer-events-none" />

                      {/* Header & Stage Chip */}
                      <div className="flex items-start justify-between gap-3 relative z-10">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-md shadow-teal-500/20 ring-2 ring-teal-400/20">
                            <Sparkles className="h-5 w-5 text-white animate-spin" />
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-black tracking-tight text-slate-900 flex items-center gap-2">
                              <span>AI Resume Extraction</span>
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium truncate max-w-[170px]" title={file.name}>
                              {file.name}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-[10px] font-extrabold text-teal-700 uppercase tracking-wider shrink-0 shadow-2xs animate-pulse">
                          <div className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-ping shrink-0" />
                          <span>Parsing Resume</span>
                        </div>
                      </div>

                      {/* Animated Shimmer Bar with Glowing Leading Beam */}
                      <div className="space-y-1.5 relative z-10">
                        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-0.5 border border-slate-200 shadow-inner">
                          <div className="bg-gradient-to-r from-blue-600 via-indigo-500 to-teal-500 h-full rounded-full animate-pulse w-5/6 relative overflow-hidden shadow-xs">
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" />
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                          <span>Extracting text, skills & experience</span>
                          <span className="text-teal-600 font-extrabold">Processing...</span>
                        </div>
                      </div>

                      {/* AI Pipeline Step Indicator Badges */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-100 relative z-10">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg">
                          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
                          <span className="truncate">DOCX Text</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 bg-teal-50 border border-teal-200 px-2 py-1 rounded-lg animate-pulse">
                          <Cpu className="h-3 w-3 shrink-0 text-teal-600 animate-spin" />
                          <span className="truncate">Roles & Skills</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-1 rounded-lg">
                          <Sparkles className="h-3 w-3 shrink-0 text-slate-400" />
                          <span className="truncate">Master JSON</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3.5 bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-9 w-9 rounded-lg bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shrink-0">
                            <WordLogoIcon className="h-5 w-5 shrink-0 shadow-sm" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate" title={file.name}>
                              {file.name}
                            </p>
                            {file.size > 0 ? (
                              <p className="text-[11px] text-slate-400 dark:text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
                            ) : (
                              <p className="text-[11px] text-teal-500 dark:text-teal-400 font-medium">
                                Base Resume
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={handleOpenMasterResume}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-teal-50 hover:bg-[#E6F7F4] dark:bg-slate-900/50 dark:hover:bg-slate-900/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-slate-800 transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            title="View & Edit Master Resume Fields"
                          >
                            <Edit className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                          {documentId || (!token && file && guestResumeText) ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                              <CheckCircle className="h-3.5 w-3.5" />
                              Ready
                            </span>
                          ) : !token && file && !guestResumeText ? (
                            <span className="text-xs text-teal-600 dark:text-teal-400 flex items-center gap-1 font-medium">
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              Preparing...
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
                          accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <span className="text-xs text-teal-500 dark:text-teal-400 hover:underline group-hover:text-teal-600 transition-colors">
                          ↑ Upload a different resume for this session
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Pre-Analysis Section AI Tailoring Controls Box (on parsed content before analyze) */}
                {masterResume && masterResume.sections && masterResume.sections.length > 0 && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/70 via-indigo-50/40 to-white border border-teal-200/80 text-slate-800 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between border-b border-teal-200/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <SlidersHorizontal className="h-4 w-4 text-teal-600" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                          Pre-Analysis AI Section Controls
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleOpenMasterResume}
                        className="text-[10px] font-extrabold text-teal-700 hover:text-teal-900 bg-white hover:bg-teal-50/80 border border-teal-200 px-2 py-0.5 rounded-md transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                      >
                        <Edit className="h-3 w-3" />
                        <span>Edit Master</span>
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {masterResume.sections.map((sec, secIdx) => {
                        const isEnabled = tailoringSectionToggles[sec.section_title] !== undefined
                          ? tailoringSectionToggles[sec.section_title]
                          : sec.visible !== false && !(sec.section_title.toLowerCase().includes("education") || sec.section_title.toLowerCase().includes("certification"));

                        return (
                          <button
                            key={`${sec.section_title}-${secIdx}`}
                            type="button"
                            onClick={() => handleToggleSectionTailoring(sec.section_title)}
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border select-none ${isEnabled
                              ? "bg-teal-600 text-white border-teal-500 shadow-xs hover:bg-teal-500"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                              }`}
                            title={isEnabled ? `AI Tailoring ENABLED for ${sec.section_title}. Click to Lock/Disable.` : `AI Tailoring DISABLED for ${sec.section_title}. Click to Enable.`}
                          >
                            {isEnabled ? (
                              <>
                                <Zap className="h-3 w-3 text-amber-300 fill-amber-300 shrink-0" />
                                <span>{sec.section_title}: ON</span>
                              </>
                            ) : (
                              <>
                                <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{sec.section_title}: OFF</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                      💡 Toggle sections OFF before analyzing to lock them 100% untouched as original text.
                    </p>
                  </div>
                )}

                {/* Job Description Input Container */}
                <div className={`space-y-2.5 p-4 rounded-xl transition-all ${onboardingStep === 2 ? 'bg-teal-50/50 border border-teal-200 ring-2 ring-teal-500/20 shadow-md' : ''} ${onboardingStep < 2 ? 'opacity-40 grayscale pointer-events-none' : ''}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        <span className={`flex items-center justify-center h-5 w-5 rounded-full text-[10px] text-white ${onboardingStep >= 2 ? 'bg-teal-600' : 'bg-slate-300'}`}>2</span>
                        Target Job Description
                      </label>

                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePasteClipboardJD}
                        className="text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100/80 border border-teal-200/80 px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs hover:scale-105 active:scale-95"
                        title="Paste job description text from your clipboard"
                      >
                        <Copy className="h-3 w-3 text-teal-600" />
                        <span>{jobDescription.trim().length > 0 ? "Replace from Clipboard" : "Paste Clipboard"}</span>
                      </button>
                      {(jobDescription || analysisResult) && (
                        <button
                          type="button"
                          onClick={() => handleResetWorkspace(true)}
                          className="text-xs text-slate-500 hover:text-red-500 font-bold flex items-center gap-1 cursor-pointer transition-colors p-1"
                          title="Clear job description and reset analysis"
                        >
                          <RotateCcw className="h-3 w-3" /> Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="relative">
                    <textarea
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder="Paste the target job description or requirement spec here (minimum 50 characters)..."
                      rows={7}
                      maxLength={8000}
                      className="w-full bg-white text-slate-900 border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 rounded-xl p-3.5 text-xs sm:text-sm placeholder-slate-400 transition-all outline-none resize-y shadow-inner leading-relaxed"
                    />
                  </div>

                  {/* Visual Character & Quality Meter */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 rounded-full ${jobDescription.length < 50
                          ? "bg-amber-400"
                          : jobDescription.length < 250
                            ? "bg-teal-500"
                            : "bg-emerald-500"
                          }`}
                        style={{ width: `${Math.min(100, Math.round((jobDescription.length / 350) * 100))}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      {jobDescription.length < 50 ? (
                        <span className="text-amber-600 font-bold flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {50 - jobDescription.length} more characters needed for analysis
                        </span>
                      ) : jobDescription.length < 250 ? (
                        <span className="text-teal-700 font-bold flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-teal-600" />
                          Ready for audit (detailed JD gives higher accuracy)
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Ideal comprehensive JD length for precision ATS matching
                        </span>
                      )}
                      <span className="text-slate-400 font-medium text-[10.5px]">
                        {jobDescription.length.toLocaleString()} / 8,000
                      </span>
                    </div>
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
                {/* Visual Out-of-Credits Banner if user has 0 credits */}
                {user && user.credits <= 0 && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 shadow-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                        <Zap className="h-3.5 w-3.5 text-amber-600" />
                        0 Credits Remaining
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900">
                        {user.plan_type === "pro" ? "Pro Quota Depleted" : "Free Credits Used"}
                      </span>
                    </div>
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      {user.plan_type === "pro"
                        ? "You've used all 200 Pro credits this month. Upgrade to Elite (400 credits/mo) to continue tailoring your resumes."
                        : "You've used all 15 free credits. Upgrade to Pro (200 credits/mo) or Elite (400 credits/mo) to keep tailoring without limits."}
                    </p>
                    <button
                      type="button"
                      onClick={() => openUpgradeModal("out_of_credits", user.plan_type === "pro" ? "elite" : "pro")}
                      className="w-full py-2 px-3 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>{user.plan_type === "pro" ? "Upgrade to Elite (400 Credits) →" : "Upgrade to Pro (200 Credits) →"}</span>
                    </button>
                  </div>
                )}
                {/* Action Buttons */}
                <div className={`flex flex-col gap-3 pt-2 transition-all ${onboardingStep === 3 ? 'scale-[1.02]' : ''} ${onboardingStep < 3 ? 'opacity-40 grayscale' : ''}`}>
                  <button
                    id="oneshot-tailor-btn"
                    type="button"
                    onClick={handleOneShotTailor}
                    disabled={
                      (!documentId && !(!token && file && guestResumeText) && !user?.base_resume_id) ||
                      jobDescription.trim().length < 50 ||
                      isAutoTailoring || isAnalyzing
                    }
                    className={`w-full py-3.5 px-4 flex items-center justify-between gap-2 ${(documentId || (!token && file && guestResumeText) || user?.base_resume_id) &&
                        jobDescription.trim().length >= 50 &&
                        !isAutoTailoring && !isAnalyzing
                        ? "btn-magic cursor-pointer"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed rounded-xl font-black text-sm"
                      }`}
                  >
                    {((documentId || (!token && file && guestResumeText) || user?.base_resume_id) &&
                      jobDescription.trim().length >= 50 &&
                      !isAutoTailoring && !isAnalyzing) && (
                        <>
                          <div className="sparkle"></div>
                          <div className="sparkle"></div>
                          <div className="sparkle"></div>
                          <div className="sparkle"></div>
                        </>
                      )}
                    <div className="flex items-center gap-2 relative z-10">
                      {isAutoTailoring ? (
                        <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Zap className="h-4 w-4 text-amber-200 fill-amber-200" />
                      )}
                      <span>{isAutoTailoring ? "Tailoring & Downloading..." : "⚡ 1-Click Auto-Everything"}</span>
                    </div>

                    <span className={`relative z-10 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${(documentId || (!token && file && guestResumeText) || user?.base_resume_id) &&
                        jobDescription.trim().length >= 50 &&
                        !isAutoTailoring && !isAnalyzing
                        ? "bg-white/20 text-white border border-white/30 shadow-sm"
                        : "bg-slate-300 text-slate-500"
                      }`}>
                      {!token ? "Free" : "Magic"}
                    </span>
                  </button>

                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                    <span className="flex-shrink-0 mx-4 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">OR STEP-BY-STEP</span>
                    <div className="flex-grow border-t border-slate-200 dark:border-slate-700"></div>
                  </div>

                  <button
                    id="analyze-btn"
                    type="submit"
                    disabled={
                      (!documentId && !(!token && file && guestResumeText) && !user?.base_resume_id) ||
                      jobDescription.trim().length < 50 ||
                      isAnalyzing
                    }
                    className={`w-full py-3.5 px-4 rounded-xl font-black text-sm transition-all duration-300 flex items-center justify-between gap-2 shadow-lg ${(documentId || (!token && file && guestResumeText) || user?.base_resume_id) &&
                        jobDescription.trim().length >= 50 &&
                        !isAnalyzing
                        ? "bg-gradient-to-r from-[#0F172A] via-[#0F766E] to-[#14B8A6] hover:from-slate-800 hover:via-teal-700 hover:to-teal-500 text-white shadow-teal-500/20 hover:scale-[1.01] active:scale-[0.99] cursor-pointer ring-2 ring-teal-400/30"
                        : "bg-slate-200 text-slate-400 cursor-not-allowed"
                      }`}
                  >
                    <div className="flex items-center gap-2">
                      {isAnalyzing ? (
                        <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-[#FF6B4A]" />
                      )}
                      <span>{isAnalyzing ? "Running Recruiter AI Analysis..." : "Analyze Gaps & Fit"}</span>
                    </div>

                    <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${(documentId || (!token && file && guestResumeText) || user?.base_resume_id) &&
                        jobDescription.trim().length >= 50 &&
                        !isAnalyzing
                        ? "bg-white/20 text-white border border-white/30"
                        : "bg-slate-300 text-slate-500"
                      }`}>
                      {!token ? "Free" : user?.plan_type === "free" ? "1 Credit" : "AI Audit"}
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* Right Results Panel */}
            <div className={`lg:col-span-8 space-y-6 animate-fade-in-up ${mobileTab !== "results" ? "hidden lg:block" : "block"}`} style={{ animationDelay: "0.2s" }}>
              {isAnalyzing ? (
                <LoadingState />
              ) : !analysisResult ? (
                <div className="relative rounded-3xl bg-white border border-slate-200/90 shadow-xl shadow-teal-500/5 overflow-hidden p-6 sm:p-8 space-y-7 animate-fade-in">
                  {/* Ambient background glow */}
                  <div className="absolute top-0 right-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#FF6B4A]/5 rounded-full blur-3xl pointer-events-none" />
                  <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />

                  {/* Top Header Banner */}
                  <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                    <div className="space-y-1.5">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E6F7F4] border border-[#99F6E4] text-[#0D9488] text-xs font-black uppercase tracking-wider shadow-2xs">
                        <Sparkles className="h-3.5 w-3.5 text-[#FF6B4A]" />
                        <span>RoleCraft Intelligence Engine</span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                        ATS Match, Gap Analysis &amp; 1-Click Tailor
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-xl">
                        Upload your resume on the left and paste the target job description to run a multi-vector recruiter audit.
                      </p>
                    </div>

                    {/* Live System Indicator — sonar pulse rings */}
                    <div className="flex flex-col items-end gap-3 self-start md:self-auto">
                      <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-teal-50 border border-teal-200/80 shadow-sm shrink-0">
                        <div className="relative flex h-3 w-3 text-teal-500">
                          <span className="sonar-dot relative inline-flex rounded-full h-3 w-3 bg-teal-500" />
                        </div>
                        <span className="text-xs font-extrabold text-teal-800">AI Engine Ready</span>
                      </div>

                      {/* Demo Button for new users */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          loadSampleData();
                        }}
                        className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-teal-700 hover:border-teal-400 hover:shadow-md transition-all font-bold text-xs flex items-center gap-2 shadow-sm cursor-pointer"
                      >
                        <FileText className="h-4 w-4 text-teal-500" />
                        Don't have a resume? Try a sample
                      </button>
                    </div>
                  </div>

                  {/* Feature Highlight Cards Grid — with rich before/after & live previews */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
                    {/* Card 1: ATS Matrix — teal glow */}
                    <div className="p-5 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-teal-200 hover:shadow-lg hover:shadow-teal-500/10 transition-all duration-300 space-y-3.5 group shadow-2xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="ai-icon-wrap glow-teal">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-teal-100 to-teal-50 text-teal-700 flex items-center justify-center border border-teal-200 group-hover:scale-105 transition-transform shadow-sm">
                            <Target className="h-5 w-5 text-teal-600" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-extrabold text-[#0F172A]">ATS Keyword Matrix</h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Categorizes hard &amp; soft competencies with evidence verification (Confirmed, In Evidence, or Gap).
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 flex flex-wrap gap-1.5 border-t border-slate-100">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-teal-50 text-teal-700 border border-teal-200">
                          ✓ React / TS
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-50 text-amber-700 border border-amber-200">
                          ⚡ Cloud Infra
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-[#FFF1EE] text-[#FF6B4A] border border-[#FFCFC4]">
                          ✗ Redis Cache
                        </span>
                      </div>
                    </div>

                    {/* Card 2: Google XYZ Formula — coral glow */}
                    <div className="p-5 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-500/10 transition-all duration-300 space-y-3.5 group shadow-2xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="ai-icon-wrap glow-coral">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-orange-50 to-amber-50 text-orange-600 flex items-center justify-center border border-orange-200 group-hover:scale-105 transition-transform shadow-sm">
                            <Sparkles className="h-5 w-5 text-[#FF6B4A]" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-extrabold text-[#0F172A]">Google XYZ Formula</h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Transforms passive bullets into high-impact metrics (Accomplished [X] by [Y], resulting in [Z]).
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 p-2.5 rounded-xl bg-white border border-slate-200/90 text-[10.5px] space-y-1 font-sans">
                        <div className="text-slate-400 line-through truncate" title="Responsible for backend APIs">
                          &quot;Responsible for backend APIs&quot;
                        </div>
                        <div className="text-emerald-700 font-bold flex items-center justify-between">
                          <span className="truncate">&quot;Engineered microservices, cutting latency by 38%&quot;</span>
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 rounded ml-1 shrink-0">+38%</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 3: DOCX XML Precision — blue glow */}
                    <div className="p-5 rounded-2xl bg-slate-50/70 hover:bg-white border border-slate-200/80 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 space-y-3.5 group shadow-2xs flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="ai-icon-wrap glow-blue">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 text-blue-700 flex items-center justify-center border border-blue-200 group-hover:scale-105 transition-transform shadow-sm">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-extrabold text-[#0F172A]">100% DOCX Format Match</h4>
                          <p className="text-xs text-slate-500 leading-relaxed font-medium">
                            Patches paragraphs and tables directly at the XML run level without template or font drift.
                          </p>
                        </div>
                      </div>
                      <div className="pt-2 flex items-center justify-between text-[10px] font-extrabold text-blue-700 border-t border-slate-100">
                        <span className="flex items-center gap-1">
                          <CheckCircle className="h-3.5 w-3.5 text-blue-600" />
                          Zero Layout Drift
                        </span>
                        <span className="bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          XML-Level Lock
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3-Step Live Interactive Workflow Stepper */}
                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-[#E6F7F4] via-teal-50/70 to-slate-50 border border-[#99F6E4]/90 text-[#0F172A] shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-[#0D9488] flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 fill-[#0D9488]" />
                        Audit Readiness Workflow
                      </span>
                      <div className="flex items-center gap-1.5 text-[10.5px] font-bold text-teal-900 bg-white/90 px-2.5 py-1 rounded-lg border border-teal-200/90 shadow-2xs">
                        <Shield className="h-3 w-3 text-teal-600" />
                        <span>Strict Recruiter Verification</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {/* Step 1 */}
                      <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${documentId || file
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs"
                        : "bg-white/80 border-slate-200 text-slate-700"
                        }`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${documentId || file
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-600"
                          }`}>
                          {documentId || file ? "✓" : "1"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold truncate">
                            {documentId || file ? "Resume Ready" : "Upload Resume"}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {file?.name || (documentId ? "Base Resume" : "DOCX file")}
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${jobDescription.trim().length >= 50
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900 shadow-2xs"
                        : "bg-white/80 border-slate-200 text-slate-700"
                        }`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${jobDescription.trim().length >= 50
                          ? "bg-emerald-600 text-white"
                          : "bg-slate-200 text-slate-600"
                          }`}>
                          {jobDescription.trim().length >= 50 ? "✓" : "2"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold truncate">
                            {jobDescription.trim().length >= 50 ? "Job Spec Set" : "Paste Job Spec"}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            {jobDescription.trim().length >= 50
                              ? `${jobDescription.trim().length} chars loaded`
                              : "Min 50 characters"}
                          </p>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className={`p-2.5 rounded-xl border flex items-center gap-2.5 transition-all ${(documentId || file) && jobDescription.trim().length >= 50
                        ? "bg-teal-600 text-white border-teal-500 shadow-md shadow-teal-600/20 animate-pulse"
                        : "bg-white/80 border-slate-200 text-slate-700"
                        }`}>
                        <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${(documentId || file) && jobDescription.trim().length >= 50
                          ? "bg-white text-teal-800 font-extrabold"
                          : "bg-slate-200 text-slate-600"
                          }`}>
                          3
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-bold truncate">
                            {(documentId || file) && jobDescription.trim().length >= 50
                              ? "Ready to Audit!"
                              : "Run Audit"}
                          </p>
                          <p className={`text-[10px] truncate ${(documentId || file) && jobDescription.trim().length >= 50
                            ? "text-teal-100"
                            : "text-slate-500"
                            }`}>
                            {(documentId || file) && jobDescription.trim().length >= 50
                              ? "Click Analyze Gaps & Fit"
                              : "Multi-vector match"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Mobile Results Segmented Bar (iPhone 16 Pro & Mobile Zero-Scroll Experience) */}
                  <div className="lg:hidden sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md py-2 border-b border-slate-200 dark:border-slate-800 -mx-4 px-4 sm:-mx-6 sm:px-6 shadow-xs mb-3">
                    <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                      {[
                        { id: "score", label: "📊 Score & Fit" },
                        { id: "keywords", label: "🎯 Keywords" },
                        { id: "rewrites", label: "✨ Rewrites" },
                        { id: "export", label: "📥 Export" },
                      ].map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setMobileResultsTab(tab.id as any)}
                          className={`flex-1 py-2 px-1 text-center rounded-lg text-xs font-black transition-all cursor-pointer select-none ${mobileResultsTab === tab.id
                            ? "bg-white dark:bg-slate-700 text-teal-700 dark:text-teal-300 shadow-xs ring-1 ring-teal-500/20"
                            : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
                            }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ⚡ 1-Click Auto-Tailor Hero Banner (Under Score & Fit tab on mobile, top of right col on desktop) */}
                  {(() => {
                    const hasAutoTailored = Boolean(isPatchingApplied && Object.keys(rewrittenSections).length > 0);
                    return (
                      <div className={`relative overflow-hidden rounded-2xl p-5.5 border transition-all duration-300 backdrop-blur-xl animate-fade-in ${mobileResultsTab === "score" ? "block" : "hidden lg:block"
                        } ${hasAutoTailored
                          ? "border-emerald-300/90 bg-gradient-to-r from-emerald-50/90 via-teal-50/60 to-white text-slate-900 shadow-xl shadow-emerald-500/10"
                          : "border-[#99f6e4]/80 bg-gradient-to-r from-[#E6F7F4]/90 via-white to-[#F1F5F9] text-slate-900 shadow-xl shadow-teal-500/5"
                        }`}>
                        <div className="absolute -right-12 -bottom-12 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
                        <div className={`absolute -left-12 -top-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${hasAutoTailored ? "bg-emerald-500/10" : "bg-[#FF6B4A]/10"}`} />

                        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shadow-lg shrink-0 ring-1 ring-white/50 transition-all ${hasAutoTailored
                              ? "bg-gradient-to-br from-emerald-800 via-teal-700 to-teal-500 text-white shadow-emerald-500/20"
                              : "bg-gradient-to-br from-[#0F172A] via-[#0F766E] to-[#14B8A6] text-white shadow-teal-500/20"
                              }`}>
                              {hasAutoTailored ? (
                                <CheckCircle2 className="h-6 w-6 text-emerald-300 animate-pulse" />
                              ) : (
                                <Sparkles className="h-6 w-6 animate-pulse text-[#FF6B4A]" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-base font-extrabold text-slate-900 flex items-center gap-2 tracking-tight">
                                  ⚡ 1-Click Full Resume Auto-Tailor
                                </h4>
                                {hasAutoTailored && (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black uppercase tracking-wider animate-scale-in">
                                    <Check className="h-3 w-3 text-emerald-700 stroke-[3]" />
                                    Tailored
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 mt-0.5 max-w-md leading-relaxed">
                                {hasAutoTailored
                                  ? "Resume successfully tailored for role. Click Re-Auto-Tailor anytime to re-evaluate with new settings or updated JD."
                                  : "Automatically rewrite weak sections, weave missing ATS keywords, & add Google XYZ impact metrics in one click."}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <button
                              type="button"
                              onClick={handleAutoTailor}
                              disabled={isAutoTailoring}
                              className={`px-6 py-3.5 rounded-xl font-extrabold text-xs text-white shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer shrink-0 border border-white/20 ${isAutoTailoring
                                ? "bg-slate-700 opacity-90 cursor-wait"
                                : hasAutoTailored
                                  ? "bg-gradient-to-r from-emerald-700 via-teal-700 to-teal-600 hover:from-emerald-600 hover:to-teal-500 shadow-emerald-600/25 hover:shadow-emerald-600/40 ring-2 ring-emerald-400/30"
                                  : "bg-gradient-to-r from-[#0F172A] via-[#0F766E] to-[#14B8A6] hover:from-slate-800 hover:to-teal-500 shadow-teal-600/20 hover:shadow-teal-600/35"
                                }`}
                            >
                              {isAutoTailoring ? (
                                <>
                                  <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                  ⚡ Auto-Tailoring Resume...
                                </>
                              ) : hasAutoTailored ? (
                                <>
                                  <RotateCcw className="h-4 w-4 text-emerald-200 transition-transform duration-300 group-hover:-rotate-180" />
                                  🔄 Re-Auto-Tailor Full Resume
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 text-amber-200" />
                                  ⚡ Auto-Tailor Full Resume (1-Click)
                                </>
                              )}
                            </button>

                            {/* ⚙️ 1-Click Scope Settings Trigger Button */}
                            {(() => {
                              const configSections = getAutoTailorConfigSections();
                              const activeCount = configSections.filter((s) => isSectionTailorEnabled(s.id, s.defaultOn)).length;
                              return (
                                <button
                                  type="button"
                                  onClick={() => setIsAutoTailorSettingsOpen(true)}
                                  title="Configure which sections are updated during 1-Click Auto-Tailor"
                                  className="p-3 sm:px-3.5 sm:py-3.5 rounded-xl font-extrabold text-xs border transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-md select-none bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                  <SlidersHorizontal className="h-4 w-4 text-teal-600" />
                                  <span className="hidden md:inline">Settings</span>
                                  <span className="px-1.5 py-0.5 rounded-md text-[10px] font-black border bg-teal-50 text-teal-700 border-teal-200">
                                    {activeCount}/{configSections.length} ON
                                  </span>
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Summary Dashboard Card */}
                  <div className={`glass-panel rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-r from-white/90 via-indigo-500/5 to-white/90 dark:from-slate-900/90 dark:via-indigo-950/20 dark:to-slate-900/90 shadow-xl ${mobileResultsTab === "score" ? "block" : "hidden lg:block"}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                        {masterResume?.profile_photo_url && (
                          <div
                            onClick={() => setIsCompletionModalOpen(true)}
                            className="relative group shrink-0 cursor-pointer"
                            title="Click to view/change profile photo"
                          >
                            <img
                              src={getFullProfilePhotoUrl(masterResume.profile_photo_url) || ""}
                              alt="Candidate Avatar"
                              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-teal-500/40 shadow-md bg-white dark:bg-slate-800 hover:scale-105 transition-transform"
                            />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-teal-500/10 dark:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/20 dark:border-teal-500/30 uppercase tracking-wider">
                              Target Role Detected
                            </span>
                            {masterResume?.contact_info?.full_name && (
                              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                • {masterResume.contact_info.full_name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            {(() => {
                              const rawJobTitle = analysisResult.overall_summary.job_title || "";
                              const isGenericTitle = !rawJobTitle || ["full job description", "job description", "about the role", "overview", "target role", "description"].includes(rawJobTitle.toLowerCase().trim());
                              const activeTitle = (customTargetRole !== "" ? customTargetRole : (rewrittenSections["header"] || (!isGenericTitle ? rawJobTitle : "Target Role"))).trim();
                              const appliedTitle = (rewrittenSections["header"] || "").trim();
                              const isTitleApplied = Boolean(appliedTitle && appliedTitle.toLowerCase() === activeTitle.toLowerCase() && isPatchingApplied);
                              const isTitlePending = Boolean(activeTitle && activeTitle !== "Target Role" && (!appliedTitle || appliedTitle.toLowerCase() !== activeTitle.toLowerCase() || !isPatchingApplied));
                              const canApply = Boolean(activeTitle && activeTitle !== "Target Role");

                              return (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 flex-wrap">
                                  {isEditingTargetRole ? (
                                    <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                                      <input
                                        type="text"
                                        value={targetRoleDraft}
                                        onChange={(e) => setTargetRoleDraft(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            const updated = targetRoleDraft.trim();
                                            if (updated) {
                                              setCustomTargetRole(updated);
                                              setIsEditingTargetRole(false);
                                            }
                                          } else if (e.key === "Escape") {
                                            setIsEditingTargetRole(false);
                                          }
                                        }}
                                        placeholder="e.g. Senior Full Stack Engineer"
                                        autoFocus
                                        className="w-full sm:w-auto min-w-[220px] max-w-[360px] px-3 py-1.5 text-xs sm:text-sm font-bold rounded-xl border border-teal-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-2 focus:ring-teal-500/30"
                                      />
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const updated = targetRoleDraft.trim();
                                            if (updated) {
                                              setCustomTargetRole(updated);
                                              setIsEditingTargetRole(false);
                                            }
                                          }}
                                          className="px-3 py-1.5 text-xs font-black rounded-xl bg-teal-600 hover:bg-teal-500 text-white shadow-xs transition-all cursor-pointer"
                                        >
                                          Done
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setIsEditingTargetRole(false)}
                                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                                          title="Cancel"
                                        >
                                          <X className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-1.5">
                                        <span>{activeTitle}</span>
                                      </h3>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setTargetRoleDraft(activeTitle);
                                          setIsEditingTargetRole(true);
                                        }}
                                        className="px-2 py-1 text-slate-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-slate-800/80 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1 text-[11px] font-bold border border-transparent hover:border-teal-200 dark:hover:border-slate-700"
                                        title="Click to edit target job title"
                                      >
                                        <Edit className="h-3 w-3" />
                                        <span>Edit</span>
                                      </button>
                                    </div>
                                  )}

                                  {/* Status Badges and Apply Button */}
                                  {canApply && !isEditingTargetRole && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {isTitlePending && (
                                        <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                          <span className="relative flex h-1.5 w-1.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                                          </span>
                                          Apply Pending
                                        </span>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() => handleApplyTargetTitle(activeTitle)}
                                        disabled={isApplyingTitle || applyMutation.isPending}
                                        className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all duration-200 cursor-pointer flex items-center gap-1.5 select-none shadow-md ${isTitlePending
                                            ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-white border-amber-400/40 shadow-amber-500/25 hover:scale-105"
                                            : isTitleApplied
                                              ? "bg-slate-900 hover:bg-slate-800 text-white border-slate-900 shadow-slate-900/10"
                                              : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white border-emerald-500/30 shadow-emerald-500/20 hover:scale-105"
                                          }`}
                                        title={isTitlePending ? "Save this new title to your resume header" : "Apply this title to resume"}
                                      >
                                        {isApplyingTitle ? (
                                          <>
                                            <div className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
                                            <span>Applying Title...</span>
                                          </>
                                        ) : isTitlePending ? (
                                          <>
                                            <Sparkles className="h-3.5 w-3.5 text-amber-200 animate-pulse shrink-0" />
                                            <span>{appliedTitle ? "Re-Apply Title" : "Apply Job Title"}</span>
                                          </>
                                        ) : isTitleApplied ? (
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
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Overall Score Circle */}
                      <div className="flex items-center gap-5 bg-white/90 dark:bg-slate-950/70 p-4.5 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-md">
                        <div className="flex items-center gap-3">
                          {currentScore > initialScore && (
                            <>
                              <div className="flex flex-col items-center">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">Before</span>
                                <div className="relative flex items-center justify-center grayscale opacity-60 scale-90">
                                  <svg className="w-14 h-14 transform -rotate-90" viewBox="0 0 56 56">
                                    <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                                    <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="4" fill="transparent" strokeDasharray={2 * Math.PI * 24} strokeDashoffset={2 * Math.PI * 24 * (1 - initialScore / 100)} className="text-slate-400" />
                                  </svg>
                                  <span className="absolute text-xs font-bold text-slate-500">{initialScore}%</span>
                                </div>
                              </div>
                              <div className="text-slate-300">
                                <ArrowRight className="h-5 w-5" />
                              </div>
                            </>
                          )}
                          <div className="flex flex-col items-center">
                            {currentScore > initialScore && <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1">Target Fit</span>}
                            <div className="relative flex items-center justify-center">
                              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
                                <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-200 dark:text-slate-800" />
                                <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="transparent" strokeDasharray={2 * Math.PI * 34} strokeDashoffset={2 * Math.PI * 34 * (1 - currentScore / 100)} className={`${currentScore > initialScore ? "text-emerald-500" : "text-teal-500"} transition-all duration-1000`} />
                              </svg>
                              <span className="absolute text-lg font-black text-slate-900 dark:text-white">
                                {currentScore}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-1 ml-1">
                          <p className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                            {currentScore > initialScore ? "Resume Improved!" : "Overall Fit"}
                          </p>
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-tight">
                            {sectionsStillNeedingImprovement === 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle className="h-3.5 w-3.5" /> All sections optimized
                              </span>
                            ) : (
                              <>
                                <span className="font-bold text-teal-600 dark:text-teal-400">{sectionsStillNeedingImprovement} of {totalNeeded}</span> sections still need improvement
                              </>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive ATS Skill & Keyword Matrix Card */}
                  {(() => {
                    // Compute matched skills
                    const originalMatched = new Set(
                      (analysisResult.top_strengths || [])
                        .map((s: any) => cleanKeywordName(typeof s === "string" ? s : s.name))
                        .filter((k) => isActualATSKeyword(k))
                        .map((k) => k.toLowerCase())
                    );
                    const wovenMatchedLower = new Set(
                      appliedWovenKeywords.map((k) => cleanKeywordName(k).toLowerCase())
                    );
                    const allMatched = Array.from(
                      new Set([
                        ...(analysisResult.top_strengths || [])
                          .map((s: any) => cleanKeywordName(typeof s === "string" ? s : s.name))
                          .filter((k) => isActualATSKeyword(k)),
                        ...appliedWovenKeywords.map((k) => cleanKeywordName(k)).filter((k) => isActualATSKeyword(k)),
                      ])
                    ).filter(Boolean).filter((skill) => !manuallyRemovedSkills.has(skill.toLowerCase()));

                    const matchedLower = new Set(allMatched.map((s) => s.toLowerCase()));

                    // Compute evidence-supported keywords (From section strengths only)
                    const rawEvidence = (analysisResult.sections || []).flatMap((s: any) => s.strengths || []);
                    const allEvidence = Array.from(
                      new Set(
                        rawEvidence
                          .flatMap((e) => extractStrictKeywordsFromRaw(e))
                          .filter((k) => isActualATSKeyword(k))
                      )
                    ).filter((kw) => !matchedLower.has(kw.toLowerCase()));

                    // Compute missing JD keywords (From section missing_keywords only)
                    const rawMissing = (analysisResult.sections || []).flatMap((s: any) => s.missing_keywords || []);
                    const allMissing = Array.from(
                      new Set(
                        rawMissing
                          .flatMap((m) => extractStrictKeywordsFromRaw(m))
                          .filter((k) => isActualATSKeyword(k))
                      )
                    ).filter((kw) => !matchedLower.has(kw.toLowerCase()) && !allEvidence.some((e) => e.toLowerCase() === kw.toLowerCase()));

                    const totalKeywords = allMatched.length + allEvidence.length + allMissing.length;
                    const matchPercentage = totalKeywords > 0 ? Math.round((allMatched.length / (allMatched.length + allMissing.length || 1)) * 100) : 100;

                    // Apply search query filter
                    const q = keywordSearchQuery.trim().toLowerCase();
                    const filterMatch = (k: string) => !q || k.toLowerCase().includes(q);

                    const filteredMatched = allMatched.filter(filterMatch);
                    const filteredEvidence = allEvidence.filter(filterMatch);
                    const filteredMissing = allMissing.filter(filterMatch);

                    const showMatched = keywordFilterTab === 'all' || keywordFilterTab === 'matched';
                    const showEvidence = keywordFilterTab === 'all' || keywordFilterTab === 'supported';
                    const showMissing = keywordFilterTab === 'all' || keywordFilterTab === 'missing';

                    return (
                      <div className={`glass-panel rounded-3xl p-6 sm:p-7 border border-slate-200/90 bg-white shadow-xl shadow-teal-500/5 space-y-6 ${mobileResultsTab === "keywords" ? "block" : "hidden lg:block"}`}>
                        {/* Header */}
                        <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-100 pb-5">
                          <div className="flex items-center gap-3.5">
                            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0 ring-1 ring-white/60">
                              <Layers className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2.5">
                                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                                  ATS Skill & Keyword Matrix
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-teal-50 text-teal-700 border border-teal-200 shadow-2xs">
                                  {matchPercentage}% Match Rate
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {allMatched.length} confirmed in resume &bull; {allEvidence.length} in bullet evidence &bull; {allMissing.length} high-value JD gaps
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={openKeywordWeaveModal}
                              disabled={isWeavingKeywords}
                              className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-200 flex items-center gap-2 cursor-pointer shadow-md border ${isKeywordsWoven
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/40 shadow-emerald-600/20"
                                : "bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white border-white/20 shadow-teal-600/20 hover:scale-[1.02] active:scale-[0.98]"
                                }`}
                            >
                              {isWeavingKeywords ? (
                                <>
                                  <div className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                  Weaving Keywords...
                                </>
                              ) : isKeywordsWoven ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-emerald-200" />
                                  ✓ Keywords Woven & Applied
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 text-amber-200" />
                                  ⚡ Auto-Weave All Keywords (1-Click)
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Tri-Color Match Progress Bar */}
                        <div className="space-y-2">
                          <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200 p-0.5">
                            <div
                              className="bg-emerald-500 h-full rounded-l-full transition-all duration-500"
                              style={{ width: `${totalKeywords > 0 ? (allMatched.length / totalKeywords) * 100 : 33}%` }}
                              title={`${allMatched.length} Confirmed Matched`}
                            />
                            <div
                              className="bg-amber-400 h-full transition-all duration-500"
                              style={{ width: `${totalKeywords > 0 ? (allEvidence.length / totalKeywords) * 100 : 33}%` }}
                              title={`${allEvidence.length} Supported in Evidence`}
                            />
                            <div
                              className="bg-rose-400 h-full rounded-r-full transition-all duration-500"
                              style={{ width: `${totalKeywords > 0 ? (allMissing.length / totalKeywords) * 100 : 34}%` }}
                              title={`${allMissing.length} Missing from JD`}
                            />
                          </div>
                        </div>

                        {/* Filter Bar & Search */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                          {/* Segmented Filter Tabs */}
                          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/80 border border-slate-200 text-xs font-bold overflow-x-auto">
                            <button
                              type="button"
                              onClick={() => setKeywordFilterTab('all')}
                              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap ${keywordFilterTab === 'all'
                                ? "bg-white text-slate-900 shadow-2xs"
                                : "text-slate-500 hover:text-slate-800"
                                }`}
                            >
                              All ({totalKeywords})
                            </button>
                            <button
                              type="button"
                              onClick={() => setKeywordFilterTab('matched')}
                              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${keywordFilterTab === 'matched'
                                ? "bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs"
                                : "text-slate-500 hover:text-emerald-700"
                                }`}
                            >
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              Matched ({allMatched.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setKeywordFilterTab('supported')}
                              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${keywordFilterTab === 'supported'
                                ? "bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs"
                                : "text-slate-500 hover:text-amber-700"
                                }`}
                            >
                              <span className="h-2 w-2 rounded-full bg-amber-400" />
                              In Evidence ({allEvidence.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setKeywordFilterTab('missing')}
                              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${keywordFilterTab === 'missing'
                                ? "bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs"
                                : "text-slate-500 hover:text-rose-700"
                                }`}
                            >
                              <span className="h-2 w-2 rounded-full bg-rose-400" />
                              Missing ({allMissing.length})
                            </button>
                          </div>

                          {/* Search Input */}
                          <div className="relative min-w-[200px] sm:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <input
                              type="text"
                              value={keywordSearchQuery}
                              onChange={(e) => setKeywordSearchQuery(e.target.value)}
                              placeholder="Filter skills..."
                              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                            />
                            {keywordSearchQuery && (
                              <button
                                type="button"
                                onClick={() => setKeywordSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Skill Pills Matrix */}
                        <div className="space-y-5 pt-2">
                          {/* 🟢 Confirmed Matched Skills */}
                          {showMatched && filteredMatched.length > 0 && (
                            <div className="space-y-2.5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                  Confirmed Matched Skills ({filteredMatched.length})
                                </span>
                                <span className="text-[11px] text-slate-400">Verified in resume &bull; click to remove</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {filteredMatched.map((skillName, idx) => {
                                  const skillLower = skillName.toLowerCase();
                                  const isWoven = wovenMatchedLower.has(skillLower);
                                  const isOriginal = originalMatched.has(skillLower);
                                  const cat = getSkillCategory(skillName);

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
                                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-50/80 hover:bg-rose-50 text-emerald-900 hover:text-rose-700 border border-emerald-200/90 hover:border-rose-300 transition-all duration-150 cursor-pointer group shadow-2xs"
                                      title={isWoven ? `Click to move '${skillName}' back to ${isOriginal ? "supported" : "missing"} keywords` : `Click to remove '${skillName}' from matched skills`}
                                    >
                                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${cat.badgeColor}`}>
                                        {cat.label}
                                      </span>
                                      <span>{skillName}</span>
                                      <Check className="h-3 w-3 text-emerald-600 group-hover:hidden" />
                                      <X className="h-3 w-3 text-rose-600 hidden group-hover:block" />
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 🟡 Supported in Evidence */}
                          {showEvidence && filteredEvidence.length > 0 && (
                            <div className="space-y-2.5 pt-2 border-t border-slate-100">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                                  Supported in Project & Experience Evidence ({filteredEvidence.length})
                                </span>
                                <span className="text-[11px] text-slate-400">Click to weave into Technical Skills</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {filteredEvidence.map((kw, idx) => {
                                  const cat = getSkillCategory(kw);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleQuickWeaveKeyword(kw)}
                                      disabled={weavingSingleKeyword === kw}
                                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100/80 text-amber-900 border border-amber-200 transition-all duration-150 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 group"
                                      title={`Click to weave '${kw}' into Technical Skills section`}
                                    >
                                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${cat.badgeColor}`}>
                                        {cat.label}
                                      </span>
                                      <span>{kw}</span>
                                      {weavingSingleKeyword === kw ? (
                                        <div className="h-3 w-3 border-2 border-amber-600/30 border-t-amber-600 rounded-full animate-spin shrink-0" />
                                      ) : (
                                        <Plus className="h-3 w-3 text-amber-600 group-hover:scale-125 transition-transform" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* 🔴 Missing ATS Keywords */}
                          {showMissing && filteredMissing.length > 0 && (
                            <div className="space-y-2.5 pt-2 border-t border-slate-100">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                                  <Plus className="h-3.5 w-3.5 text-rose-600" />
                                  Missing High-Priority Job Competencies ({filteredMissing.length})
                                </span>
                                <span className="text-[11px] text-slate-400">In Job Description &bull; click to weave</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {filteredMissing.map((kw, idx) => {
                                  const cat = getSkillCategory(kw);
                                  return (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => handleQuickWeaveKeyword(kw)}
                                      disabled={weavingSingleKeyword === kw}
                                      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-rose-50 hover:bg-rose-100/80 text-rose-900 border border-rose-200 transition-all duration-150 cursor-pointer shadow-2xs hover:scale-105 active:scale-95 group"
                                      title={`Click to weave '${kw}' into Technical Skills section`}
                                    >
                                      <span className={`text-[9px] font-black px-1.5 py-0.2 rounded border ${cat.badgeColor}`}>
                                        {cat.label}
                                      </span>
                                      <span>{kw}</span>
                                      {weavingSingleKeyword === kw ? (
                                        <div className="h-3 w-3 border-2 border-rose-600/30 border-t-rose-600 rounded-full animate-spin shrink-0" />
                                      ) : (
                                        <Plus className="h-3 w-3 text-rose-600 group-hover:scale-125 transition-transform" />
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Empty Search / Filter State */}
                          {filteredMatched.length === 0 && filteredEvidence.length === 0 && filteredMissing.length === 0 && (
                            <div className="text-center py-8 text-xs text-slate-400 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                              <p className="font-bold text-slate-600">No skills match &quot;{keywordSearchQuery}&quot;</p>
                              <p>Try clearing your search query or switching tabs.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ─── 3. REWRITES TAB: Section Analysis Breakdown & Actionable Cards ─── */}
                  <div className={`space-y-6 ${mobileResultsTab === "rewrites" ? "block" : "hidden lg:block"}`}>
                    {(() => {
                      const sectionsToImprove = (analysisResult.sections || [])
                        .filter((s) => s.review_status === "improve" || (s.recommendations && s.recommendations.length > 0))
                        .sort((a, b) => {
                          const priorityMap = { high: 3, medium: 2, low: 1 };
                          return (priorityMap[b.priority] || 0) - (priorityMap[a.priority] || 0);
                        });

                      const sectionsToKeep = (analysisResult.sections || [])
                        .filter((s) => s.review_status === "keep" && (!s.recommendations || s.recommendations.length === 0));

                      const sectionsToReduce = (analysisResult.sections || [])
                        .filter((s) => s.review_status === "reduce_emphasis");

                      return (
                        <>
                          {/* AI Section Tailoring Master Controls Bar */}
                          {analysisResult?.sections && analysisResult.sections.length > 0 && (
                            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-teal-50/80 via-emerald-50/40 to-slate-50 border border-teal-200/80 text-slate-800 shadow-2xs space-y-2.5">
                              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-teal-200/60 pb-2">
                                <div className="flex items-center gap-2">
                                  <SlidersHorizontal className="h-4 w-4 text-teal-600 shrink-0" />
                                  <span className="text-xs font-black tracking-tight text-slate-800 uppercase">
                                    AI Section Controls (Toggle for Auto-Tailor)
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allOn: Record<string, boolean> = {};
                                      (analysisResult.sections || []).forEach((s) => { allOn[s.section_name] = true; });
                                      setTailoringSectionToggles(allOn);
                                    }}
                                    className="text-[10px] font-extrabold text-teal-800 hover:text-teal-900 bg-white hover:bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md transition-all cursor-pointer shadow-2xs"
                                  >
                                    Enable All
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const allOff: Record<string, boolean> = {};
                                      (analysisResult.sections || []).forEach((s) => { allOff[s.section_name] = false; });
                                      setTailoringSectionToggles(allOff);
                                    }}
                                    className="text-[10px] font-extrabold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-md transition-all cursor-pointer shadow-2xs"
                                  >
                                    Disable All
                                  </button>
                                </div>
                              </div>

                              {/* Section Toggle Chips - Swipeable carousel on mobile, wrapping on desktop */}
                              <div className="chip-scroll horizontal-scroll-mask sm:flex-wrap sm:overflow-visible py-1">
                                {(analysisResult.sections || []).map((sec, idx) => {
                                  const isEnabled = tailoringSectionToggles[sec.section_name] !== undefined
                                    ? tailoringSectionToggles[sec.section_name]
                                    : !(sec.section_name.toLowerCase().includes("education") || sec.section_name.toLowerCase().includes("certification"));
                                  return (
                                    <button
                                      key={`${sec.section_name}-${idx}`}
                                      type="button"
                                      onClick={() => handleToggleSectionTailoring(sec.section_name)}
                                      className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer select-none shrink-0 border ${isEnabled
                                        ? "bg-teal-600 text-white border-teal-500 shadow-2xs hover:bg-teal-700"
                                        : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                                        }`}
                                    >
                                      {isEnabled ? (
                                        <>
                                          <Zap className="h-3 w-3 text-amber-300 fill-amber-300 shrink-0" />
                                          <span>{sec.section_name}: ON</span>
                                        </>
                                      ) : (
                                        <>
                                          <Lock className="h-3 w-3 text-slate-400 shrink-0" />
                                          <span>{sec.section_name}: OFF</span>
                                        </>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

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
                                {sectionsToImprove.map((section, idx) => (
                                  <SectionCard
                                    key={`${section.section_name}-${idx}`}
                                    section={section}
                                    idx={idx}
                                    isExpanded={!!expandedSections[section.section_name]}
                                    onToggle={() => toggleSection(section.section_name)}
                                    rewrittenText={getRewrittenTextForSection(section.section_name, rewrittenSections, (section as any).section_type)}
                                    previousRewrittenText={getRewrittenTextForSection(section.section_name, previousRewrittenSections, (section as any).section_type)}
                                    onRevert={handleRevert}
                                    onUndoLastRewrite={handleUndoLastRewrite}
                                    onImproveClick={handleImproveClick}
                                    inlineLoadingSections={inlineLoadingSections}
                                    triggerInlineRewrite={triggerInlineRewrite}
                                    onBulletExclusionChange={handleBulletExclusionChange}
                                    isPatchingApplied={isPatchingApplied}
                                    masterResume={masterResume}
                                    isTailoringEnabled={
                                      tailoringSectionToggles[section.section_name] !== undefined
                                        ? tailoringSectionToggles[section.section_name]
                                        : !(section.section_name.toLowerCase().includes("education") || section.section_name.toLowerCase().includes("certification"))
                                    }
                                    onToggleTailoring={handleToggleSectionTailoring}
                                  />
                                ))}
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
                                {sectionsToKeep.map((section, idx) => (
                                  <SectionCard
                                    key={`${section.section_name}-${idx}`}
                                    section={section}
                                    idx={idx}
                                    isExpanded={!!expandedSections[section.section_name]}
                                    onToggle={() => toggleSection(section.section_name)}
                                    rewrittenText={getRewrittenTextForSection(section.section_name, rewrittenSections, (section as any).section_type)}
                                    previousRewrittenText={getRewrittenTextForSection(section.section_name, previousRewrittenSections, (section as any).section_type)}
                                    onRevert={handleRevert}
                                    onUndoLastRewrite={handleUndoLastRewrite}
                                    onImproveClick={handleImproveClick}
                                    inlineLoadingSections={inlineLoadingSections}
                                    triggerInlineRewrite={triggerInlineRewrite}
                                    onBulletExclusionChange={handleBulletExclusionChange}
                                    isPatchingApplied={isPatchingApplied}
                                    masterResume={masterResume}
                                    isTailoringEnabled={
                                      tailoringSectionToggles[section.section_name] !== undefined
                                        ? tailoringSectionToggles[section.section_name]
                                        : !(section.section_name.toLowerCase().includes("education") || section.section_name.toLowerCase().includes("certification"))
                                    }
                                    onToggleTailoring={handleToggleSectionTailoring}
                                  />
                                ))}
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
                                {sectionsToReduce.map((section, idx) => (
                                  <SectionCard
                                    key={`${section.section_name}-${idx}`}
                                    section={section}
                                    idx={idx}
                                    isExpanded={!!expandedSections[section.section_name]}
                                    onToggle={() => toggleSection(section.section_name)}
                                    rewrittenText={getRewrittenTextForSection(section.section_name, rewrittenSections, (section as any).section_type)}
                                    previousRewrittenText={getRewrittenTextForSection(section.section_name, previousRewrittenSections, (section as any).section_type)}
                                    onRevert={handleRevert}
                                    onUndoLastRewrite={handleUndoLastRewrite}
                                    onImproveClick={handleImproveClick}
                                    inlineLoadingSections={inlineLoadingSections}
                                    triggerInlineRewrite={triggerInlineRewrite}
                                    onBulletExclusionChange={handleBulletExclusionChange}
                                    isPatchingApplied={isPatchingApplied}
                                    masterResume={masterResume}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Quick transition footer to Export tab */}
                          <div className="lg:hidden p-4 rounded-2xl bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-teal-500/10 border border-teal-200/80 flex items-center justify-between gap-3 animate-fade-in mt-4">
                            <div>
                              <h4 className="text-xs font-black text-slate-900">Done Reviewing Sections?</h4>
                              <p className="text-[11px] text-slate-600 font-medium">Export your tailored resume & matching cover letter.</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setMobileResultsTab("export")}
                              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shrink-0 shadow-2xs cursor-pointer select-none active:scale-95"
                            >
                              Go to Export ➔
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>

                  {/* ─── 4. EXPORT TAB: Dedicated Resume Downloads & Matching Cover Letter ─── */}
                  <div className={`space-y-6 ${mobileResultsTab === "export" ? "block" : "hidden lg:block"}`}>
                    {/* Primary: Export Tailored Resume */}
                    <div className="glass-panel rounded-3xl p-6 border border-slate-200/90 bg-white shadow-xl shadow-teal-500/5 space-y-5 animate-fade-in">
                      <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4">
                        <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0 ring-1 ring-white/60">
                          <Download className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-base font-black text-slate-900 tracking-tight">
                            Export Tailored Resume
                          </h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Recruiter-grade resume with 100% visual layout preservation.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {/* Primary DOCX Download */}
                        <a
                          href={downloadUrl ? `${API_BASE_URL}${downloadUrl}` : (downloadId ? `${API_BASE_URL}/api/v1/resume/download/${downloadId}` : undefined)}
                          download
                          onClick={() => {
                            if (!downloadUrl && !downloadId) {
                              handleApplyRewrites();
                            } else {
                              setSuccessNotification("Downloading tailored DOCX...");
                            }
                          }}
                          className={`w-full py-4 px-5 rounded-2xl font-black text-sm text-white shadow-xl flex items-center justify-between transition-all active:scale-95 ${downloadUrl || downloadId
                            ? "bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-500 shadow-emerald-600/25"
                            : "btn-primary shadow-teal-600/25"
                            }`}
                        >
                          <div className="flex items-center gap-3">
                            <WordLogoIcon className="h-6 w-6 shrink-0" />
                            <div className="text-left">
                              <p className="font-black text-sm">Download Tailored DOCX</p>
                              <p className="text-[11px] text-teal-100 font-medium">100% Word format & template preserved</p>
                            </div>
                          </div>
                          <Download className="h-5 w-5 text-white/90" />
                        </a>

                        {/* PDF Download (if available) */}
                        {downloadId && (
                          <a
                            href={`${API_BASE_URL}/api/v1/resume/download-pdf/${downloadId}?t=${encodeURIComponent(
                              localStorage.getItem("token") || ""
                            )}`}
                            download
                            onClick={() => setSuccessNotification("Downloading PDF...")}
                            className="w-full py-3.5 px-5 rounded-2xl font-bold text-xs bg-slate-900 hover:bg-slate-800 text-white shadow-md flex items-center justify-between transition-all active:scale-95"
                          >
                            <div className="flex items-center gap-3">
                              <PdfLogoIcon className="h-5 w-5 shrink-0" />
                              <span className="font-bold">Download Tailored PDF</span>
                            </div>
                            <Download className="h-4 w-4 text-white/70" />
                          </a>
                        )}

                        {/* PDF Preview */}
                        {downloadId && (
                          <button
                            type="button"
                            onClick={() => setIsPdfPreviewOpen(true)}
                            className="w-full py-3 px-5 rounded-2xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 shadow-xs flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                          >
                            <Eye className="h-4 w-4 text-slate-600" />
                            <span>Preview PDF in Browser</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Secondary: Tailored Cover Letter Card */}
                    <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/90 space-y-4 shadow-xl">
                      <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-xl bg-teal-500/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 flex items-center justify-center border border-teal-500/20 shrink-0">
                            <FileText className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                              Tailored Cover Letter
                              {coverLetterText && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E6F7F4] text-teal-900 border border-[#99F6E4] font-extrabold">
                                  Ready
                                </span>
                              )}
                            </h3>
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                              Generate a 3-paragraph executive cover letter tailored to the job description & your resume.
                            </p>
                          </div>
                        </div>

                        {!coverLetterText && (
                          <button
                            type="button"
                            onClick={handleGenerateCoverLetter}
                            disabled={isGeneratingCoverLetter}
                            className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-md shadow-teal-500/20 disabled:opacity-50 active:scale-95"
                          >
                            {isGeneratingCoverLetter ? (
                              <>
                                <div className="h-3.5 w-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Generating Cover Letter...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5 text-teal-200 animate-pulse" />
                                ✨ Generate Cover Letter (1-Click)
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Editable Target Designation & Contact Header Controls */}
                      <div className="p-3 bg-slate-50/80 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-700 dark:text-slate-300 shrink-0">
                            Target Designation:
                          </span>
                          <div className="flex-1 min-w-[200px] flex items-center gap-1.5">
                            <input
                              type="text"
                              value={customTargetRole}
                              onChange={(e) => setCustomTargetRole(e.target.value)}
                              placeholder="e.g. Full Stack Developer"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-900 dark:text-white font-bold focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                            />
                            <button
                              type="button"
                              disabled={isGeneratingCoverLetter}
                              onClick={handleGenerateCoverLetter}
                              className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50 shadow-2xs active:scale-95"
                            >
                              Update Header
                            </button>
                          </div>
                        </div>
                        {user && (user.address || user.phone_number || user.linkedin_url) ? (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            <strong>Header Contact Line:</strong> {[user.address, user.phone_number, user.email, user.linkedin_url].filter(Boolean).join(" | ")}
                          </p>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setIsProfileModalOpen(true)}
                            className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            + Add Address, Phone & LinkedIn to Profile for Cover Letter Header
                          </button>
                        )}
                      </div>

                      {/* Cover Letter Content Body */}
                      {coverLetterText ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-50/80 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
                              <CheckCircle className="h-4 w-4 text-teal-600 shrink-0" />
                              <span>Cover Letter tailored to job description</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={handleCopyCoverLetterText}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border select-none ${isCoverLetterCopied
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                  : "bg-teal-50 text-teal-800 dark:text-teal-300 hover:bg-teal-100 border-teal-200"
                                  }`}
                                title="Copy full cover letter text content"
                              >
                                {isCoverLetterCopied ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-600" />
                                    <span>Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3 text-teal-600" />
                                    <span>Copy Text</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditingCoverLetter(!isEditingCoverLetter)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-1 cursor-pointer border border-slate-200/80 select-none"
                              >
                                <Edit className="h-3 w-3" />
                                {isEditingCoverLetter ? "Done Editing" : "Edit Text"}
                              </button>
                              <button
                                type="button"
                                disabled={isGeneratingCoverLetter}
                                onClick={handleGenerateCoverLetter}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-teal-50 text-teal-800 dark:text-teal-300 hover:bg-teal-100 border border-teal-200/80 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50 select-none"
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
                                className="w-full p-4 rounded-xl border border-teal-300 dark:border-teal-700 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 resize-y font-sans"
                                placeholder="Edit your cover letter here..."
                              />
                              <button
                                type="button"
                                disabled={isUpdatingCoverLetter}
                                onClick={() => handleUpdateCoverLetterText(coverLetterText)}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-95 shadow-xs"
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
                            <div className="p-4 sm:p-5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 text-sm leading-relaxed whitespace-pre-wrap font-sans space-y-3 shadow-2xs">
                              {cleanCoverLetterText(coverLetterText)}
                            </div>
                          )}

                          {/* Download Buttons Bar */}
                          {coverLetterDownloadId && (
                            <div className="flex items-center justify-end flex-wrap gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold mr-auto">
                                Export Cover Letter:
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDownloadCoverLetter("docx")}
                                disabled={downloadingCoverLetterFormat !== null}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-60 select-none active:scale-[0.98]"
                                title="Download formatted DOCX cover letter"
                              >
                                {downloadingCoverLetterFormat === "docx" ? (
                                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                                ) : (
                                  <WordLogoIcon className="h-4 w-4 shrink-0 shadow-sm" />
                                )}
                                <span>Download Cover Letter (.DOCX)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDownloadCoverLetter("pdf")}
                                disabled={downloadingCoverLetterFormat !== null}
                                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-all flex items-center gap-1.5 cursor-pointer border border-slate-700/60 disabled:opacity-60 select-none active:scale-[0.98]"
                                title="Download high-fidelity PDF cover letter"
                              >
                                {downloadingCoverLetterFormat === "pdf" ? (
                                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
                                ) : (
                                  <PdfLogoIcon className="h-4 w-4 shrink-0 shadow-sm" />
                                )}
                                <span>Download Cover Letter (.PDF)</span>
                              </button>
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
                  </div>

                  {/* Detailed Recruitment Insights Toggle (Shown under Score & Fit on mobile, bottom of column on desktop) */}
                  <div className={mobileResultsTab === "score" ? "block" : "hidden lg:block"}>
                    <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setShowDetailedInsights(!showDetailedInsights)}
                        className="w-full py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-800 transition-all flex items-center justify-center gap-2 select-none cursor-pointer"
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
                                              <span className="text-[10px] font-black text-teal-900 uppercase tracking-wider block">
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
                                                  <span className="text-teal-700 font-extrabold">{Math.round(imp.confidence * 100)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                                                  <div
                                                    className="h-full bg-teal-600 rounded-full transition-all duration-500"
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
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ─── ⚡ 1-Click Auto-Tailoring Full Screen Progress Modal ────────────── */}
      {isAutoTailoring && (
        <AutoTailoringProgressModal
          targetRole={customTargetRole || analysisResult?.overall_summary?.job_title || "Target Role"}
          controlledStepIndex={autoTailorStepIndex}
          controlledProgress={autoTailorProgress}
          isComplete={autoTailorComplete}
          onClose={handleCloseAutoTailoringModal}
        />
      )}

      {/* ─── ⚡ Keyword Weave Selection Modal ───────────────────────────────── */}
      {isKeywordWeaveModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-5 bg-gradient-to-r from-emerald-50 to-indigo-50">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-teal-600 animate-pulse" />
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
                className="text-[10px] font-bold text-teal-600 hover:text-teal-700 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-[#E6F7F4] border border-teal-200 transition-all cursor-pointer"
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
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${isChecked
                                ? "bg-amber-50 border-amber-300"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300 opacity-60"
                                }`}
                            >
                              <div
                                className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${isChecked ? "border-amber-500 bg-amber-500" : "border-slate-300 bg-white"
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
                                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
                              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-150 ${isChecked
                                ? "bg-rose-50 border-rose-300"
                                : "bg-slate-50 border-slate-200 hover:border-slate-300 opacity-60"
                                }`}
                            >
                              <div
                                className={`shrink-0 h-4 w-4 rounded border-2 flex items-center justify-center transition-all duration-150 ${isChecked ? "border-rose-500 bg-rose-500" : "border-slate-300 bg-white"
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
                                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
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
                  <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400 animate-pulse" />
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
                  <div className="h-10 w-10 border-4 border-teal-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-sm text-teal-600 dark:text-teal-400 font-semibold animate-pulse">
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
                        positioning_mode: isSummarySection(activeRewriteSection) ? (modalPositioningMode !== "default" ? modalPositioningMode : undefined) : undefined,
                        metric_inputs: !isSummarySection(activeRewriteSection) && (metricPercentage.trim() || metricScale.trim()) ? {
                          metric_or_percentage: metricPercentage.trim(),
                          scale_or_volume: metricScale.trim()
                        } : undefined
                      });
                    }}
                    className="mt-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 transition-all duration-300 flex items-center gap-1.5"
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
                        className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${!diffModeActive ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                      >
                        Edit Mode
                      </button>
                      <button
                        onClick={() => setDiffModeActive(true)}
                        className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${diffModeActive ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
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
                        <span className="text-[11px] font-black text-teal-600 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-teal-500 animate-pulse" />
                          {diffModeActive ? "Visual Diff Highlight" : "AI Rewritten Section (Editable)"}
                        </span>
                        <div className="flex items-center gap-2">
                          {!diffModeActive && draftRewrittenText !== rewriteData.rewritten_text && (
                            <button
                              type="button"
                              onClick={() => setDraftRewrittenText(rewriteData.rewritten_text)}
                              className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                              title="Reset text to original AI generation"
                            >
                              <RotateCcw className="h-3 w-3" /> Reset AI
                            </button>
                          )}
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-extrabold border border-teal-500/20">
                            ✨ Tailored & Fact-Checked
                          </span>
                        </div>
                      </div>

                      {diffModeActive ? (
                        <div className="bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/30 dark:from-indigo-950/30 dark:via-slate-900 dark:to-purple-950/20 p-4 sm:p-5 rounded-2xl border border-teal-200 dark:border-teal-500/30 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed min-h-[220px] max-h-[360px] overflow-y-auto whitespace-pre-wrap select-all flex-1 shadow-md">
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
                            className="w-full bg-white dark:bg-slate-950 p-4 sm:p-5 pb-10 rounded-2xl border-2 border-teal-500/40 hover:border-teal-500 focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed min-h-[220px] max-h-[360px] overflow-y-auto focus:outline-none resize-none font-sans shadow-md transition-all"
                            placeholder="Loading rewrite text..."
                          />
                          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] text-slate-400 pointer-events-none select-none">
                            <span className="bg-slate-100 dark:bg-slate-900/90 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 font-mono font-semibold text-slate-600 dark:text-slate-400">
                              {draftRewrittenText.split("\n").filter(l => l.trim()).length} Bullets • {draftRewrittenText.trim().split(/\s+/).length} Words
                            </span>
                            <span className="text-teal-600 dark:text-teal-400 font-bold bg-teal-50 dark:bg-slate-900/80 px-2 py-0.5 rounded border border-teal-200 dark:border-slate-800">
                              ✏️ Click text to customize
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Summary Leadership Positioning Presets OR Google XYZ Formula & Metric Synthesizer Card */}
                  {isSummarySection(activeRewriteSection) ? (
                    <div className="bg-gradient-to-r from-teal-50/80 via-purple-50/60 to-slate-100 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-950 p-4 rounded-xl border border-teal-200 dark:border-teal-500/20 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/30">
                            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                          </div>
                          <span className="text-xs font-bold text-[#0F172A] dark:text-teal-200">
                            Role & Leadership Positioning Presets
                          </span>
                        </div>
                        <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 font-extrabold flex items-center gap-1">
                          🛡️ Anti-AI Authentic Voice (Zero Clichés)
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        Position your senior engineering background for leadership (architecture, code reviews, mentoring, delivery) with grounded human phrasing — without fabricating false past titles or using robotic buzzwords.
                      </p>

                      {/* Preset Cards Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        {SUMMARY_POSITIONING_PRESETS.map((preset) => {
                          const isSelected = modalPositioningMode === preset.id;
                          return (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => {
                                setModalPositioningMode(preset.id);
                                setUserInstructions(preset.instruction);
                              }}
                              className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                                isSelected
                                  ? "bg-teal-50/90 dark:bg-teal-950/40 border-teal-500 ring-2 ring-teal-500/20 shadow-xs"
                                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-teal-300 hover:bg-slate-50 dark:hover:bg-slate-850"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{preset.icon}</span>
                                  <span>{preset.label}</span>
                                </span>
                                {isSelected && (
                                  <span className="text-[9px] bg-teal-600 text-white font-extrabold px-1.5 py-0.5 rounded-full">
                                    Selected
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                                {preset.desc}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-indigo-50/80 via-purple-50/60 to-slate-100 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-950 p-4 rounded-xl border border-teal-200 dark:border-teal-500/20 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-md bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/30">
                            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                          </div>
                          <span className="text-xs font-bold text-[#0F172A] dark:text-teal-200">
                            Google XYZ Formula & Metric Synthesizer
                          </span>
                        </div>
                        <span className="text-[10px] bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-500/20 font-mono">
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
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
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
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
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
                          className="text-[10px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
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
                  )}

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
                        placeholder={
                          isSummarySection(activeRewriteSection)
                            ? "e.g. 'Emphasize architectural decision making and mentoring junior engineers', 'Keep under 70 words'"
                            : "e.g. 'make it shorter', 'use stronger action verbs', 'emphasize leadership'"
                        }
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-teal-500 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
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
                            positioning_mode: isSummarySection(activeRewriteSection) ? (modalPositioningMode !== "default" ? modalPositioningMode : undefined) : undefined,
                            metric_inputs: !isSummarySection(activeRewriteSection) && (metricPercentage.trim() || metricScale.trim()) ? {
                              metric_or_percentage: metricPercentage.trim(),
                              scale_or_volume: metricScale.trim()
                            } : undefined
                          });
                        }}
                        disabled={rewriteMutation.isPending}
                        className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-indigo-650 text-white rounded-xl text-xs font-semibold shadow-md shadow-teal-600/10 hover:shadow-teal-600/25 transition-all duration-300 flex items-center justify-center gap-1.5 shrink-0"
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
                            structure: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20 dark:border-teal-500/30",
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
                  className="px-5 py-2 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-semibold shadow-lg shadow-teal-600/20 hover:shadow-teal-600/30 transition-all duration-300 flex items-center gap-1.5"
                >
                  <CheckCircle className="h-4 w-4" />
                  Accept Rewrite
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Floating Sticky Action Dock — Compact Bottom-Right Floating Bar (Desktop Only) */}
      {Object.keys(rewrittenSections).length > 0 && isBottomBarVisible && (
        <div className="hidden lg:block fixed bottom-6 right-6 z-50 bg-slate-950/90 backdrop-blur-2xl border border-slate-800/90 p-2 px-3 rounded-2xl shadow-2xl text-white animate-fade-in-up transition-all duration-300">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Expandable Drawer Toggle if not yet patched */}
            {!isPatchingApplied && (
              <button
                type="button"
                onClick={() => setIsCartOpen(!isCartOpen)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="h-3 w-3 text-amber-200" />
                <span>{Object.keys(rewrittenSections).length} Ready</span>
                <span className="text-[9px] text-teal-400 underline ml-0.5">
                  {isCartOpen ? "Hide" : "Details"}
                </span>
              </button>
            )}

            {/* Download buttons — shown after successful apply or batch tailor */}
            {isPatchingApplied && (downloadUrl || downloadId || documentId) && (
              <>
                <a
                  href={`${API_BASE_URL}${downloadUrl || `/api/v1/resume/download/${downloadId || documentId}`}?filename=${encodeURIComponent(
                    buildResumeFilename(
                      jobDescription,
                      user?.name,
                      customTargetRole || rewrittenSections["header"] || analysisResult?.overall_summary?.job_title,
                      file?.name
                    )
                  )}`}
                  download
                  onClick={() => setSuccessNotification("Downloading updated DOCX...")}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-white rounded-xl text-xs font-extrabold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95 border border-emerald-400/30"
                >
                  <WordLogoIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Download DOCX</span>
                </a>

                <a
                  href={`${API_BASE_URL}${downloadUrl ? `${downloadUrl}/pdf` : `/api/v1/resume/download/${downloadId || documentId}/pdf`}?filename=${encodeURIComponent(
                    buildResumeFilename(
                      jobDescription,
                      user?.name,
                      customTargetRole || rewrittenSections["header"] || analysisResult?.overall_summary?.job_title,
                      file?.name
                    ).replace(/\.docx$/i, ".pdf")
                  )}`}
                  download
                  onClick={() => setSuccessNotification("Downloading PDF...")}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 hover:scale-105 active:scale-95"
                >
                  <PdfLogoIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>Download PDF</span>
                </a>

                <button
                  type="button"
                  onClick={() => setIsPdfPreviewOpen(true)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer hover:scale-105 active:scale-95"
                >
                  <PdfLogoIcon className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span>Preview PDF</span>
                </button>
              </>
            )}

            {/* Apply / Re-Apply Button */}
            <button
              onClick={handleApplyRewrites}
              disabled={applyMutation.isPending}
              className={`px-3.5 py-1.5 ${isPatchingApplied
                ? "bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold"
                : "bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white border border-white/20 shadow-md shadow-emerald-500/20 text-xs font-black hover:scale-105 active:scale-95"
                } disabled:opacity-50 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer`}
            >
              {applyMutation.isPending ? (
                <>
                  <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Applying...</span>
                </>
              ) : isPatchingApplied ? (
                <>
                  <RefreshCw className="h-3 w-3 text-teal-400" />
                  <span>Re-Apply</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 text-amber-200 animate-pulse" />
                  <span>Apply to Resume</span>
                </>
              )}
            </button>

            {/* Dismiss Button */}
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
              title={isPatchingApplied ? "Clear and dismiss bar" : "Dismiss bar"}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Expandable Details Drawer inside floating dock */}
          {isCartOpen && !isPatchingApplied && (
            <div className="mt-2 pt-2 border-t border-slate-800/80 space-y-2 animate-fade-in-up">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-teal-400 uppercase tracking-wider">
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
                  className="text-[10px] text-rose-400 hover:text-rose-300 font-extrabold transition-colors select-none cursor-pointer"
                >
                  Clear All
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto pr-1">
                {Object.keys(rewrittenSections).map((secKey) => {
                  const originalSection = (analysisResult?.sections || []).find(
                    (s) => s.section_name.toLowerCase() === secKey
                  );
                  const displayName = originalSection?.section_name || secKey;

                  return (
                    <div
                      key={secKey}
                      className="flex items-center gap-1 text-[11px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-lg"
                    >
                      <span className="text-slate-200 font-bold truncate capitalize max-w-[120px]">
                        {displayName}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRevert(displayName)}
                        className="text-slate-400 hover:text-rose-400 p-0.5 transition-colors rounded hover:bg-slate-800 cursor-pointer"
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
        </div>
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
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        initialReason={subscriptionModalReason}
        initialPlan={subscriptionInitialPlan}
      />

      {/* Popover LinkedIn Chrome Extension Modal */}
      <ExtensionModal
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        onOpenSubscribe={() => openUpgradeModal("extension_upsell", "pro")}
        onOpenPreview={() => setIsExtensionPreviewModalOpen(true)}
      />

      {/* Popover LinkedIn Chrome Extension Interactive Preview Modal */}
      <ExtensionPreviewModal
        isOpen={isExtensionPreviewModalOpen}
        onClose={() => setIsExtensionPreviewModalOpen(false)}
        onOpenSubscribe={() => openUpgradeModal("extension_upsell", "pro")}
        isProOrElite={isProOrElite}
      />

      {/* Live PDF Preview Modal */}
      {isPdfPreviewOpen && (downloadId || documentId) && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
              <div className="flex items-center gap-2">
                <PdfLogoIcon className="h-5 w-5 shrink-0" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live PDF Preview</h3>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`${API_BASE_URL}/api/v1/resume/download/${downloadId || documentId}/pdf?filename=${encodeURIComponent(
                    buildResumeFilename(jobDescription, user?.name, customTargetRole || rewrittenSections["header"] || analysisResult?.overall_summary?.job_title, file?.name).replace(/\.docx$/i, ".pdf")
                  )}`}
                  download
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                >
                  <PdfLogoIcon className="h-4 w-4 shrink-0" /> Download PDF
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
                  <div className="h-8 w-8 border-3 border-teal-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-xs font-medium">Rendering live PDF preview...</p>
                </div>
              ) : pdfError ? (
                <div className="text-center p-8 space-y-3">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{pdfError}</p>
                  <a
                    href={`${API_BASE_URL}/api/v1/resume/download/${downloadId || documentId}/pdf`}
                    download
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
                  >
                    <PdfLogoIcon className="h-4 w-4 shrink-0" /> Download PDF File
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
            fetchDailyGoal().catch(() => { });
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
            refreshMe().catch(() => { });
          }}
        />
      )}

      {/* Structured Resume Completion Modal */}
      {masterResume && (
        <ResumeCompletionModal
          resume={masterResume}
          isOpen={isCompletionModalOpen}
          onClose={() => setIsCompletionModalOpen(false)}
          onSaved={(updated) => setMasterResume(updated)}
        />
      )}

      {/* AI Tailor Preview Modal */}
      {tailorResult && (
        <TailorPreviewModal
          isOpen={isTailorPreviewOpen}
          onClose={() => setIsTailorPreviewOpen(false)}
          tailoredResumeId={tailorResult.tailored_resume_id}
          tailoredResume={tailorResult.tailored_resume}
          diff={tailorResult.diff}
          jobTitle={customTargetRole || analysisResult?.overall_summary?.job_title || "Target Position"}
          sourceFormat={masterResume?.source_format || "docx"}
          fullName={masterResume?.contact_info?.full_name || undefined}
        />
      )}

      {/* ─── ⚡ 1-Click Auto-Tailor Scope & Settings Modal ────────────────── */}
      {isAutoTailorSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          {/* Backdrop click to close */}
          <div
            className="fixed inset-0"
            onClick={() => setIsAutoTailorSettingsOpen(false)}
          />

          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 text-slate-900 animate-scale-in">
            {/* Ambient glows */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Modal Header */}
            <div className="relative z-10 px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0 ring-1 ring-white/60">
                  <SlidersHorizontal className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
                    ⚡ Auto-Tailor Scope & Preferences
                    {(() => {
                      const configSections = getAutoTailorConfigSections();
                      const activeCount = configSections.filter((s) => isSectionTailorEnabled(s.id, s.defaultOn)).length;
                      return (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                          {activeCount} of {configSections.length} ON
                        </span>
                      );
                    })()}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Click each item to turn AI optimization ON or OFF. Locked items remain 100% untouched.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAutoTailorSettingsOpen(false)}
                className="h-9 w-9 rounded-xl bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center border border-slate-200 transition-colors cursor-pointer shadow-2xs"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Presets Action Bar */}
            <div className="relative z-10 px-6 py-3 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 hidden sm:inline">Quick Presets:</span>
              <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                <button
                  type="button"
                  onClick={handleEnableRecommendedSections}
                  className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="h-3 w-3 text-amber-200" />
                  Recommended
                </button>
                <button
                  type="button"
                  onClick={handleEnableAllSections}
                  className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Check className="h-3 w-3 text-emerald-600" />
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleDisableAllSections}
                  className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Lock className="h-3 w-3 text-slate-400" />
                  Lock All
                </button>
              </div>
            </div>

            {/* Scrollable Item List */}
            <div className="relative z-10 p-6 overflow-y-auto space-y-2.5 flex-1">
              {(() => {
                const configSections = getAutoTailorConfigSections();
                return configSections.map((sec) => {
                  const isEnabled = isSectionTailorEnabled(sec.id, sec.defaultOn);
                  const SecIcon = sec.icon;

                  return (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => handleToggleSectionTailoring(sec.id, sec.defaultOn)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-4 cursor-pointer select-none group ${isEnabled
                        ? "bg-teal-50/70 hover:bg-teal-50 border-teal-200/90 shadow-2xs"
                        : "bg-slate-50/70 hover:bg-slate-100/70 border-slate-200/80 opacity-75 hover:opacity-100"
                        }`}
                    >
                      {/* Left icon & text */}
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div
                          className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${isEnabled
                            ? "bg-[#E6F7F4] border-teal-200 text-teal-700 shadow-2xs"
                            : "bg-white border-slate-200 text-slate-400"
                            }`}
                        >
                          <SecIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-extrabold transition-colors ${isEnabled ? "text-[#0F172A] group-hover:text-teal-700" : "text-slate-600"}`}>
                              {sec.name}
                            </span>
                            {isEnabled ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                ACTIVE (ON)
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-500 border border-slate-200 flex items-center gap-1">
                                <Lock className="h-2.5 w-2.5" />
                                LOCKED (OFF)
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {sec.desc}
                          </p>
                        </div>
                      </div>

                      {/* Right iOS Toggle Switch */}
                      <div
                        className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 border ${isEnabled ? "bg-emerald-500 border-emerald-500" : "bg-slate-200 border-slate-300"
                          }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${isEnabled ? "translate-x-5.5" : "translate-x-0"
                            }`}
                        />
                      </div>
                    </button>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div className="relative z-10 px-6 py-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-slate-400" />
                Locked items are skipped during Auto-Tailoring.
              </p>
              <button
                type="button"
                onClick={() => setIsAutoTailorSettingsOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                Save Scope & Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issue Report & Feedback Modal */}
      <IssueReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialCategory={reportCategory}
        initialError={reportInitialError}
        activeDocumentId={documentId || user?.base_resume_id || null}
      />

      {/* Floating Feedback / Issue Report Button (Desktop Only — on mobile, accessed via Account tab) */}
      <div className="hidden lg:block fixed bottom-5 right-4 z-30 pb-safe">
        <button
          type="button"
          onClick={() => openIssueReport("bug")}
          className="touch-target flex items-center gap-2 px-3.5 py-2.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 hover:text-teal-600 border border-slate-200 shadow-lg hover:shadow-xl transition-all cursor-pointer text-xs font-bold group select-none hover:scale-105 active:scale-95"
          title="Encountered an issue or have feedback? Let us know!"
          style={{ paddingBottom: `calc(0.625rem + env(safe-area-inset-bottom, 0px))` }}
        >
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <LifeBuoy className="h-4 w-4 text-teal-600 group-hover:rotate-12 transition-transform" />
          <span className="hidden sm:inline">Report Issue / Feedback</span>
        </button>
      </div>

      {/* Mobile-First Bottom Navigation Bar (iOS / iPhone 16 Pro Ergonomics) */}
      <MobileBottomNav
        activeNavTab={activeNavTab}
        onSelectNavTab={switchNavTab}
        onOpenGoals={() => {
          if (!token) setShowAuthModal(true);
          else setIsHistoryModalOpen(true);
        }}
        onOpenProfile={() => {
          if (!token) setShowAuthModal(true);
          else setIsProfileMenuOpen(true);
        }}
        user={user}
        dailyGoal={dailyGoal}
      />
    </div>
  );
}
