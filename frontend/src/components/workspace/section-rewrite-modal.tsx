"use client";

import React from "react";
import { RefreshCw, RotateCcw, ShieldAlert, Sparkles, X } from "lucide-react";
import { diffWords } from "@/lib/diff";
import { cleanSectionModalTitle } from "@/lib/resume-utils";
import { SUMMARY_POSITIONING_PRESETS, isSummarySection } from "./section-card";

export interface SectionRewriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSection: string | null;
  isPending: boolean;
  isError: boolean;
  errorMessage?: string;
  rewriteData: any | null;
  draftText: string;
  onDraftTextChange: (text: string) => void;
  diffModeActive: boolean;
  onToggleDiffMode: (active: boolean) => void;
  modalPositioningMode: string;
  onSelectPositioningMode: (mode: string, instruction: string) => void;
  metricPercentage: string;
  onMetricPercentageChange: (val: string) => void;
  metricScale: string;
  onMetricScaleChange: (val: string) => void;
  userInstructions: string;
  onUserInstructionsChange: (val: string) => void;
  onRegenerate: () => void;
  onApply: (appliedText: string) => void;
}

export function SectionRewriteModal({
  isOpen,
  onClose,
  activeSection,
  isPending,
  isError,
  errorMessage,
  rewriteData,
  draftText,
  onDraftTextChange,
  diffModeActive,
  onToggleDiffMode,
  modalPositioningMode,
  onSelectPositioningMode,
  metricPercentage,
  onMetricPercentageChange,
  metricScale,
  onMetricScaleChange,
  userInstructions,
  onUserInstructionsChange,
  onRegenerate,
  onApply,
}: SectionRewriteModalProps) {
  if (!isOpen || !activeSection) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 p-5 bg-slate-50 dark:bg-slate-950/50">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal-600 dark:text-teal-400 animate-pulse" />
              AI Section Rewrite: {cleanSectionModalTitle(activeSection)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Review changes, hiring manager reasoning, and customize section text.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {isPending ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-10 w-10 border-4 border-teal-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-sm text-teal-600 dark:text-teal-400 font-semibold animate-pulse">
                AI hiring manager is polishing your section...
              </p>
              <p className="text-xs text-slate-500 max-w-xs text-center leading-relaxed">
                Analyzing full resume evidence context to safely embed required keywords.
              </p>
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <p className="text-sm text-rose-600 dark:text-rose-400 font-semibold">
                Failed to generate AI rewrite
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm text-center leading-relaxed">
                {errorMessage ||
                  "An unexpected error occurred while communicating with the AI. Please verify your connection or OpenAI API Key and try again."}
              </p>
              <button
                onClick={onRegenerate}
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
                  Compare &amp; Tailor Content
                </span>
                <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <button
                    onClick={() => onToggleDiffMode(false)}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      !diffModeActive
                        ? "bg-teal-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Edit Mode
                  </button>
                  <button
                    onClick={() => onToggleDiffMode(true)}
                    className={`px-3.5 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      diffModeActive
                        ? "bg-teal-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
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
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
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
                      {!diffModeActive && draftText !== rewriteData.rewritten_text && (
                        <button
                          type="button"
                          onClick={() => onDraftTextChange(rewriteData.rewritten_text)}
                          className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
                          title="Reset text to original AI generation"
                        >
                          <RotateCcw className="h-3 w-3" /> Reset AI
                        </button>
                      )}
                      <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 font-extrabold border border-teal-500/20">
                        ✨ Tailored &amp; Fact-Checked
                      </span>
                    </div>
                  </div>

                  {diffModeActive ? (
                    <div className="bg-gradient-to-br from-indigo-50/60 via-white to-purple-50/30 dark:from-indigo-950/30 dark:via-slate-900 dark:to-purple-950/20 p-4 sm:p-5 rounded-2xl border border-teal-200 dark:border-teal-500/30 text-xs sm:text-sm text-slate-800 dark:text-slate-200 leading-relaxed min-h-[220px] max-h-[360px] overflow-y-auto whitespace-pre-wrap select-all flex-1 shadow-md">
                      {diffWords(rewriteData.original_text, draftText).map((token, index) => {
                        if (token.added) {
                          return (
                            <span
                              key={index}
                              className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200 px-1 py-0.5 mx-0.5 rounded border-b-2 border-emerald-500 font-semibold shadow-2xs"
                            >
                              {token.value}
                            </span>
                          );
                        }
                        if (token.removed) {
                          return (
                            <span
                              key={index}
                              className="bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 line-through opacity-75 px-1 py-0.5 mx-0.5 rounded border-b border-rose-300"
                            >
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
                        value={draftText}
                        onChange={(e) => onDraftTextChange(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 p-4 sm:p-5 pb-10 rounded-2xl border-2 border-teal-500/40 hover:border-teal-500 focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 text-xs sm:text-sm text-slate-900 dark:text-slate-100 leading-relaxed min-h-[220px] max-h-[360px] overflow-y-auto focus:outline-none resize-none font-sans shadow-md transition-all"
                        placeholder="Loading rewrite text..."
                      />
                      <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[10px] text-slate-400 pointer-events-none select-none">
                        <span className="bg-slate-100 dark:bg-slate-900/90 px-2.5 py-0.5 rounded-md border border-slate-200 dark:border-slate-800 font-mono font-semibold text-slate-600 dark:text-slate-400">
                          {draftText.split("\n").filter((l) => l.trim()).length} Bullets •{" "}
                          {draftText.trim().split(/\s+/).length} Words
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
              {isSummarySection(activeSection) ? (
                <div className="bg-gradient-to-r from-teal-50/80 via-purple-50/60 to-slate-100 dark:from-indigo-950/40 dark:via-purple-950/30 dark:to-slate-950 p-4 rounded-xl border border-teal-200 dark:border-teal-500/20 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <div className="h-6 w-6 rounded-md bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center border border-teal-500/30">
                        <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                      </div>
                      <span className="text-xs font-bold text-[#0F172A] dark:text-teal-200">
                        Role &amp; Leadership Positioning Presets
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
                          onClick={() => onSelectPositioningMode(preset.id, preset.instruction)}
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
                        Google XYZ Formula &amp; Metric Synthesizer
                      </span>
                    </div>
                    <span className="text-[10px] bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-300 px-2 py-0.5 rounded-full border border-teal-200 dark:border-teal-500/20 font-mono">
                      Accomplished [X] as measured by [Y], by doing [Z]
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    Quantify your impact using Google&apos;s formula. Enter real numbers or scale metrics below so AI can seamlessly weave them into your achievement bullets.
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
                        onChange={(e) => onMetricPercentageChange(e.target.value)}
                        placeholder="e.g. '35% latency reduction', '$120k revenue growth'"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
                        disabled={isPending}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                        Scale / Scope / Volume [Y]
                      </label>
                      <input
                        type="text"
                        value={metricScale}
                        onChange={(e) => onMetricScaleChange(e.target.value)}
                        placeholder="e.g. 'across 15 microservices', '100k daily users'"
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-teal-500 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
                        disabled={isPending}
                      />
                    </div>
                  </div>

                  {/* Quick Preset Prompt Chips */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800/60 flex flex-wrap gap-2 items-center">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase">Presets:</span>
                    <button
                      type="button"
                      onClick={() =>
                        onUserInstructionsChange(
                          "Format all bullets strictly using Google's XYZ formula (Accomplished X as measured by Y, by doing Z)"
                        )
                      }
                      className="text-[10px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                    >
                      ⚡ Google XYZ Bullets
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUserInstructionsChange("Use high-impact active verbs and emphasize quantifiable metrics")
                      }
                      className="text-[10px] bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-800 transition-colors cursor-pointer"
                    >
                      📊 Action Verbs + Metrics
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUserInstructionsChange(
                          "Make bullet points concise, impactful, and tailored for senior engineering leadership"
                        )
                      }
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
                    onChange={(e) => onUserInstructionsChange(e.target.value)}
                    placeholder={
                      isSummarySection(activeSection)
                        ? "e.g. 'Emphasize architectural decision making and mentoring junior engineers', 'Keep under 70 words'"
                        : "e.g. 'make it shorter', 'use stronger action verbs', 'emphasize leadership'"
                    }
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 focus:border-teal-500 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition-colors"
                    disabled={isPending}
                  />
                  <button
                    type="button"
                    onClick={onRegenerate}
                    disabled={isPending}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-indigo-650 text-white rounded-xl text-xs font-semibold shadow-md transition-all duration-300 flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                </div>
              </div>

              {/* Hiring Manager Reasoning */}
              {rewriteData.reasoning && (
                <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200 dark:border-slate-900 space-y-2">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Hiring Manager Reasoning
                  </span>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed italic">
                    &ldquo;{rewriteData.reasoning}&rdquo;
                  </p>
                </div>
              )}

              {/* AI Changes Log */}
              {rewriteData.changes && rewriteData.changes.length > 0 && (
                <div className="space-y-3">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Edits Made
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {rewriteData.changes.map((change: any, idx: number) => {
                      const badgeColorMap: Record<string, string> = {
                        keyword:
                          "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 dark:border-emerald-500/30",
                        clarity:
                          "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20 dark:border-sky-500/30",
                        structure:
                          "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20 dark:border-teal-500/30",
                        emphasis:
                          "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 dark:border-amber-500/30",
                      };
                      const badgeColor =
                        badgeColorMap[change.type] ||
                        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20 dark:border-slate-500/30";

                      return (
                        <div
                          key={idx}
                          className="p-3 bg-slate-50 dark:bg-slate-950/30 rounded-lg border border-slate-200 dark:border-slate-900 flex items-start gap-2.5"
                        >
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded border uppercase font-medium shrink-0 mt-0.5 ${badgeColor}`}
                          >
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
            <div className="text-center py-12 text-slate-500 text-xs">No rewrite data available.</div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="border-t border-slate-200 dark:border-slate-800 p-5 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-950/30">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-semibold transition-all duration-300 cursor-pointer"
          >
            Cancel
          </button>
          {rewriteData && (
            <button
              onClick={() => onApply(draftText)}
              disabled={isPending}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white rounded-xl text-xs font-extrabold shadow-md transition-all duration-300 flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-white animate-pulse" />
              Apply Rewrite to Resume
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

