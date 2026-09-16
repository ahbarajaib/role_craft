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
  Zap,
  ArrowRight,
  AlertCircle,
  FileCode2,
  Info,
} from "lucide-react";

interface ExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSubscribe?: () => void;
  onOpenPreview?: () => void;
}

// ── Derived plan helpers ──────────────────────────────────────────────────────

function getPlanFlags(planType: string, subscriptionStatus?: string | null) {
  const plan = planType.toLowerCase();
  // Legacy: active subscription without explicit plan → treat as pro
  const effectivePlan =
    plan === "free" && subscriptionStatus === "active" ? "pro" : plan;
  return {
    isLinkedInEligible: ["pro", "elite"].includes(effectivePlan),
    isIndeedEligible: effectivePlan === "elite",
    effectivePlan,
  };
}

// ── Extension Card ────────────────────────────────────────────────────────────

interface ExtensionCardProps {
  /** "linkedin" | "indeed" */
  feature: string;
  label: string;
  description: string;
  planRequired: string;          // e.g. "Pro & Elite" | "Elite"
  eligible: boolean;
  isDownloading: boolean;
  downloadSuccess: boolean;
  zipFilename: string;
  onDownload: () => void;
  onOpenSubscribe?: () => void;
  onClose: () => void;
  onOpenPreview?: () => void;    // LinkedIn-only preview
}

