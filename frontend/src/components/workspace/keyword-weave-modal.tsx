"use client";

import React from "react";
import { Sparkles, X } from "lucide-react";

export interface KeywordWeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  keywords: { kw: string; type: "missing" | "supported" }[];
  selectedKeywords: string[];
  onToggleKeyword: (kw: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onWeave: (keywords: string[]) => void;
  isWeaving?: boolean;
}

export function KeywordWeaveModal({
  isOpen,
  onClose,
  keywords,
  selectedKeywords,
  onToggleKeyword,
  onSelectAll,
  onDeselectAll,
  onWeave,
  isWeaving = false,
}: KeywordWeaveModalProps) {
  if (!isOpen) return null;

  const supportedKeywords = keywords.filter((k) => k.type === "supported");
  const missingKeywords = keywords.filter((k) => k.type === "missing");

  return (
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
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick Select Bar */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 bg-slate-50/80">
          <span className="text-xs font-bold text-slate-600">
            {selectedKeywords.length} / {keywords.length} selected
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[10px] font-bold text-teal-600 hover:text-teal-700 px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-[#E6F7F4] border border-teal-200 transition-all cursor-pointer"
          >
            Select All
          </button>
          <button
            type="button"
            onClick={onDeselectAll}
            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-all cursor-pointer"
          >
            Deselect All
          </button>
        </div>

        {/* Keyword Checklist */}
        <div className="overflow-y-auto flex-1 p-5">
          {keywords.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No keywords available to weave.</p>
          ) : (
            <div className="space-y-4">
              {supportedKeywords.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider block">
                    🟡 Supported in Evidence
                  </span>
                  <div className="space-y-1.5">
                    {supportedKeywords.map((item, i) => {
                      const isChecked = selectedKeywords.includes(item.kw);
                      return (
                        <label
                          key={i}
                          onClick={() => onToggleKeyword(item.kw)}
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
                          >
                            {isChecked && (
                              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path
                                  d="M1.5 5L4 7.5L8.5 2.5"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              isChecked ? "text-slate-900" : "text-slate-400"
                            }`}
                          >
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

              {missingKeywords.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider block">
                    🔴 Missing from Resume
                  </span>
                  <div className="space-y-1.5">
                    {missingKeywords.map((item, i) => {
                      const isChecked = selectedKeywords.includes(item.kw);
                      return (
                        <label
                          key={i}
                          onClick={() => onToggleKeyword(item.kw)}
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
                          >
                            {isChecked && (
                              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                <path
                                  d="M1.5 5L4 7.5L8.5 2.5"
                                  stroke="currentColor"
                                  strokeWidth="1.8"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </div>
                          <span
                            className={`text-sm font-semibold ${
                              isChecked ? "text-slate-900" : "text-slate-400"
                            }`}
                          >
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
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedKeywords.length === 0 || isWeaving}
            onClick={() => onWeave(selectedKeywords)}
            className="flex-1 py-2.5 rounded-xl text-xs font-extrabold bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5 animate-pulse" />
            Weave {selectedKeywords.length} Selected Keyword{selectedKeywords.length !== 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

