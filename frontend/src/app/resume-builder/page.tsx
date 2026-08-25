"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  UploadCloud,
  Sparkles,
  Download,
  Save,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Plus,
  RefreshCw,
  ArrowLeft,
  User,
  Camera,
  Trash2,
  FileText,
  Briefcase,
  GraduationCap,
  Award,
  FolderGit2,
  Code,
  Layers,
  Check,
  CheckCircle2,
  Layout,
  Globe,
  Lock,
} from "lucide-react";
import {
  StructuredResume,
  ResumeSection,
  parseAndSaveStructuredResume,
  fetchStructuredResume,
  updateStructuredResume,
  uploadProfilePhoto,
  deleteProfilePhoto,
  getTemplateDownloadUrl,
  downloadStructuredResume,
} from "@/lib/structured_resume_api";
import TemplateSelector, { TEMPLATES } from "@/components/template_selector";
import ResumeSectionEditor from "@/components/resume_section_editor";
import { useAuth } from "@/components/auth_provider";
import AuthModal from "@/components/auth_modal";
import { ProfileModal } from "@/components/profile_modal";
import { WordLogoIcon, PdfLogoIcon } from "@/components/file_format_icons";
import { ParsingProgressCard } from "@/components/parsing_progress_card";

export default function ResumeBuilderPage() {
  const { user, token, isLoading: authLoading, setShowAuthModal } = useAuth();

  const [resume, setResume] = useState<StructuredResume | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [uploadingFileName, setUploadingFileName] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState<"pdf" | "docx" | null>(null);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(true);

  useEffect(() => {
    if (statusMsg) {
      const timer = setTimeout(() => {
        setStatusMsg(null);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [statusMsg]);

  const [selectedTemplate, setSelectedTemplate] = useState<"clean_classic" | "modern_professional" | "executive_profile">("clean_classic");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Load existing structured resume on mount
  useEffect(() => {
    if (token) {
      loadResume();
    } else if (!authLoading) {
      setIsLoadingResume(false);
    }
  }, [token, authLoading]);

  const loadResume = async () => {
    setIsLoadingResume(true);
    try {
      const data = await fetchStructuredResume();
      if (data) {
        setResume(data);
        if (data.preferred_template) {
          setSelectedTemplate(data.preferred_template);
        }
      }
    } catch (err: any) {
      console.error("Failed to load structured resume:", err);
    } finally {
      setIsLoadingResume(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!token) {
      setShowAuthModal(true);
      return;
    }

    setUploadingFileName(file.name);
    setIsParsing(true);
    setStatusMsg({ type: "info", text: "AI is parsing resume content into structured sections..." });

    try {
      // Step 1: AI parse → structured JSON (primary path)
      const parsed = await parseAndSaveStructuredResume(file);
      setResume(parsed);
      if (parsed.preferred_template) {
        setSelectedTemplate(parsed.preferred_template);
      }

      // Step 2: Also upload + set as workspace base resume in background
      // This keeps both Resume Builder and Workspace in sync
      try {
        const { uploadResume, setBaseResume } = await import("@/lib/api");
        const uploadResult = await uploadResume(file);
        await setBaseResume(uploadResult.document_id, file.name);
      } catch {
        // Non-fatal: base resume sync failed, but structured JSON was saved
        console.warn("Could not sync to workspace base resume (non-fatal)");
      }

      setStatusMsg({
        type: "success",
        text: "Resume successfully parsed! Fields needing review are highlighted in red.",
      });
    } catch (err: any) {
      setStatusMsg({
        type: "error",
        text: err?.message || "Failed to parse resume file. Please try another DOCX or PDF file.",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async (updatedResume?: StructuredResume) => {
    const target = updatedResume || resume;
    if (!target || !token) return;

    setIsSaving(true);
    setSaveStatus("saving");
    try {
      const saved = await updateStructuredResume({
        ...target,
        preferred_template: selectedTemplate,
      });
      setResume(saved);
      setSaveStatus("saved");
      setStatusMsg({ type: "success", text: "All resume section changes saved successfully." });
    } catch (err: any) {
      setSaveStatus("unsaved");
      setStatusMsg({ type: "error", text: err?.message || "Failed to save changes." });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (file: File) => {
    if (!token) return;
    setIsUploadingPhoto(true);
    try {
      const res = await uploadProfilePhoto(file);
      if (resume) {
        setResume({ ...resume, profile_photo_url: res.photo_url });
      }
      setStatusMsg({ type: "success", text: "Profile photo uploaded! Enabled for Executive Profile template." });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Failed to upload photo." });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!token) return;
    try {
      await deleteProfilePhoto();
      if (resume) {
        setResume({ ...resume, profile_photo_url: null });
      }
      setStatusMsg({ type: "info", text: "Profile photo removed." });
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Failed to delete photo." });
    }
  };

  // Section manipulation helpers
  const handleUpdateSection = (index: number, updatedSection: ResumeSection) => {
    if (!resume) return;
    const newSections = [...resume.sections];
    newSections[index] = updatedSection;
    const updated = { ...resume, sections: newSections };
    setResume(updated);
    setSaveStatus("unsaved");
  };

  const handleDeleteSection = (index: number) => {
    if (!resume) return;
    const newSections = resume.sections.filter((_, i) => i !== index);
    const updated = { ...resume, sections: newSections };
    setResume(updated);
    setSaveStatus("unsaved");
  };

  const handleMoveSection = (index: number, direction: "up" | "down") => {
    if (!resume) return;
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= resume.sections.length) return;

    const newSections = [...resume.sections];
    const temp = newSections[index];
    newSections[index] = newSections[targetIdx];
    newSections[targetIdx] = temp;

    // Update order properties
    newSections.forEach((sec, idx) => {
      sec.order = idx;
    });

    const updated = { ...resume, sections: newSections };
    setResume(updated);
    setSaveStatus("unsaved");
  };

  const handleAddSection = (type: ResumeSection["section_type"]) => {
    if (!resume) return;

    const titleMap: Record<string, string> = {
      summary: "Professional Summary",
      skills: "Technical Skills",
      experience: "Professional Experience",
      education: "Education & Credentials",
      projects: "Key Projects",
      certifications: "Certifications & Training",
      custom: "Additional Information",
    };

    const contentMap: Record<string, any> = {
      summary: { text: "Proven professional with expertise in delivering high-impact results." },
      skills: { categories: [{ category_name: "Core Skills", skills: ["Skill 1", "Skill 2"] }] },
      experience: {
        entries: [
          {
            job_title: "Role Title",
            company: "Company Name",
            location: "Location",
            start_date: "Jan 2023",
            end_date: "Present",
            bullets: ["Key achievement bullet point."],
          },
        ],
      },
      education: { entries: [{ degree: "Degree Name", institution: "University Name", graduation_date: "2022" }] },
      projects: { entries: [{ name: "Project Name", technologies: ["Tech 1"], bullets: ["Project achievement."] }] },
      certifications: { entries: ["Certification Title — Issuing Body"] },
      custom: { entries: ["Custom entry detail."] },
    };

    const newSection: ResumeSection = {
      section_type: type,
      section_title: titleMap[type] || "New Section",
      order: resume.sections.length,
      visible: true,
      content: contentMap[type] || {},
    };

    const updated = { ...resume, sections: [...resume.sections, newSection] };
    setResume(updated);
    setSaveStatus("unsaved");
  };

  // Dynamically compute remaining unparsed fields based on current input values across contact_info and active sections
  const getActiveUnparsedFields = useCallback((res: StructuredResume | null): string[] => {
    if (!res?.parse_confidence?.low_confidence_fields) return [];
    const rawList = res.parse_confidence.low_confidence_fields;

    return rawList.filter((fieldPath) => {
      const f = fieldPath.toLowerCase();

      // 1. Contact Info Fields
      if (f.includes("full_name")) return !res.contact_info?.full_name?.trim();
      if (f.includes("job_title") && (f.includes("contact") || (!f.includes("entries") && !f.includes("experience")))) {
        return !res.contact_info?.job_title?.trim();
      }
      if (f.includes("email")) return !res.contact_info?.email?.trim();
      if (f.includes("phone")) return !res.contact_info?.phone?.trim();
      if (
        f.includes("location") &&
        (f.includes("contact") || (!f.includes("entries") && !f.includes("experience") && !f.includes("education") && !f.includes("projects")))
      ) {
        return !res.contact_info?.location?.trim();
      }
      if (f.includes("linkedin")) return !res.contact_info?.linkedin_url?.trim();
      if (f.includes("portfolio")) return !res.contact_info?.portfolio_url?.trim();
      if (f.includes("github")) return !res.contact_info?.github_url?.trim();

      // 2. Section Entry Fields (education.0.location, experience.1.company, sections.3.content.entries.0.graduation_date, etc.)
      let sectionType = "";
      if (f.includes("education")) sectionType = "education";
      else if (f.includes("experience")) sectionType = "experience";
      else if (f.includes("project")) sectionType = "projects";
      else if (f.includes("certification")) sectionType = "certifications";
      else if (f.includes("skill")) sectionType = "skills";

      const parts = fieldPath.split(".");
      let entryIdx = 0;
      for (const p of parts) {
        if (!isNaN(Number(p))) {
          entryIdx = Number(p);
          break;
        }
      }

      const propKey = parts[parts.length - 1];

      if (sectionType && res.sections) {
        const sec = res.sections.find((s) => s.section_type === sectionType);
        if (sec && sec.content && Array.isArray(sec.content.entries)) {
          const entry = sec.content.entries[entryIdx];
          if (entry && typeof entry === "object") {
            const val = entry[propKey];
            if (typeof val === "string" && val.trim().length > 0) {
              return false; // RESOLVED! Value is non-empty!
            }
            if (Array.isArray(val) && val.length > 0) {
              return false; // RESOLVED! Non-empty array!
            }
          }
        }
      }

      // 3. Fallback direct object lookup
      let target: any = res;
      for (const p of parts) {
        if (target === undefined || target === null) break;
        target = target[p];
      }
      if (typeof target === "string") return !target.trim();
      if (Array.isArray(target)) return target.length === 0;

      return !target;
    });
  }, []);

  const lowConfFields = useMemo(() => getActiveUnparsedFields(resume), [resume, getActiveUnparsedFields]);

  const handleSaveResume = async (showToast = true) => {
    if (!resume) return;
    try {
      setIsSaving(true);
      setSaveStatus("saving");

      // Update remaining unparsed fields array before persisting to DB
      const updatedPayload: StructuredResume = {
        ...resume,
        parse_confidence: {
          overall_confidence: resume.parse_confidence?.overall_confidence ?? 100,
          low_confidence_fields: lowConfFields,
        },
      };

      const updated = await updateStructuredResume(updatedPayload);
      setResume(updated);
      setSaveStatus("saved");
      if (showToast) {
        setStatusMsg({ type: "success", text: "Master Resume & unparsed fields saved successfully to cloud!" });
      }
    } catch (err: any) {
      console.error("Save error:", err);
      setSaveStatus("unsaved");
      if (showToast) {
        setStatusMsg({ type: "error", text: err?.message || "Failed to save resume. Please try again." });
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Debounced Auto-Save Draft (saves 3s after user stops typing)
  useEffect(() => {
    if (saveStatus !== "unsaved" || !resume || !token) return;
    const timer = setTimeout(() => {
      handleSaveResume(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [resume, saveStatus, token]);

  const handleDownloadFile = async (format: "docx" | "pdf") => {
    if (!resume) return;
    try {
      // Auto-save unsaved changes before triggering export
      if (saveStatus === "unsaved") {
        await handleSaveResume(false);
      }
      setIsExporting(format);
      const name = resume.contact_info?.full_name || "Resume";
      const filename = `${name} - ${selectedTemplate.replace("_", " ").toUpperCase()}.${format}`;
      await downloadStructuredResume(selectedTemplate, format, filename);
    } catch (err: any) {
      console.error("Download error:", err);
      setStatusMsg({ type: "error", text: err?.message || "Failed to download file. Please try again." });
    } finally {
      setIsExporting(null);
    }
  };

  function humanizeFieldName(field: string): { label: string; elementId: string } {
    const f = field.toLowerCase();
    if (f.includes("full_name")) return { label: "Contact Full Name", elementId: "field-full_name" };
    if (f.includes("job_title") && (f.includes("contact") || (!f.includes("entries") && !f.includes("experience")))) {
      return { label: "Professional Headline", elementId: "field-job_title" };
    }
    if (f.includes("email")) return { label: "Email Address", elementId: "field-email" };
    if (f.includes("phone")) return { label: "Phone Number", elementId: "field-phone" };
    if (f.includes("location") && (f.includes("contact") || !f.includes("entries"))) {
      return { label: "Location / Address", elementId: "field-location" };
    }
    if (f.includes("linkedin")) return { label: "LinkedIn Link", elementId: "field-linkedin" };
    if (f.includes("portfolio")) return { label: "Portfolio URL", elementId: "field-portfolio" };
    if (f.includes("github")) return { label: "GitHub Link", elementId: "field-github" };

    const parts = field.split(".");
    let itemNum = "";
    for (const p of parts) {
      if (!isNaN(Number(p))) {
        itemNum = ` #${Number(p) + 1}`;
        break;
      }
    }

    let propName = parts[parts.length - 1].replace(/_/g, " ");
    propName = propName.charAt(0).toUpperCase() + propName.slice(1);

    if (f.includes("experience")) return { label: `Experience${itemNum}: ${propName}`, elementId: `field-${field.replace(/\./g, "-")}` };
    if (f.includes("education")) return { label: `Education${itemNum}: ${propName}`, elementId: `field-${field.replace(/\./g, "-")}` };
    if (f.includes("projects")) return { label: `Project${itemNum}: ${propName}`, elementId: `field-${field.replace(/\./g, "-")}` };

    return { label: propName, elementId: `field-${field.replace(/\./g, "-")}` };
  }

  return (
    <div className="min-h-screen hero-mesh text-slate-900 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-teal-100 px-4 lg:px-8 py-3 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2.5 text-slate-900 font-black text-lg hover:opacity-90 transition-all group"
            >
              <div className="relative shrink-0 flex items-center justify-center">
                <img
                  src="/logo.svg"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).src = "/logo.png"; }}
                  alt="RoleCraft Logo"
                  className="h-9 w-9 object-contain transition-transform group-hover:scale-105"
                />
              </div>
              <span className="text-gradient font-black tracking-tight text-xl">RoleCraft</span>
            </Link>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-700 font-bold text-[11px]">
              AI Resume Builder
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/workspace"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-2xs transition-all hover:border-slate-300"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Workspace
            </Link>

            {token && (
              <button
                type="button"
                onClick={() => handleSaveResume(true)}
                disabled={isSaving || saveStatus === "saved"}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                  saveStatus === "unsaved"
                    ? "btn-primary text-white shadow-teal-500/20"
                    : "bg-white text-slate-700 border border-slate-200 cursor-default"
                }`}
              >
                {saveStatus === "unsaved" ? (
                  <>
                    <Save className="h-3.5 w-3.5" />
                    {isSaving ? "Saving..." : "Save Changes"}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-600" />
                    <span>Saved</span>
                  </>
                )}
              </button>
            )}

            {token ? (
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="h-9 w-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 font-bold text-xs hover:bg-[#E6F7F4] transition-all cursor-pointer shadow-2xs"
                title="Profile & Settings"
              >
                <User className="h-4.5 w-4.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 rounded-xl btn-primary text-white font-bold text-xs transition-all cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Status Toast */}
        {statusMsg && (
          <div
            className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-3 shadow-md transition-all ${
              statusMsg.type === "error"
                ? "bg-rose-50 border-rose-200 text-rose-700"
                : statusMsg.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                : "bg-teal-50 border-teal-200 text-teal-700"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMsg.type === "error" ? (
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
              ) : (
                <Check className="h-4 w-4 text-emerald-500 shrink-0" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="text-slate-400 hover:text-slate-600 font-bold text-sm px-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Action / Sync Banner */}
        {resume && (
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <input
                type="file"
                ref={fileInputRef}
                accept=".docx,.pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                }}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-teal-600 border border-slate-200 shadow-2xs text-xs font-bold transition-all flex items-center gap-2 cursor-pointer hover:border-teal-300"
              >
                <UploadCloud className="h-4 w-4 text-teal-600" />
                <span>Re-import Resume (DOCX / PDF)</span>
              </button>

              <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                Master Resume JSON synced live across RoleCraft workspace
              </span>
            </div>
          </div>
        )}

        {/* Two-Panel Layout or Parsing State */}
        {isParsing ? (
          /* Dynamic Step-by-Step AI Parsing Progress UX */
          <ParsingProgressCard fileName={uploadingFileName || undefined} />
        ) : resume ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel (7 Cols): Section Editor */}
            <div className="lg:col-span-7 space-y-6">
              {/* Unparsed Fields Inspection & Quick-Jump Banner */}
              {lowConfFields.length > 0 && (
                <div className="p-5 rounded-3xl bg-rose-50 border border-rose-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 font-bold shrink-0">
                        <AlertTriangle className="h-4.5 w-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-extrabold text-rose-950">
                          {lowConfFields.length} Field{lowConfFields.length > 1 ? "s" : ""} Needing Your Completion
                        </h4>
                        <p className="text-[11px] text-rose-800">
                          Click any unparsed item below to jump directly to it and complete missing details:
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick-Jump Field Chips */}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {lowConfFields.map((field, fIdx) => {
                      const { label, elementId } = humanizeFieldName(field);
                      return (
                        <button
                          key={fIdx}
                          type="button"
                          onClick={() => {
                            const cleanPath = field.replace(/^sections\.\d+\.content\./, "");
                            let el = document.getElementById(elementId) || document.getElementById(`field-${cleanPath.replace(/\./g, "-")}`);
                            if (!el) el = (document.querySelector(`[data-field="${field}"]`) || document.querySelector(`[data-field="${cleanPath}"]`)) as HTMLElement;
                            if (el) {
                              el.scrollIntoView({ behavior: "smooth", block: "center" });
                              (el as HTMLElement).focus?.();
                              el.classList.add("ring-4", "ring-rose-500", "border-rose-500", "animate-pulse");
                              setTimeout(() => el?.classList.remove("ring-4", "ring-rose-500", "border-rose-500", "animate-pulse"), 3500);
                            }
                          }}
                          className="px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-800 font-extrabold text-xs hover:bg-rose-100 transition-all cursor-pointer flex items-center gap-1.5 shadow-xs hover:scale-105"
                        >
                          <AlertTriangle className="h-3 w-3 text-rose-500 shrink-0" />
                          <span>{label}</span>
                          <span className="text-[10px] text-rose-600 font-mono">↓</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ATS Template Picker */}
              <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs">
                <TemplateSelector
                  selectedTemplate={selectedTemplate}
                  onSelectTemplate={(t) => {
                    setSelectedTemplate(t);
                    setSaveStatus("unsaved");
                  }}
                  sourceFormat={resume.source_format}
                />
              </div>

              {/* Contact Info Card */}
              <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-teal-600" /> Candidate Contact Details
                  </h3>
                  {TEMPLATES.find((t) => t.id === selectedTemplate)?.hasPhotoSupport && (
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={photoInputRef}
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handlePhotoUpload(e.target.files[0]);
                        }}
                      />
                      {resume.profile_photo_url ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={resume.profile_photo_url}
                            alt="Profile"
                            className="h-7 w-7 rounded-full object-cover border border-teal-500"
                          />
                          <button
                            type="button"
                            onClick={handleDeletePhoto}
                            className="text-[11px] font-bold text-rose-500 hover:underline cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          disabled={isUploadingPhoto}
                          className="text-[11px] font-bold text-teal-600 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          {isUploadingPhoto ? "Uploading..." : "+ Add Profile Photo"}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-600 mb-1 flex items-center justify-between">
                      Full Name
                      {lowConfFields.includes("contact_info.full_name") && (
                        <span className="text-rose-500 font-bold text-[10px] flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Unparsed
                        </span>
                      )}
                    </label>
                    <input
                      id="field-full_name"
                      type="text"
                      value={resume.contact_info?.full_name || ""}
                      onChange={(e) => {
                        setResume({
                          ...resume,
                          contact_info: { ...resume.contact_info, full_name: e.target.value },
                        });
                        setSaveStatus("unsaved");
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-500 text-xs text-slate-900 focus:outline-none transition-all"
                      placeholder="Mohammed Ahbar Ajaib"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 mb-1 block">
                      Professional Headline / Target Role
                    </label>
                    <input
                      id="field-job_title"
                      type="text"
                      value={resume.contact_info?.job_title || ""}
                      onChange={(e) => {
                        setResume({
                          ...resume,
                          contact_info: { ...resume.contact_info, job_title: e.target.value },
                        });
                        setSaveStatus("unsaved");
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-500 text-xs text-slate-900 focus:outline-none transition-all"
                      placeholder="e.g. AI Application Engineer | Full Stack Developer"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 mb-1 flex items-center justify-between">
                      Email Address
                      {lowConfFields.includes("contact_info.email") && (
                        <span className="text-rose-500 font-bold text-[10px] flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Unparsed
                        </span>
                      )}
                    </label>
                    <input
                      id="field-email"
                      type="text"
                      value={resume.contact_info?.email || ""}
                      onChange={(e) => {
                        setResume({
                          ...resume,
                          contact_info: { ...resume.contact_info, email: e.target.value },
                        });
                        setSaveStatus("unsaved");
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-500 text-xs text-slate-900 focus:outline-none transition-all"
                      placeholder="ahbar@example.com"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-600 mb-1 flex items-center justify-between">
                      Phone Number
                      {lowConfFields.includes("contact_info.phone") && (
                        <span className="text-rose-500 font-bold text-[10px] flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Unparsed
                        </span>
                      )}
                    </label>
                    <input
                      id="field-phone"
                      type="text"
                      value={resume.contact_info?.phone || ""}
                      onChange={(e) => {
                        setResume({
                          ...resume,
                          contact_info: { ...resume.contact_info, phone: e.target.value },
                        });
                        setSaveStatus("unsaved");
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-500 text-xs text-slate-900 focus:outline-none transition-all"
                      placeholder="+91 7411223375"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="font-bold text-slate-600 mb-1 block">
                      Location / Address
                    </label>
                    <input
                      id="field-location"
                      type="text"
                      value={resume.contact_info?.location || ""}
                      onChange={(e) => {
                        setResume({
                          ...resume,
                          contact_info: { ...resume.contact_info, location: e.target.value },
                        });
                        setSaveStatus("unsaved");
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-500 text-xs text-slate-900 focus:outline-none transition-all"
                      placeholder="Bangalore, India"
                    />
                  </div>

                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold text-slate-600 mb-1 block">
                        LinkedIn URL
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-[10px] font-black text-teal-600 bg-teal-50 px-1 rounded">in</span>
                        <input
                          id="field-linkedin"
                          type="text"
                          value={resume.contact_info?.linkedin_url || ""}
                          onChange={(e) => {
                            setResume({
                              ...resume,
                              contact_info: { ...resume.contact_info, linkedin_url: e.target.value },
                            });
                            setSaveStatus("unsaved");
                          }}
                          className="w-full p-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-500 text-xs text-slate-900 focus:outline-none transition-all"
                          placeholder="linkedin.com/in/ahbarajaib"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 mb-1 block">
                        Portfolio / Website URL
                      </label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <input
                          id="field-portfolio"
                          type="text"
                          value={resume.contact_info?.portfolio_url || ""}
                          onChange={(e) => {
                            setResume({
                              ...resume,
                              contact_info: { ...resume.contact_info, portfolio_url: e.target.value },
                            });
                            setSaveStatus("unsaved");
                          }}
                          className="w-full p-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-500 text-xs text-slate-900 focus:outline-none transition-all"
                          placeholder="ahbarajaib.com"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="font-bold text-slate-600 mb-1 block">
                        GitHub Profile URL
                      </label>
                      <div className="relative">
                        <Code className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                        <input
                          id="field-github"
                          type="text"
                          value={resume.contact_info?.github_url || ""}
                          onChange={(e) => {
                            setResume({
                              ...resume,
                              contact_info: { ...resume.contact_info, github_url: e.target.value },
                            });
                            setSaveStatus("unsaved");
                          }}
                          className="w-full p-2.5 pl-9 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white focus:border-teal-500 text-xs text-slate-900 focus:outline-none transition-all"
                          placeholder="github.com/ahbarajaib"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Resume Sections List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Resume Sections ({resume.sections.length})
                  </h3>
                  <span className="text-[11px] text-slate-400">
                    Drag handles or arrows to reorder • Toggle eye icon to hide/show
                  </span>
                </div>

                {resume.sections.map((sec, idx) => (
                  <ResumeSectionEditor
                    key={idx}
                    section={sec}
                    index={idx}
                    lowConfidenceFields={lowConfFields}
                    onChange={(updatedSec) => handleUpdateSection(idx, updatedSec)}
                    onDelete={() => handleDeleteSection(idx)}
                    onMoveUp={idx > 0 ? () => handleMoveSection(idx, "up") : undefined}
                    onMoveDown={idx < resume.sections.length - 1 ? () => handleMoveSection(idx, "down") : undefined}
                  />
                ))}

                {/* Add Section Menu - Only show sections NOT currently active in resume */}
                {(() => {
                  const existingTypes = new Set(
                    resume.sections.map((s) => s.section_type)
                  );
                  const availableToAdd = [
                    { type: "experience", title: "Work Experience", icon: Briefcase },
                    { type: "education", title: "Education", icon: GraduationCap },
                    { type: "projects", title: "Projects", icon: FolderGit2 },
                    { type: "skills", title: "Technical Skills", icon: Code },
                    { type: "certifications", title: "Certifications", icon: Award },
                    { type: "summary", title: "Professional Summary", icon: FileText },
                    { type: "custom", title: "Custom Section", icon: Layers },
                  ].filter(
                    (opt) => opt.type === "custom" || !existingTypes.has(opt.type as any)
                  );

                  if (availableToAdd.length === 0) return null;

                  return (
                    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                        + Add Missing Section
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {availableToAdd.map((opt) => {
                          const Icon = opt.icon;
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => handleAddSection(opt.type as any)}
                              className="px-3.5 py-2 rounded-xl bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200 hover:border-teal-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                            >
                              <Icon className="h-3.5 w-3.5 text-teal-600" />
                              {opt.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Panel (5 Cols): Live Overview & Export */}
            <div className="lg:col-span-5 space-y-6 lg:sticky lg:top-20">
              <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200 shadow-2xs space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-teal-600" /> Live Resume Overview
                  </h3>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                    {TEMPLATES.find((t) => t.id === selectedTemplate)?.title}
                  </span>
                </div>

                {/* Candidate Name Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-3.5 text-left">
                  {resume.profile_photo_url ? (
                    <img
                      src={resume.profile_photo_url}
                      alt="Profile"
                      className="h-12 w-12 rounded-full object-cover border-2 border-teal-500 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-teal-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/20">
                      {resume.contact_info?.full_name ? resume.contact_info.full_name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase() : "MA"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-black text-slate-900 truncate">
                      {resume.contact_info?.full_name || "Candidate Name"}
                    </h2>
                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      {[resume.contact_info?.phone, resume.contact_info?.email, resume.contact_info?.location]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </div>
                </div>

                {/* Section Count & Confidence Metric */}
                <div className="grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Active Sections</span>
                    <span className="text-xl font-black text-slate-900">
                      {resume.sections.filter((s) => s.visible).length}
                    </span>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Parse Confidence</span>
                    <span
                      className={`text-xl font-black flex items-center justify-center gap-1 ${
                        lowConfFields.length > 0 ? "text-amber-600" : "text-emerald-600"
                      }`}
                    >
                      {lowConfFields.length > 0 ? `${lowConfFields.length} Unparsed` : (
                        <>
                          <span>100% Verified</span>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Download Actions */}
                {token ? (
                  <div className="space-y-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleDownloadFile("pdf")}
                      disabled={isExporting !== null}
                      className="w-full py-3.5 rounded-xl btn-primary text-white font-extrabold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-600/20 disabled:opacity-50"
                    >
                      <span className="px-1.5 py-0.5 rounded bg-red-600 text-white font-black text-[9px]">PDF</span>
                      <span>{isExporting === "pdf" ? "Exporting PDF..." : `Export as PDF (${TEMPLATES.find((t) => t.id === selectedTemplate)?.title})`}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadFile("docx")}
                      disabled={isExporting !== null}
                      className="w-full py-3 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs border border-slate-200 hover:border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      <WordLogoIcon className="h-4 w-4" />
                      <span>{isExporting === "docx" ? "Exporting DOCX..." : "Export as DOCX"}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="w-full py-3 rounded-xl btn-primary text-white font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Lock className="h-4 w-4" /> Sign In to Export Resume
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : isLoadingResume ? (
          /* Loading State */
          <div className="p-12 rounded-3xl bg-white border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-4 my-12">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600 mx-auto">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-xs font-semibold text-slate-600">Loading Master Resume...</p>
          </div>
        ) : (
          /* Empty Initial State Card */
          <div className="p-12 rounded-3xl bg-white border border-slate-200 shadow-sm text-center max-w-xl mx-auto space-y-6 my-8">
            <div className="h-16 w-16 rounded-3xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mx-auto">
              <UploadCloud className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Import Your Resume to Start Building
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Upload your DOCX or PDF resume. RoleCraft AI parses your content into structured, editable sections so you can modify details, manage section ordering, and export cleanly into ATS single-column templates.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-2xl btn-primary text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-teal-500/25 inline-flex items-center gap-2"
            >
              <UploadCloud className="h-4 w-4" />
              Upload DOCX or PDF
            </button>
          </div>
        )}
      </main>

      {/* Modals */}
      <AuthModal />
      {isProfileModalOpen && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          token={token}
          onProfileUpdated={loadResume}
        />
      )}

      {/* Floating Save Action Bar */}
      {resume && saveStatus === "unsaved" && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="px-5 py-3 rounded-2xl bg-slate-900/95 dark:bg-white/95 backdrop-blur-md text-white dark:text-slate-900 shadow-2xl border border-slate-800 dark:border-slate-200 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-xs font-bold">Unsaved Changes</span>
            </div>
            <button
              type="button"
              onClick={() => handleSaveResume(true)}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs transition-all shadow-md cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
