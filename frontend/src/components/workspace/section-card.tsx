"use client";

import React, { useState, useEffect } from "react";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Edit,
  Lock,
  RefreshCw,
  RotateCcw,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import type { ReviewedSection } from "@/lib/api";
import type { StructuredResume } from "@/lib/structured_resume_api";
import { parseBulletsFromText } from "@/lib/resume-utils";
import { RenderSegregatedContent } from "./segregated-content";

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
    desc: "Position senior engineering depth for lead ownership: architecture, code reviews, mentoring, and sprint delivery.",
    instruction:
      "Position candidate for Team Lead: customize opening as Team Lead / Lead Developer with verified software engineering background; emphasize architecture, code reviews, developer mentorship, and sprint delivery while locking verified years of experience verbatim.",
  },
  {
    id: "hands_on_tech_lead",
    label: "Hands-on Tech Lead",
    badge: "👑 Hands-on Tech Lead",
    shortLabel: "Tech Lead",
    icon: "👑",
    desc: "Dual-track credibility: deep coding craftsmanship paired with technical direction, system architecture, and engineering standards.",
    instruction:
      "Position as a Hands-on Tech Lead with dual-track excellence in core coding, system architecture, standards, and technical direction, grounded strictly in candidate's verified background and actual years of experience.",
  },
  {
    id: "tech_project_manager",
    label: "Technical Project Manager",
    badge: "📊 Technical Project Manager",
    shortLabel: "Project Manager",
    icon: "📊",
    desc: "Position technical engineering depth for Agile delivery, roadmap planning, sprint execution, and stakeholder communication.",
    instruction:
      "Position candidate as a Technical Project Manager: customize opening as Technical Project Manager with verified software engineering and delivery background; emphasize Agile/Scrum execution, roadmap alignment, task estimation, risk management, and stakeholder communication while locking verified years of experience verbatim.",
  },
  {
    id: "senior_ic",
    label: "Senior IC (Specialist)",
    badge: "💻 Senior IC",
    shortLabel: "Senior IC",
    icon: "💻",
    desc: "Pure deep technical execution, resilient architecture, and specialized engineering problem solving.",
    instruction:
      "Position as a deep technical Senior Individual Contributor; emphasize technical mastery, resilient architecture design, and complex implementation, preserving verified years of experience and factual stack without inflation.",
  },
  {
    id: "default",
    label: "Target Job Match",
    badge: "🎯 Job Match",
    shortLabel: "Job Match",
    icon: "🎯",
    desc: "Direct alignment matching the target job description title and core technical requirements.",
    instruction:
      "Align professional summary truthfully with the target role; preserve verified years of experience and actual background without fabricating unearned titles or missing technologies.",
  },
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

export interface SectionCardProps {
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
  diffViewMode?: "tailored" | "split";
}

