"use client";

import React, { useState } from "react";
import {
  X,
  Sparkles,
  Zap,
  CheckCircle2,
  Lock,
  ArrowRight,
  Copy,
  Info,
  Check,
} from "lucide-react";

interface ExtensionPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubscribe?: () => void;
  isProOrElite?: boolean;
}

export default function ExtensionPreviewModal({
  isOpen,
  onClose,
  onOpenSubscribe,
  isProOrElite = false,
}: ExtensionPreviewModalProps) {
  const [copiedDemo, setCopiedDemo] = useState(false);

  if (!isOpen) return null;

  const handleDemoClick = () => {
    setCopiedDemo(true);
    setTimeout(() => setCopiedDemo(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 text-white p-5 sm:p-6 border-b border-teal-800/40">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center text-teal-300 shadow-inner shrink-0">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  LinkedIn 1-Click Copier in Action
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                  <Lock className="h-2.5 w-2.5" /> Pro Exclusive
                </span>
                <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-[10px] font-medium">
                  Chrome Extension
                </span>
              </div>
              <p className="text-xs text-teal-100/80 mt-1">
                Adds a smart copy button directly onto every LinkedIn job page.
              </p>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          
          {/* Visual Callout Notice */}
          <div className="bg-teal-50/80 border border-teal-200/90 rounded-2xl p-3 sm:p-4 text-xs flex items-start gap-3">
            <Info className="h-4 w-4 text-teal-700 shrink-0 mt-0.5" />
            <div className="text-slate-700 leading-relaxed">
              <strong className="text-teal-950 font-bold">How it looks on LinkedIn:</strong>{" "}
              When installed, the extension seamlessly injects our signature{" "}
              <strong className="text-teal-800">"Copy Job Details"</strong> button right next to LinkedIn's native "Easy Apply" button.
            </div>
          </div>

          {/* Realistic LinkedIn Job Card Simulation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold uppercase tracking-wider px-1">
              <span>Interactive LinkedIn Preview</span>
              <span className="text-teal-600 font-semibold normal-case">Try clicking the button below ↓</span>
            </div>

            <div className="rounded-2xl border-2 border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-4 relative overflow-hidden font-sans">
              
              {/* Simulated LinkedIn Browser Bar */}
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-[11px] text-slate-400">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 font-mono text-[10px] text-slate-500 truncate bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60">
                  linkedin.com/jobs/view/4102948291...
                </span>
              </div>

              {/* Job Card Header */}
              <div className="flex items-start gap-3.5">
                <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-700 to-indigo-800 text-white flex items-center justify-center font-black text-lg shadow-sm shrink-0">
                  R
                </div>
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                    Senior Software Engineer (Frontend / Full Stack)
                  </h3>
                  <p className="text-xs font-semibold text-slate-700">
                    Razorpay · Full-time · Mid-Senior level
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Bengaluru, Karnataka, India (Hybrid) · 2 days ago · 87 applicants
                  </p>
                </div>
              </div>

              {/* LinkedIn Action Buttons + RoleCraft Extension Button */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                {/* Native LinkedIn Easy Apply */}
                <button
                  type="button"
                  disabled
                  className="px-4 py-1.5 rounded-full bg-[#0a66c2] text-white text-xs font-bold shadow-xs cursor-default"
                >
                  Easy Apply
                </button>

                {/* Native LinkedIn Save */}
                <button
                  type="button"
                  disabled
                  className="px-4 py-1.5 rounded-full border border-[#0a66c2] text-[#0a66c2] text-xs font-bold cursor-default"
                >
                  Save
                </button>

                {/* ✦ The Injected RoleCraft Companion Button ✦ */}
                <div className="relative group">
                  <button
                    type="button"
                    onClick={handleDemoClick}
                    className="touch-target relative px-3.5 py-1.5 rounded-full bg-gradient-to-r from-teal-600 via-teal-500 to-teal-600 hover:from-teal-500 hover:to-teal-400 text-white text-xs font-extrabold shadow-md shadow-teal-500/25 flex items-center gap-1.5 transition-all transform hover:scale-105 active:scale-95 cursor-pointer ring-2 ring-teal-400/60 ring-offset-1 ring-offset-white"
                  >
                    {copiedDemo ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-200 animate-in zoom-in" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-teal-100" />
                        <span>Copy Job Details</span>
                      </>
                    )}
                  </button>

                  {/* Pulsing Callout Annotation */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap px-2 py-0.5 rounded-full bg-slate-900 text-teal-300 text-[10px] font-bold shadow-md flex items-center gap-1 border border-teal-400/40 animate-bounce">
                    <span>✦ Injected by RoleCraft</span>
                  </div>
                </div>
              </div>

              {/* Simulated Job Description Snippet */}
              <div className="pt-7 pb-1 text-[11px] text-slate-600 space-y-1.5 border-t border-slate-100">
                <p className="font-bold text-slate-800 text-xs">About the job</p>
                <p className="line-clamp-2 text-slate-500 leading-relaxed">
                  We are looking for a Senior Software Engineer to build resilient, high-speed payment flows. 
                  You will partner with product design and backend infrastructure teams...
                </p>
                <span className="text-teal-700 font-bold inline-block text-[10px]">
                  ✓ Auto-expands "See more" &amp; strips recruiter junk for 100% clean ATS analysis
                </span>
              </div>
            </div>
          </div>

          {/* 4 Feature Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" /> 1-Click Clipboard Copy
              </p>
              <p className="text-[11px] text-slate-600">
                Copies job title, company, requirements, and spec directly formatted for RoleCraft.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" /> Auto-Expands "See More"
              </p>
              <p className="text-[11px] text-slate-600">
                Never misses truncated requirements or hidden technical skills.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" /> Zero UI Junk &amp; Ads
              </p>
              <p className="text-[11px] text-slate-600">
                Strips "About the company", UI buttons, and ads for clean ATS keyword matching.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
              <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" /> Apply 3x Faster
              </p>
              <p className="text-[11px] text-slate-600">
                Saves 5+ hours every week by eliminating tedious copy-pasting across tabs.
              </p>
            </div>
          </div>

          {/* Footer Call to Action */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 text-white space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-300 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Unlocked with Pro &amp; Elite
                </span>
                <p className="text-sm font-bold mt-0.5 text-white">
                  Included Free with Pro Membership
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg sm:text-xl font-black text-white">₹399</span>
                <span className="text-[10px] text-teal-200 block">/ month (or ₹79 24h pass)</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenSubscribe) onOpenSubscribe();
              }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-slate-950 font-black text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
            >
              <span>Upgrade to Pro to Unlock Extension</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
