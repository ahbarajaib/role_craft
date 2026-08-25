"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Send,
  AlertCircle,
  CheckCircle2,
  Bug,
  FileText,
  Sparkles,
  CreditCard,
  Lightbulb,
  MessageSquare,
  Loader2,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "./auth_provider";

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_BASE_URL = rawApiUrl.replace(/\/api\/v1\/?$/, "");

export interface IssueReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: "bug" | "formatting" | "ai_quality" | "payment" | "feature_request" | "general";
  initialError?: string | null;
  activeDocumentId?: string | null;
}

const CATEGORIES = [
  { id: "bug", label: "Bug / Error", icon: Bug, desc: "Something broke or crashed" },
  { id: "formatting", label: "Formatting", icon: FileText, desc: "DOCX or PDF layout issue" },
  { id: "ai_quality", label: "AI Output", icon: Sparkles, desc: "Low quality or inaccurate rewrite" },
  { id: "payment", label: "Credits / Billing", icon: CreditCard, desc: "Subscription or balance issue" },
  { id: "feature_request", label: "Feature Idea", icon: Lightbulb, desc: "Suggest an improvement" },
  { id: "general", label: "General", icon: MessageSquare, desc: "Other feedback or question" },
] as const;

export default function IssueReportModal({
  isOpen,
  onClose,
  initialCategory = "bug",
  initialError = null,
  activeDocumentId = null,
}: IssueReportModalProps) {
  const { user, token } = useAuth();
  const [category, setCategory] = useState<string>(initialCategory);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCategory(initialCategory);
      setSubmitError(null);
      setIsSuccess(false);
      if (user?.email) {
        setContactEmail(user.email);
      }
      if (initialError) {
        setSubject("Error encountered during operation");
        setDescription(`I encountered the following issue:\n${initialError}`);
      }
    }
  }, [isOpen, initialCategory, initialError, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || description.trim().length < 5) {
      setSubmitError("Please provide a bit more detail (at least 5 characters).");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    // Auto-capture technical diagnostics
    const diagnostics = {
      url: typeof window !== "undefined" ? window.location.href : "",
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : "",
      screen_size: typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
      active_document_id: activeDocumentId || user?.base_resume_id || null,
      initial_error_context: initialError || null,
      timestamp_local: new Date().toISOString(),
    };

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/support/report-issue`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          issue_type: category,
          subject: subject.trim() || undefined,
          description: description.trim(),
          user_email: contactEmail.trim() || undefined,
          context_data: diagnostics,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to submit report. Please try again.");
      }

      setIsSuccess(true);
      setTimeout(() => {
        setDescription("");
        setSubject("");
        setIsSuccess(false);
        onClose();
      }, 2500);
    } catch (err: any) {
      setSubmitError(err.message || "Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1050] flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg rounded-3xl p-5 sm:p-7 border border-teal-100 bg-white shadow-2xl flex flex-col space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>

        {isSuccess ? (
          <div className="py-8 text-center space-y-4 animate-fade-in-up">
            <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mx-auto shadow-sm">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900">Issue Report Received</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Thank you for helping us improve RoleCraft. Our engineering team has been notified via email.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-[10px] font-extrabold uppercase tracking-wider">
                <HelpCircle className="h-3 w-3" />
                Support &amp; Feedback
              </div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">
                Report an Issue or Feedback
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Encountered a problem or have an idea? Let us know and we'll look into it immediately.
              </p>
            </div>

            {/* Error banner */}
            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-fade-in-up">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Category Chips */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Category
                </label>
                <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                  {CATEGORIES.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id)}
                        className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer select-none ${
                          isSelected
                            ? "border-teal-600 bg-teal-50/70 text-[#0F172A] ring-1 ring-teal-500/30 shadow-xs"
                            : "border-slate-200 bg-white hover:border-teal-200 text-slate-600 hover:bg-slate-50/50"
                        }`}
                      >
                        <Icon className={`h-4 w-4 mb-1 ${isSelected ? "text-teal-600" : "text-slate-400"}`} />
                        <span className="text-xs font-bold leading-tight truncate">{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Subject Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Subject <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. DOCX alignment issue in summary"
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all"
                  disabled={isSubmitting}
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Description <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what happened, what you were doing, or your suggestion..."
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all resize-none leading-relaxed"
                  disabled={isSubmitting}
                  required
                />
              </div>

              {/* Contact Email (for replies) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Your Email <span className="text-slate-400 font-normal">(Optional for follow-up)</span>
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-slate-50 text-slate-900 border border-slate-200 focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none transition-all"
                  disabled={isSubmitting}
                />
              </div>

              {/* Auto-captured diagnostics info notice */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-500 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-teal-500 shrink-0" />
                <span>Technical details (browser, active document, error codes) will be attached automatically.</span>
              </div>

              {/* Submit CTA */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all cursor-pointer"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary px-5 py-2.5 text-xs flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Submit Report</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