export function SectionCard({
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
  diffViewMode = "tailored",
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

  // Modern clean status-based card styles
  const statusStyles = {
    improve: "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 shadow-xs",
    keep: "border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900 shadow-xs",
    reduce_emphasis: "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 opacity-80",
  };

  const badgeStyles = {
    improve: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-semibold",
    keep: "bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-200 dark:border-teal-800 font-semibold",
    reduce_emphasis: "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 font-medium",
  };

  const priorityStyles = {
    high: "bg-rose-50 text-rose-700 border-rose-200 font-black",
    medium: "bg-amber-50 text-amber-700 border-amber-200 font-bold",
    low: "bg-slate-100 text-slate-600 border-slate-200 font-medium",
  };

  const parsedBullets = rewrittenText ? parseBulletsFromText(rewrittenText) : [];
  const hasBullets = parsedBullets.some((b) => b.isBullet);

  return (
    <div
      key={`${section.section_name}-${idx}`}
      id={`section-card-${section.section_name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
      className={`rounded-2xl border transition-all duration-200 bg-white dark:bg-slate-900 shadow-xs hover:shadow-sm ${statusStyles[section.review_status]}`}
    >
      {/* Clickable Header for Collapsing */}
      <div
        onClick={onToggle}
        className="flex items-center justify-between gap-3 p-3.5 sm:p-4 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span
            className={`px-2 py-0.5 text-[10px] font-bold rounded-md border uppercase tracking-wider shrink-0 flex items-center gap-1.5 ${badgeStyles[section.review_status]}`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                section.review_status === "improve"
                  ? "bg-amber-500"
                  : section.review_status === "keep"
                    ? "bg-teal-500"
                    : "bg-slate-400"
              }`}
            />
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
              <span
                className={`inline-flex items-center gap-1 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full border shrink-0 ${
                  isPatchingApplied
                    ? "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/90 border-emerald-300"
                    : "text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/90 border-amber-300"
                }`}
              >
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
                    {SUMMARY_POSITIONING_PRESETS.find((p) => p.id === selectedPositioning)?.badge || "🚀 Team Lead"}
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
              className={`px-2 py-1 rounded-lg text-[10px] font-extrabold transition-all flex items-center gap-1 cursor-pointer select-none ${
                isTailoringEnabled
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
                    {isSummary
                      ? `AI Positioning Summary for ${SUMMARY_POSITIONING_PRESETS.find((p) => p.id === selectedPositioning)?.shortLabel || "Leadership"}...`
                      : `AI Tailoring ${section.section_name}...`}
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

              {/* Content Display: Full-width Tailored or Side-by-Side Split */}
              {diffViewMode === "tailored" ? (
                <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-teal-500 inline-block" />
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                        Tailored Content for Target Role
                      </span>
                    </div>
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      High-impact XYZ metrics &amp; ATS keywords applied
                    </span>
                  </div>
                  <div className="pt-1 space-y-2">
                    <RenderSegregatedContent
                      lines={rewrittenText.split("\n")}
                      masterResume={masterResume}
                      sectionName={section.section_name}
                      variant="emerald"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left Column: Original Resume Text */}
                  <div className="bg-slate-50/80 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3 flex flex-col">
                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-2">
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />
                        Original Resume Text (Before)
                      </span>
                    </div>
                    <div className="pt-1 space-y-2 flex-1">
                      <RenderSegregatedContent
                        lines={
                          section.evidence_used && section.evidence_used.length > 0
                            ? section.evidence_used
                            : [section.section_name]
                        }
                        masterResume={masterResume}
                        sectionName={section.section_name}
                        variant="rose"
                      />
                    </div>
                  </div>

                  {/* Right Column: AI Tailored Rewritten Text */}
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-teal-200/90 dark:border-teal-800/60 shadow-2xs space-y-3 flex flex-col">
                    <div className="flex items-center justify-between border-b border-teal-100 dark:border-teal-900/40 pb-2">
                      <span className="text-[10px] font-bold text-teal-800 dark:text-teal-300 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-teal-500 inline-block animate-pulse" />
                        AI Tailored &amp; Rewritten Text (After)
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
              )}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 pt-1">
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
                  Mode: <strong className="text-teal-700 dark:text-teal-300 font-bold">{SUMMARY_POSITIONING_PRESETS.find((p) => p.id === selectedPositioning)?.label}</strong>
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
                    <span>Tailor Summary ({SUMMARY_POSITIONING_PRESETS.find((p) => p.id === selectedPositioning)?.shortLabel})</span>
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
              className={`mt-2 w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2.5 shadow-md transition-all duration-200 select-none ${
                inlineLoadingSections[section.section_name]
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
                    {isSummary
                      ? `Generating AI Summary for ${SUMMARY_POSITIONING_PRESETS.find((p) => p.id === selectedPositioning)?.shortLabel}...`
                      : "Generating AI Rewrite..."}
                  </span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-300" />
                  <span>
                    {isSummary
                      ? `Tailor Summary for ${SUMMARY_POSITIONING_PRESETS.find((p) => p.id === selectedPositioning)?.shortLabel || "Team Lead"} with AI`
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

