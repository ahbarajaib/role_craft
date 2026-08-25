"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X, CheckCircle2, AlertCircle, Save, ChevronRight, Loader2,
  User, Mail, Phone, MapPin, Link, GitBranch, Globe, Briefcase, Sparkles, Camera, Trash2,
} from "lucide-react";
import {
  StructuredResume,
  ContactInfo,
  updateStructuredResume,
  uploadProfilePhoto,
  deleteProfilePhoto,
} from "@/lib/structured_resume_api";
import ResumeSectionEditor from "@/components/resume_section_editor";

export function getFullProfilePhotoUrl(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  const apiHost = process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8000" : "https://api.rolecraft.tech");
  return `${apiHost.replace(/\/$/, "")}${url.startsWith("/") ? "" : "/"}${url}`;
}

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

  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingPhoto(true);
    try {
      const res = await uploadProfilePhoto(file);
      const updated = { ...resume, profile_photo_url: res.photo_url };
      setResume(updated);
      onSaved(updated);
    } catch (err: any) {
      alert("Failed to upload photo: " + (err.message || "Unknown error"));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handlePhotoDelete = async () => {
    if (!confirm("Are you sure you want to remove your profile photo?")) return;
    setIsUploadingPhoto(true);
    try {
      await deleteProfilePhoto();
      const updated = { ...resume, profile_photo_url: null };
      setResume(updated);
      onSaved(updated);
    } catch (err: any) {
      alert("Failed to remove photo: " + (err.message || "Unknown error"));
    } finally {
      setIsUploadingPhoto(false);
    }
  };

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
  }, []);

  const handleSaveAndClose = async () => {
    try {
      setIsSaving(true);
      const updated = await updateStructuredResume(resume);
      setResume(updated);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      alert("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  const scrollToField = (fieldPath: string) => {
    const key = fieldPath.toLowerCase();

    // 1. Check for input by exact or cleaned ID
    const cleanId = fieldPath.replace(/\[/g, "_").replace(/\]/g, "").replace(/\./g, "_");
    const targetInput =
      document.getElementById(`input-${fieldPath}`) ||
      document.getElementById(`input-${cleanId}`) ||
      document.getElementById(fieldPath);

    if (targetInput) {
      targetInput.scrollIntoView({ behavior: "smooth", block: "center" });
      targetInput.focus();
      targetInput.classList.add("ring-4", "ring-rose-500", "animate-pulse");
      setTimeout(() => {
        targetInput.classList.remove("ring-4", "ring-rose-500", "animate-pulse");
      }, 2000);
      return;
    }

    // 2. Section fallback
    if (
      key.includes("full_name") || key.includes("email") || key.includes("phone") ||
      key.includes("location") || key.includes("linkedin") || key.includes("portfolio") ||
      key.includes("github") || (key.includes("job_title") && key.includes("contact"))
    ) {
      const contactEl = sectionRefs.current["contact"];
      if (contactEl) {
        contactEl.scrollIntoView({ behavior: "smooth", block: "center" });
        const input = contactEl.querySelector("input");
        if (input) {
          input.focus();
          input.classList.add("ring-4", "ring-rose-500", "animate-pulse");
          setTimeout(() => {
            input.classList.remove("ring-4", "ring-rose-500", "animate-pulse");
          }, 2000);
        }
      }
    } else {
      const secMatch = key.match(/sections?\[(\d+)\]/);
      if (secMatch) {
        const secEl = sectionRefs.current[`section-${secMatch[1]}`];
        if (secEl) {
          secEl.scrollIntoView({ behavior: "smooth", block: "center" });
          const input = secEl.querySelector("input, textarea");
          if (input) {
            (input as HTMLElement).focus();
            input.classList.add("ring-4", "ring-rose-500", "animate-pulse");
            setTimeout(() => {
              input.classList.remove("ring-4", "ring-rose-500", "animate-pulse");
            }, 2000);
          }
        }
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
            <div className="w-10 h-10 rounded-2xl bg-[#E6F7F4] dark:bg-slate-900/40 text-teal-600 dark:text-teal-400 flex items-center justify-center shadow-sm shrink-0">
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
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Unparsed Fields Alert Card (Bold Red Banner at VERY TOP) */}
        {activeUnparsed.length > 0 && (
          <div className="px-6 py-4 bg-rose-500 text-white dark:bg-rose-950/90 dark:text-rose-100 border-b border-rose-600 dark:border-rose-800 shrink-0 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2 text-xs font-black uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-white" />
                <span>Unparsed / Missing Fields ({activeUnparsed.length}) — Click chip to jump & edit:</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeUnparsed.map((field) => (
                <button
                  key={field}
                  onClick={() => scrollToField(field)}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-rose-700 dark:bg-rose-900/90 dark:text-rose-100 border border-rose-200 dark:border-rose-700 text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
                >
                  <span>{fieldLabel(field)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-rose-500 dark:text-rose-300" />
                </button>
              ))}
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
                <User className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Contact Information
              </h3>
            </div>

            {/* Profile Photo Uploader Box */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 flex flex-col sm:flex-row items-center gap-5">
              <div className="relative group shrink-0">
                {resume.profile_photo_url ? (
                  <img
                    src={getFullProfilePhotoUrl(resume.profile_photo_url) || ""}
                    alt="Profile Avatar"
                    className="w-20 h-20 rounded-2xl object-cover ring-4 ring-teal-500/20 shadow-md bg-white dark:bg-slate-800"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-[#E6F7F4] dark:bg-slate-900/60 text-teal-600 dark:text-teal-400 border-2 border-dashed border-teal-300 dark:border-teal-700 flex flex-col items-center justify-center gap-1 shadow-inner">
                    <User className="w-8 h-8 opacity-80" />
                    <span className="text-[9px] font-bold uppercase tracking-wider">No Photo</span>
                  </div>
                )}
                {isUploadingPhoto && (
                  <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs rounded-2xl flex items-center justify-center text-white">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-center sm:text-left flex-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-2">
                  Candidate Profile Photo
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Executive Profile Compatible
                  </span>
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  Uploaded photos display cleanly on your UI workspace cards & automatically render in Executive Profile DOCX/PDF downloads.
                </p>

                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/jpg"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isUploadingPhoto}
                    onClick={() => photoInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-xs shadow-md shadow-teal-500/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {resume.profile_photo_url ? "Change Photo" : "Upload Photo"}
                  </button>

                  {resume.profile_photo_url && (
                    <button
                      type="button"
                      disabled={isUploadingPhoto}
                      onClick={handlePhotoDelete}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-700 dark:text-rose-300 font-bold text-xs border border-rose-200 dark:border-rose-800 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </button>
                  )}
                </div>
              </div>
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
                        id={`input-contact_info.${key}`}
                        type="text"
                        value={val}
                        onChange={(e) => handleContactChange(key, e.target.value)}
                        placeholder={placeholder}
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl text-sm font-medium transition-all outline-none text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500
                          ${isUnparsed
                            ? "bg-rose-50/90 dark:bg-rose-950/40 border-2 border-rose-500 dark:border-rose-600 text-rose-950 dark:text-rose-100 focus:border-rose-600 focus:ring-2 focus:ring-rose-500/30"
                            : "bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20"
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
              id={`input-section-${index}`}
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
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-md shadow-teal-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-60"
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
