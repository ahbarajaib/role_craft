"use client";

import React from "react";
import { Check, Lock, SlidersHorizontal, Sparkles, X } from "lucide-react";

export interface ConfigSectionItem {
  id: string;
  name: string;
  desc: string;
  icon: any;
  defaultOn: boolean;
  category: string;
}

export interface AutoTailorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  configSections: ConfigSectionItem[];
  isSectionTailorEnabled: (sectionId: string, defaultOn?: boolean) => boolean;
  onToggleSectionTailoring: (sectionId: string, defaultOn?: boolean) => void;
  onEnableRecommended: () => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

export function AutoTailorSettingsModal({
  isOpen,
  onClose,
  configSections,
  isSectionTailorEnabled,
  onToggleSectionTailoring,
  onEnableRecommended,
  onEnableAll,
  onDisableAll,
}: AutoTailorSettingsModalProps) {
  if (!isOpen) return null;

  const activeCount = configSections.filter((s) => isSectionTailorEnabled(s.id, s.defaultOn)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} />

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
                ⚡ Auto-Tailor Scope &amp; Preferences
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                  {activeCount} of {configSections.length} ON
                </span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Click each item to turn AI optimization ON or OFF. Locked items remain 100% untouched.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
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
              onClick={onEnableRecommended}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs transition-all shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              Recommended
            </button>
            <button
              type="button"
              onClick={onEnableAll}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Check className="h-3 w-3 text-emerald-600" />
              Select All
            </button>
            <button
              type="button"
              onClick={onDisableAll}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Lock className="h-3 w-3 text-slate-400" />
              Lock All
            </button>
          </div>
        </div>

        {/* Scrollable Item List */}
        <div className="relative z-10 p-6 overflow-y-auto space-y-2.5 flex-1">
          {configSections.map((sec) => {
            const isEnabled = isSectionTailorEnabled(sec.id, sec.defaultOn);
            const SecIcon = sec.icon;

            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => onToggleSectionTailoring(sec.id, sec.defaultOn)}
                className={`w-full p-4 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-4 cursor-pointer select-none group ${
                  isEnabled
                    ? "bg-teal-50/70 hover:bg-teal-50 border-teal-200/90 shadow-2xs"
                    : "bg-slate-50/70 hover:bg-slate-100/70 border-slate-200/80 opacity-75 hover:opacity-100"
                }`}
              >
                {/* Left icon & text */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div
                    className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
                      isEnabled
                        ? "bg-[#E6F7F4] border-teal-200 text-teal-700 shadow-2xs"
                        : "bg-white border-slate-200 text-slate-400"
                    }`}
                  >
                    <SecIcon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`text-sm font-extrabold transition-colors ${
                          isEnabled ? "text-[#0F172A] group-hover:text-teal-700" : "text-slate-600"
                        }`}
                      >
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
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{sec.desc}</p>
                  </div>
                </div>

                {/* Right Toggle Switch */}
                <div
                  className={`w-12 h-6.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out shrink-0 border ${
                    isEnabled ? "bg-emerald-500 border-emerald-500" : "bg-slate-200 border-slate-300"
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out ${
                      isEnabled ? "translate-x-5.5" : "translate-x-0"
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>

        {/* Modal Footer */}
        <div className="relative z-10 px-6 py-4 border-t border-slate-100 bg-slate-50/80 backdrop-blur flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-slate-400" />
            Locked items are skipped during Auto-Tailoring.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            Save Scope &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
}

