"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X, CheckCircle2, AlertCircle, Save, ChevronRight, Loader2,
  User, Mail, Phone, MapPin, Link, GitBranch, Globe, Briefcase, Sparkles,
} from "lucide-react";
import {
  StructuredResume,
  ContactInfo,
  updateStructuredResume,
} from "@/lib/structured_resume_api";
import ResumeSectionEditor from "@/components/resume_section_editor";

interface ResumeCompletionModalProps {
  resume: StructuredResume;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: StructuredResume) => void;
}

// Compute which fields are still empty/unparsed
function getActiveUnparsedFields(resume: StructuredResume): string[] {
  const raw = resume.parse_confidence?.low_confidence_fields ?? [];
  return raw.filter((fieldPath) => {
    const f = fieldPath.toLowerCase();
    const ci = resume.contact_info;
    if (f.includes("full_name")) return !ci?.full_name?.trim();
    if (f.includes("email")) return !ci?.email?.trim();
    if (f.includes("phone")) return !ci?.phone?.trim();
    if (f.includes("location")) return !ci?.location?.trim();
    if (f.includes("linkedin")) return !ci?.linkedin_url?.trim();
    if (f.includes("portfolio")) return !ci?.portfolio_url?.trim();
    if (f.includes("github")) return !ci?.github_url?.trim();
    if (f.includes("job_title") && f.includes("contact")) return !ci?.job_title?.trim();
    const secMatch = f.match(/sections?\[(\d+)\]/);
    if (secMatch) {
      const idx = parseInt(secMatch[1]);
      const section = resume.sections[idx];
      if (!section) return true;
      const content = section.content;
      if (section.section_type === "experience") {
        const expMatch = f.match(/entries?\[(\d+)\]\.bullets/);
        if (expMatch) {
          const ei = parseInt(expMatch[1]);
          const entry = content?.entries?.[ei];
          return !entry || !entry.bullets || entry.bullets.length === 0;
        }
        const entryMatch = f.match(/entries?\[(\d+)\]\.(\w+)/);
        if (entryMatch) {
          const ei = parseInt(entryMatch[1]);
          const field = entryMatch[2];
          return !content?.entries?.[ei]?.[field]?.trim();
        }
      }
      if (section.section_type === "education") {
        const entryMatch = f.match(/entries?\[(\d+)\]\.(\w+)/);
        if (entryMatch) {
          const ei = parseInt(entryMatch[1]);
          const field = entryMatch[2];
          return !content?.entries?.[ei]?.[field]?.trim();
        }
      }
    }
    return false;
  });
}

