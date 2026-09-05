"use client";

import React, { useState } from "react";
import { useAuth } from "./auth_provider";
import { downloadExtensionZip } from "@/lib/api";
import {
  X,
  Download,
  CheckCircle2,
  Sparkles,
  Lock,
  ExternalLink,
  ShieldCheck,
  Zap,
  ArrowRight,
  Copy,
  AlertCircle,
  HelpCircle,
  FileCode2,
} from "lucide-react";

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubscribe?: () => void;
}

export default function ExtensionModal({
  isOpen,
  onClose,
  onOpenSubscribe,
}: ExtensionModalProps) {
  const { user, token } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const planType = (user?.plan_type || "free").toLowerCase();
  const isProOrElite =
    planType === "pro" ||
    planType === "elite" ||
    user?.subscription_status === "active";

  const handleDownload = async () => {
    if (!token) {
      setErrorMessage("Please log in to download the extension.");
      return;
    }
    try {
      setIsDownloading(true);
      setErrorMessage(null);
      const blob = await downloadExtensionZip(token);
      
      // Trigger browser download
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "rolecraft-linkedin-copier.zip";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 5000);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to download extension archive.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header with Gradient Accent */}
        <div className="relative bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-6 sm:p-7">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-teal-500/20 border border-teal-400/40 flex items-center justify-center shadow-inner">
              <Zap className="h-6 w-6 text-teal-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight">
                  LinkedIn 1-Click Job Copier
                </h2>
                {isProOrElite ? (
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-200 text-[10px] font-extrabold uppercase tracking-wider">
                    ✦ Pro Active
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-200 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <Lock className="h-2.5 w-2.5" /> Pro Exclusive
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-teal-100/80 mt-0.5">
                Companion Chrome Extension for high-speed job applications
              </p>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {isProOrElite ? (
            /* ============================================================ */
            /* PRO & ELITE MEMBER VIEW                                      */
            /* ============================================================ */
            <div className="space-y-6">
              {/* Value Summary */}
              <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 flex items-start gap-3">
                <div className="p-2 rounded-xl bg-teal-100/80 text-teal-800 shrink-0">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-bold text-teal-950 text-sm">
                    Included with your {planType.toUpperCase()} Subscription
                  </p>
                  <p className="text-teal-800 leading-relaxed">
                    Extract clean, formatted job details directly from any LinkedIn job posting in 1 click without ads, UI text, or manual formatting.
                  </p>
                </div>
              </div>

              {/* Download Action Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 text-center space-y-3">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-extrabold text-sm transition-all shadow-md shadow-teal-600/20 hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isDownloading ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating Extension Package...</span>
                    </>
                  ) : downloadSuccess ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-200" />
                      <span>Downloaded rolecraft-linkedin-copier.zip!</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>Download Extension (.zip)</span>
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-500">
                  Version 1.0.0 • Manifest V3 • Zero telemetry • Safe & Private
                </p>
              </div>

              {/* Step-by-Step Installation Guide */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                  <FileCode2 className="h-4 w-4 text-teal-600" /> 3-Step Setup Guide (15 Seconds)
                </h3>
                
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <span className="flex h-5 w-5 rounded-full bg-teal-100 text-teal-800 font-black text-[11px] items-center justify-center shrink-0">
                      1
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">Unzip the archive</p>
                      <p className="text-slate-600 text-[11px] mt-0.5">
                        Double-click <code className="bg-slate-100 px-1.5 py-0.5 rounded text-teal-700 font-mono">rolecraft-linkedin-copier.zip</code> to extract the extension folder.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <span className="flex h-5 w-5 rounded-full bg-teal-100 text-teal-800 font-black text-[11px] items-center justify-center shrink-0">
                      2
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">Open Chrome Extensions</p>
                      <p className="text-slate-600 text-[11px] mt-0.5">
                        Go to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-teal-700 font-mono">chrome://extensions</code> in your Chrome address bar and toggle on <strong className="text-slate-800">Developer mode</strong> (top-right).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <span className="flex h-5 w-5 rounded-full bg-teal-100 text-teal-800 font-black text-[11px] items-center justify-center shrink-0">
                      3
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">Load Unpacked</p>
                      <p className="text-slate-600 text-[11px] mt-0.5">
                        Click <strong className="text-slate-800">Load unpacked</strong> in the top-left, and select the extracted folder. You’re all set!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* How to Use Note */}
              <div className="rounded-xl p-3 bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  Visit any LinkedIn Job page to see the <strong>"Copy Job Details"</strong> button.
                </span>
              </div>
            </div>
          ) : (
            /* ============================================================ */
            /* FREE / GUEST VIEW (UPGRADE TEASER)                           */
            /* ============================================================ */
            <div className="space-y-6">
              {/* Problem vs Solution Hook */}
              <div className="text-center space-y-2">
                <div className="inline-flex h-12 w-12 rounded-2xl bg-teal-50 border border-teal-200 items-center justify-center text-teal-600 mb-1">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h3 className="text-base sm:text-lg font-black text-slate-900">
                  Stop Manually Copying LinkedIn Jobs
                </h3>
                <p className="text-xs text-slate-600 max-w-sm mx-auto">
                  Applying to 10+ jobs a day? Our Chrome Extension extracts titles, companies, and clean descriptions directly to your clipboard in 1 click.
                </p>
              </div>

              {/* Feature Highlights Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Auto-Expands Descriptions
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Clicks "Show more" automatically so you never miss critical requirements.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Zero UI Junk
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Strips "Easy Apply", ads, and "About the company" text for 100% clean ATS parsing.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> 1-Click Clipboard
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Structured with title, company, URL, and requirements ready for RoleCraft.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" /> Saves 5+ Hrs / Week
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Apply 3x faster without breaking your focus between tabs.
                  </p>
                </div>
              </div>

              {/* Upgrade CTA */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-900 to-slate-900 text-white space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-300">
                      ✦ Pro Plan Feature
                    </span>
                    <p className="text-sm font-bold mt-0.5">
                      Included with Pro &amp; Elite Subscriptions
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-white">₹399</span>
                    <span className="text-[10px] text-teal-200 block">/ month</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    if (onOpenSubscribe) onOpenSubscribe();
                  }}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-teal-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Upgrade to Pro to Unlock Extension</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
