"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X, CheckCircle2, AlertCircle, Save, ChevronRight, Loader2,
  User, Mail, Phone, MapPin, Link, GitBranch, Globe, Briefcase,
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
    // For section fields just check if path references a section we have
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

  // Sync if parent passes new resume
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

  // Debounced auto-save
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl bg-[#0f1117] border border-white/10 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#111318] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Complete Your Resume</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {allResolved
                  ? "All fields verified ✓"
                  : `${activeUnparsed.length} field${activeUnparsed.length !== 1 ? "s" : ""} need${activeUnparsed.length === 1 ? "s" : ""} attention`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Save status indicator */}
            <div className="text-xs text-slate-500">
              {saveStatus === "saving" && (
                <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Auto-saving...</span>
              )}
              {saveStatus === "saved" && (
                <span className="flex items-center gap-1 text-emerald-400"><CheckCircle2 className="w-3 h-3" />Saved</span>
              )}
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Unparsed field chips */}
        {activeUnparsed.length > 0 && (
          <div className="px-6 py-3 bg-red-500/5 border-b border-red-500/10 shrink-0">
            <div className="flex flex-wrap gap-2">
              {activeUnparsed.slice(0, 8).map((field) => (
                <button
                  key={field}
                  onClick={() => scrollToField(field)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/25 transition-colors cursor-pointer"
                >
                  <AlertCircle className="w-3 h-3" />
                  {fieldLabel(field)}
                  <ChevronRight className="w-3 h-3" />
                </button>
              ))}
              {activeUnparsed.length > 8 && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-800 text-slate-400 text-xs">
                  +{activeUnparsed.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {totalOriginal > 0 && (
          <div className="px-6 py-2 bg-[#111318] shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
                  style={{ width: `${Math.round((resolved / totalOriginal) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 shrink-0">
                {resolved}/{totalOriginal} resolved
              </span>
            </div>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Contact Info */}
          <div
            ref={(el) => { sectionRefs.current["contact"] = el; }}
            className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-400" />
                Contact Information
              </h3>
            </div>
            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { key: "full_name" as const, label: "Full Name", icon: User, placeholder: "Ahmad Barajaib" },
                { key: "job_title" as const, label: "Job Title / Headline", icon: Briefcase, placeholder: "Senior Software Engineer" },
                { key: "email" as const, label: "Email", icon: Mail, placeholder: "ahmed@example.com" },
                { key: "phone" as const, label: "Phone", icon: Phone, placeholder: "+1 234 567 8900" },
                { key: "location" as const, label: "Location", icon: MapPin, placeholder: "Dubai, UAE" },
                { key: "linkedin_url" as const, label: "LinkedIn URL", icon: Link, placeholder: "linkedin.com/in/..." },
                { key: "portfolio_url" as const, label: "Portfolio / Website", icon: Globe, placeholder: "yoursite.com" },
                { key: "github_url" as const, label: "GitHub URL", icon: GitBranch, placeholder: "github.com/username" },
              ].map(({ key, label, icon: Icon, placeholder }) => {
                const val = (ci as any)[key] ?? "";
                const fieldPath = `contact_info.${key}`;
                const isUnparsed = activeUnparsed.some((f) => f.toLowerCase().includes(key.replace("_url", "").replace("_", "_")));
                return (
                  <div key={key}>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">
                      {label}
                    </label>
                    <div className="relative">
                      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        value={val}
                        onChange={(e) => handleContactChange(key, e.target.value)}
                        placeholder={placeholder}
                        className={`w-full pl-9 pr-3 py-2 rounded-lg text-sm bg-white/5 border transition-all outline-none text-white placeholder-slate-600
                          ${isUnparsed ? "border-red-500/50 focus:border-red-400 focus:ring-1 focus:ring-red-400/30" : "border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/20"}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Resume Sections */}
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

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-[#111318] shrink-0 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-500">
            {allResolved ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All fields complete — ready to use
              </span>
            ) : (
              <span>{activeUnparsed.length} field{activeUnparsed.length !== 1 ? "s" : ""} remaining</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleSaveAndClose}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md flex items-center gap-2 disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? "Saving..." : allResolved ? "Save & Close" : `Save & Close (${activeUnparsed.length} remaining)`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