function fieldLabel(path: string): string {
  const p = path.toLowerCase();
  if (p.includes("full_name")) return "Full Name";
  if (p.includes("email")) return "Email";
  if (p.includes("phone")) return "Phone Number";
  if (p.includes("location")) return "Location";
  if (p.includes("linkedin")) return "LinkedIn URL";
  if (p.includes("portfolio")) return "Portfolio URL";
  if (p.includes("github")) return "GitHub URL";
  if (p.includes("job_title")) return "Job Title";
  const secMatch = p.match(/sections?\[(\d+)\]/);
  if (secMatch) {
    const parts = path.split(".");
    return parts.slice(1).join(" → ").replace(/_/g, " ");
  }
  return path.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ResumeCompletionModal({
  resume: initialResume,
  isOpen,
  onClose,
  onSaved,
}: ResumeCompletionModalProps) {
  const [resume, setResume] = useState<StructuredResume>(initialResume);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    setResume(initialResume);
  }, [initialResume]);

  const activeUnparsed = useMemo(() => getActiveUnparsedFields(resume), [resume]);
  const totalOriginal = resume.parse_confidence?.low_confidence_fields?.length ?? 0;
  const resolved = totalOriginal - activeUnparsed.length;
  const allResolved = activeUnparsed.length === 0;

  const handleContactChange = useCallback(
    (field: keyof ContactInfo, value: string) => {
      setResume((prev) => ({
        ...prev,
        contact_info: { ...prev.contact_info, [field]: value },
      }));
      setSaveStatus("idle");
    },
    []
  );

  const handleSectionChange = useCallback((index: number, updated: any) => {
    setResume((prev) => {
      const sections = [...prev.sections];
      sections[index] = updated;
      return { ...prev, sections };
    });
    setSaveStatus("idle");
  }, []);

  // Debounced auto-save (3s)
  useEffect(() => {
    if (saveStatus === "idle") {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          setSaveStatus("saving");
          const updated = await updateStructuredResume(resume);
          setResume(updated);
          setSaveStatus("saved");
        } catch {
          setSaveStatus("idle");
        }
      }, 3000);
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [resume, saveStatus]);

  const handleSaveAndClose = async () => {
    try {
      setIsSaving(true);
      const updated = await updateStructuredResume(resume);
      setResume(updated);
      onSaved(updated);
      setSaveStatus("saved");
      onClose();
    } catch (err: any) {
      alert("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const scrollToField = (fieldPath: string) => {
    const key = fieldPath.toLowerCase();
    if (
      key.includes("full_name") || key.includes("email") || key.includes("phone") ||
      key.includes("location") || key.includes("linkedin") || key.includes("portfolio") ||
      key.includes("github") || (key.includes("job_title") && key.includes("contact"))
    ) {
      sectionRefs.current["contact"]?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      const secMatch = key.match(/sections?\[(\d+)\]/);
      if (secMatch) {
        sectionRefs.current[`section-${secMatch[1]}`]?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  if (!isOpen) return null;

  const ci = resume.contact_info;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-sm shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Complete Master Resume Fields
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {allResolved
                  ? "All fields 100% verified ✓"
                  : `${activeUnparsed.length} field${activeUnparsed.length !== 1 ? "s" : ""} need${activeUnparsed.length === 1 ? "s" : ""} your completion`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-save badge */}
            <div className="text-xs font-semibold">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Auto-saving...
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unparsed Fields Alert Card (Vivid Red Highlight) */}
        {activeUnparsed.length > 0 && (
          <div className="px-6 py-3.5 bg-rose-50/90 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-800/80 shrink-0">
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-rose-800 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
              <span>Fields Needing Completion — Click chip to jump:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeUnparsed.slice(0, 8).map((field) => (
                <button
                  key={field}
                  onClick={() => scrollToField(field)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-rose-900/60 border border-rose-300 dark:border-rose-700/80 text-rose-700 dark:text-rose-200 text-xs font-bold hover:bg-rose-100 dark:hover:bg-rose-800/80 transition-all shadow-sm cursor-pointer"
                >
                  {fieldLabel(field)}
                  <ChevronRight className="w-3.5 h-3.5 text-rose-500" />
                </button>
              ))}
              {activeUnparsed.length > 8 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-rose-200/60 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300 text-xs font-bold">
                  +{activeUnparsed.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Resolution Progress Bar */}
        {totalOriginal > 0 && (
          <div className="px-6 py-2.5 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.round((resolved / totalOriginal) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400 shrink-0">
                {resolved}/{totalOriginal} fields completed ({Math.round((resolved / totalOriginal) * 100)}%)
              </span>
            </div>
          </div>
        )}

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 bg-slate-50/30 dark:bg-slate-950/20">

          {/* Contact Details Card */}
          <div
            ref={(el) => { sectionRefs.current["contact"] = el; }}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/50">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Contact Information
              </h3>
            </div>
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { key: "full_name" as const, label: "Full Name", icon: User, placeholder: "e.g. Ahmad Barajaib" },
                { key: "job_title" as const, label: "Job Title / Headline", icon: Briefcase, placeholder: "e.g. Senior Software Engineer" },
                { key: "email" as const, label: "Email Address", icon: Mail, placeholder: "e.g. ahmad@example.com" },
                { key: "phone" as const, label: "Phone Number", icon: Phone, placeholder: "e.g. +971 50 123 4567" },
                { key: "location" as const, label: "City, Country", icon: MapPin, placeholder: "e.g. Dubai, UAE" },
                { key: "linkedin_url" as const, label: "LinkedIn URL", icon: Link, placeholder: "linkedin.com/in/..." },
                { key: "portfolio_url" as const, label: "Portfolio / Website", icon: Globe, placeholder: "yoursite.com" },
                { key: "github_url" as const, label: "GitHub URL", icon: GitBranch, placeholder: "github.com/username" },
              ].map(({ key, label, icon: Icon, placeholder }) => {
                const val = (ci as any)[key] ?? "";
                const isUnparsed = activeUnparsed.some((f) => f.toLowerCase().includes(key.replace("_url", "").replace("_", "_")));
                return (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      {label}
                    </label>
                    <div className="relative">
                      <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleContactChange(key, e.target.value)}
                        placeholder={placeholder}
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm font-medium transition-all outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                          ${isUnparsed
                            ? "bg-rose-50/60 dark:bg-rose-950/30 border-2 border-rose-400 dark:border-rose-700 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                            : "bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                          }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section Editors */}
          {resume.sections.map((section, index) => (
            <div
              key={`${section.section_type}-${index}`}
              ref={(el) => { sectionRefs.current[`section-${index}`] = el; }}
            >
              <ResumeSectionEditor
                section={section}
                index={index}
                lowConfidenceFields={resume.parse_confidence?.low_confidence_fields ?? []}
                onChange={(updated) => handleSectionChange(index, updated)}
                onDelete={() => {
                  setResume((prev) => ({
                    ...prev,
                    sections: prev.sections.filter((_, i) => i !== index),
                  }));
                }}
              />
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 shrink-0 flex items-center justify-between gap-4">
          <div className="text-xs font-semibold">
            {allResolved ? (
              <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Master resume is 100% complete & verified
              </span>
            ) : (
              <span className="text-slate-600 dark:text-slate-400">
                {activeUnparsed.length} field{activeUnparsed.length !== 1 ? "s" : ""} remaining to complete
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleSaveAndClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Saving..." : allResolved ? "Save Master Resume" : `Save & Close (${activeUnparsed.length} remaining)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