function ExtensionCard({
  feature,
  label,
  description,
  planRequired,
  eligible,
  isDownloading,
  downloadSuccess,
  zipFilename,
  onDownload,
  onOpenSubscribe,
  onClose,
  onOpenPreview,
}: ExtensionCardProps) {
  const isLinkedIn = feature === "linkedin";

  return (
    <div
      className={`rounded-2xl border p-4 space-y-3 transition-all ${
        eligible
          ? "bg-teal-50/60 border-teal-200/80"
          : "bg-slate-50 border-slate-200 opacity-80"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${
              isLinkedIn
                ? "bg-[#0a66c2]/10 text-[#0a66c2]"
                : "bg-[#2557a7]/10 text-[#2557a7]"
            }`}
          >
            {isLinkedIn ? (
              /* LinkedIn icon */
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"/>
              </svg>
            ) : (
              /* Indeed "i" icon approximation */
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2V11h2v6zm0-8h-2V7h2v2z"/>
              </svg>
            )}
          </div>
          <div>
            <p className="text-xs font-black text-slate-900">{label}</p>
            <p className="text-[11px] text-slate-500">{description}</p>
          </div>
        </div>

        {eligible ? (
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wide shrink-0">
            Unlocked
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wide flex items-center gap-1 shrink-0">
            <Lock className="h-2.5 w-2.5" />
            {planRequired}
          </span>
        )}
      </div>

      {/* Action */}
      {eligible ? (
        <button
          onClick={onDownload}
          disabled={isDownloading}
          className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-extrabold text-xs transition-all shadow-sm shadow-teal-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
        >
          {isDownloading ? (
            <>
              <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Generating Package…</span>
            </>
          ) : downloadSuccess ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-200" />
              <span>Downloaded {zipFilename}!</span>
            </>
          ) : (
            <>
              <Download className="h-3.5 w-3.5" />
              <span>Download Extension (.zip)</span>
            </>
          )}
        </button>
      ) : (
        <button
          onClick={() => {
            onClose();
            onOpenSubscribe?.();
          }}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Upgrade to {planRequired} to Unlock</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      )}

      {/* LinkedIn preview link */}
      {isLinkedIn && !eligible && onOpenPreview && (
        <button
          type="button"
          onClick={() => {
            onClose();
            onOpenPreview();
          }}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] text-teal-700 font-bold hover:text-teal-900 transition-colors cursor-pointer"
        >
          <Info className="h-3 w-3" />
          <span>See interactive LinkedIn preview →</span>
        </button>
      )}
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function ExtensionModal({
  isOpen,
  onClose,
  onOpenSubscribe,
  onOpenPreview,
}: ExtensionModalProps) {
  const { user, token } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const planType = (user?.plan_type || "free").toLowerCase();
  const { isLinkedInEligible, isIndeedEligible, effectivePlan } = getPlanFlags(
    planType,
    user?.subscription_status
  );
  const hasAnyAccess = isLinkedInEligible || isIndeedEligible;

  const handleDownload = async () => {
    if (!token) {
      setErrorMessage("Please log in to download the extension.");
      return;
    }
    try {
      setIsDownloading(true);
      setErrorMessage(null);
      const blob = await downloadExtensionZip(token);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Elite gets both, Pro gets linkedin only
      a.download = isIndeedEligible
        ? "rolecraft-extensions.zip"
        : "rolecraft-linkedin-copier.zip";
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
        {/* Header */}
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
                  Browser Extensions
                </h2>
                {hasAnyAccess && (
                  <span className="px-2.5 py-0.5 rounded-full bg-teal-500/20 border border-teal-400/40 text-teal-200 text-[10px] font-extrabold uppercase tracking-wider">
                    ✦ {effectivePlan.toUpperCase()} Active
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-teal-100/80 mt-0.5">
                1-Click job copying on LinkedIn &amp; Indeed
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Extension cards */}
          <div className="space-y-3">
            <ExtensionCard
              feature="linkedin"
              label="LinkedIn 1-Click Job Copier"
              description="Copies title, company, location & full description"
              planRequired="Pro & Elite"
              eligible={isLinkedInEligible}
              isDownloading={isDownloading && !isIndeedEligible}
              downloadSuccess={downloadSuccess && !isIndeedEligible}
              zipFilename="rolecraft-linkedin-copier.zip"
              onDownload={handleDownload}
              onOpenSubscribe={onOpenSubscribe}
              onClose={onClose}
              onOpenPreview={onOpenPreview}
            />

            <ExtensionCard
              feature="indeed"
              label="Indeed Job Title Copier"
              description="Copies the job title from any Indeed job page in 1 click"
              planRequired="Elite"
              eligible={isIndeedEligible}
              isDownloading={isDownloading && isIndeedEligible}
              downloadSuccess={downloadSuccess && isIndeedEligible}
              zipFilename="rolecraft-extensions.zip"
              onDownload={handleDownload}
              onOpenSubscribe={onOpenSubscribe}
              onClose={onClose}
            />
          </div>

          {/* What's in the ZIP note */}
          {hasAnyAccess && (
            <p className="text-[11px] text-slate-400 text-center">
              {isIndeedEligible
                ? "Your download will include both extensions in a single ZIP."
                : "Your download includes the LinkedIn extension."}
            </p>
          )}

          {/* Installation steps (shown only when at least one eligible) */}
          {hasAnyAccess && (
            <div className="space-y-2.5 pt-1">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                <FileCode2 className="h-4 w-4 text-teal-600" /> 3-Step Setup (15 Seconds Each)
              </h3>
              <div className="space-y-2 text-xs">
                {[
                  {
                    step: "1",
                    title: "Unzip the archive",
                    detail: (
                      <>
                        Extract the downloaded <code className="bg-slate-100 px-1.5 py-0.5 rounded text-teal-700 font-mono">.zip</code> — you'll get one folder per extension.
                      </>
                    ),
                  },
                  {
                    step: "2",
                    title: "Open Chrome Extensions",
                    detail: (
                      <>
                        Go to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-teal-700 font-mono">chrome://extensions</code> and toggle on <strong className="text-slate-800">Developer mode</strong> (top-right).
                      </>
                    ),
                  },
                  {
                    step: "3",
                    title: "Load Unpacked",
                    detail: (
                      <>
                        Click <strong className="text-slate-800">Load unpacked</strong> and select each extension folder individually. Done!
                      </>
                    ),
                  },
                ].map(({ step, title, detail }) => (
                  <div key={step} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200">
                    <span className="flex h-5 w-5 rounded-full bg-teal-100 text-teal-800 font-black text-[11px] items-center justify-center shrink-0">
                      {step}
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{title}</p>
                      <p className="text-slate-600 text-[11px] mt-0.5">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Free-user upgrade CTA */}
          {!hasAnyAccess && (
            <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-900 to-slate-900 text-white space-y-3 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-teal-300">
                    ✦ Pro Plan Feature
                  </span>
                  <p className="text-sm font-bold mt-0.5">
                    LinkedIn Copier included with Pro &amp; Elite
                  </p>
                  <p className="text-xs text-teal-200 mt-0.5">
                    Indeed Copier included with Elite
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-lg font-black text-white">₹399</span>
                  <span className="text-[10px] text-teal-200 block">/ month</span>
                </div>
              </div>

              <button
                onClick={() => {
                  onClose();
                  onOpenSubscribe?.();
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-teal-400 hover:from-teal-400 hover:to-teal-300 text-teal-950 font-black text-xs transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Upgrade to Pro to Unlock Extensions</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Version footer */}
          <p className="text-center text-[10px] text-slate-400">
            Version 1.0.0 • Manifest V3 • Zero telemetry • Safe &amp; Private
          </p>
        </div>
      </div>
    </div>
  );
}
