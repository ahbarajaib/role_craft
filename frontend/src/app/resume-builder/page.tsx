"use client";

import { useState, useEffect, useRef } from "react";
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
} from "@/lib/structured_resume_api";
import TemplateSelector, { TEMPLATES } from "@/components/template_selector";
import ResumeSectionEditor from "@/components/resume_section_editor";
import { useAuth } from "@/components/auth_provider";
import AuthModal from "@/components/auth_modal";
import { ProfileModal } from "@/components/profile_modal";
import { WordLogoIcon, PdfLogoIcon } from "@/components/file_format_icons";

export default function ResumeBuilderPage() {
  const { user, token, isLoading: authLoading, setShowAuthModal } = useAuth();

  const [resume, setResume] = useState<StructuredResume | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving">("saved");
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [isLoadingResume, setIsLoadingResume] = useState(true);

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

  const lowConfFields = resume?.parse_confidence?.low_confidence_fields || [];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-2 text-slate-900 dark:text-white font-black text-lg hover:opacity-90 transition-all"
            >
              <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                <Sparkles className="h-4.5 w-4.5" />
              </div>
              <span>RoleCraft</span>
            </Link>
            <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-bold text-[11px]">
              AI Resume Builder
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/workspace"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-all"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Workspace
            </Link>

            {token && (
              <button
                type="button"
                onClick={() => handleSave()}
                disabled={isSaving || saveStatus === "saved"}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm ${
                  saveStatus === "unsaved"
                    ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-default"
                }`}
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : saveStatus === "unsaved" ? "Save Changes" : "Saved"}
              </button>
            )}

            {token ? (
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="h-8 w-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs hover:bg-indigo-500/20 transition-all cursor-pointer"
                title="Profile & Settings"
              >
                <User className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-3.5 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-all cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Status Message Banner */}
        {statusMsg && (
          <div
            className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-medium ${
              statusMsg.type === "error"
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300"
                : statusMsg.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                : "bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMsg.type === "error" ? (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
              ) : statusMsg.type === "success" ? (
                <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <Sparkles className="h-4 w-4 shrink-0 text-indigo-500" />
              )}
              <span>{statusMsg.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setStatusMsg(null)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        )}

        {/* Hidden File Input for Re-import / Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept=".docx,.pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
          }}
        />

        {/* Top Action Bar (shown ONLY when resume is loaded) */}
        {resume && !isParsing && (
          <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                className="px-4 py-2 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition-all cursor-pointer border border-slate-200 dark:border-slate-700 flex items-center gap-2"
              >
                <UploadCloud className="h-4 w-4 text-indigo-500" />
                Re-import Resume (DOCX / PDF)
              </button>

              <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
                Master Resume JSON synced live across RoleCraft workspace
              </span>
            </div>

            {token && (
              <div className="flex items-center gap-2">
                <a
                  href={getTemplateDownloadUrl(selectedTemplate, "docx")}
                  download
                  className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-indigo-600 dark:text-indigo-400 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <WordLogoIcon className="h-4 w-4" /> Download DOCX
                </a>

                <a
                  href={getTemplateDownloadUrl(selectedTemplate, "pdf")}
                  download
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-indigo-500/20"
                >
                  <PdfLogoIcon className="h-4 w-4" /> Download PDF
                </a>
              </div>
            )}
          </div>
        )}

        {/* Two-Panel Layout */}
        {resume ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Panel (7 Cols): Section Editor */}
            <div className="lg:col-span-7 space-y-6">
              {/* ATS Template Picker */}
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
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
              <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-indigo-500" /> Candidate Contact Details
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
                            className="h-7 w-7 rounded-full object-cover border border-indigo-500"
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
                          className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
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
                    <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      Full Name
                      {lowConfFields.includes("contact_info.full_name") && (
                        <span className="text-rose-500 font-bold text-[10px] flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Unparsed
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={resume.contact_info?.full_name || ""}
                      onChange={(e) => {
                        setResume({
                          ...resume,
                          contact_info: { ...resume.contact_info, full_name: e.target.value },
                        });
                        setSaveStatus("unsaved");
                      }}
                      className={`w-full p-2.5 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none ${
                        lowConfFields.includes("contact_info.full_name")
                          ? "border-rose-400 dark:border-rose-500 bg-rose-50/20"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                      placeholder="Mohammed Ahbar Ajaib"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      Email Address
                      {lowConfFields.includes("contact_info.email") && (
                        <span className="text-rose-500 font-bold text-[10px] flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Unparsed
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={resume.contact_info?.email || ""}
                      onChange={(e) => {
                        setResume({
                          ...resume,
                          contact_info: { ...resume.contact_info, email: e.target.value },
                        });
                        setSaveStatus("unsaved");
                      }}
                      className={`w-full p-2.5 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none ${
                        lowConfFields.includes("contact_info.email")
                          ? "border-rose-400 dark:border-rose-500 bg-rose-50/20"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                      placeholder="ahbar@example.com"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      Phone Number
                      {lowConfFields.includes("contact_info.phone") && (
                        <span className="text-rose-500 font-bold text-[10px] flex items-center gap-0.5">
                          <AlertTriangle className="h-3 w-3" /> Unparsed
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      value={resume.contact_info?.phone || ""}
                      onChange={(e) => {
                        setResume({
                          ...resume,
                          contact_info: { ...resume.contact_info, phone: e.target.value },
                        });
                        setSaveStatus("unsaved");
                      }}
                      className={`w-full p-2.5 rounded-xl border text-xs bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-white focus:outline-none ${
                        lowConfFields.includes("contact_info.phone")
                          ? "border-rose-400 dark:border-rose-500 bg-rose-50/20"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                      placeholder="+91 7411223375"
                    />
                  </div>

                  <div>
                    <label className="font-semibold text-slate-700 dark:text-slate-300">
                      Location / Address
                    </label>
                    <input
                      type="text"
                      value={resume.contact_info?.location || ""}
                      onChange={(e) => {
                        setResume({
                          ...resume,
                          contact_info: { ...resume.contact_info, location: e.target.value },
                        });
                        setSaveStatus("unsaved");
                      }}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white"
                      placeholder="Bangalore, India"
                    />
                  </div>

                  <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        LinkedIn URL
                      </label>
                      <input
                        type="text"
                        value={resume.contact_info?.linkedin_url || ""}
                        onChange={(e) => {
                          setResume({
                            ...resume,
                            contact_info: { ...resume.contact_info, linkedin_url: e.target.value },
                          });
                          setSaveStatus("unsaved");
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white"
                        placeholder="linkedin.com/in/ahbarajaib"
                      />
                    </div>

                    <div>
                      <label className="font-semibold text-slate-700 dark:text-slate-300">
                        Portfolio / GitHub URL
                      </label>
                      <input
                        type="text"
                        value={resume.contact_info?.portfolio_url || resume.contact_info?.github_url || ""}
                        onChange={(e) => {
                          setResume({
                            ...resume,
                            contact_info: { ...resume.contact_info, portfolio_url: e.target.value },
                          });
                          setSaveStatus("unsaved");
                        }}
                        className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs text-slate-900 dark:text-white"
                        placeholder="ahbarajaib.com"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Resume Sections List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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

                {/* Add Section Menu */}
                <div className="p-4 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    + Add New Section
                  </span>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <button
                      type="button"
                      onClick={() => handleAddSection("summary")}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:border-indigo-500 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <FileText className="h-3.5 w-3.5 text-indigo-500" /> Summary
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSection("skills")}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:border-emerald-500 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Code className="h-3.5 w-3.5 text-emerald-500" /> Skills
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSection("experience")}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:border-blue-500 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Briefcase className="h-3.5 w-3.5 text-blue-500" /> Experience
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSection("education")}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:border-purple-500 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <GraduationCap className="h-3.5 w-3.5 text-purple-500" /> Education
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSection("projects")}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:border-amber-500 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <FolderGit2 className="h-3.5 w-3.5 text-amber-500" /> Projects
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSection("certifications")}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:border-rose-500 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Award className="h-3.5 w-3.5 text-rose-500" /> Certifications
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddSection("custom")}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold hover:border-slate-500 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Layers className="h-3.5 w-3.5 text-slate-500" /> Custom Section
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel (5 Cols): Live Preview & Summary Card */}
            <div className="lg:col-span-5 sticky top-20 space-y-6">
              <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-indigo-500" /> Live Resume Overview
                  </h3>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                    {TEMPLATES.find((t) => t.id === selectedTemplate)?.title}
                  </span>
                </div>

                {/* Candidate Name Banner */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-center space-y-1">
                  {resume.profile_photo_url && (
                    <img
                      src={resume.profile_photo_url}
                      alt="Profile"
                      className="h-16 w-16 rounded-full mx-auto object-cover border-2 border-indigo-500 shadow-sm mb-2"
                    />
                  )}
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    {resume.contact_info?.full_name || "Candidate Name"}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {[resume.contact_info?.phone, resume.contact_info?.email, resume.contact_info?.location]
                      .filter(Boolean)
                      .join("  •  ")}
                  </p>
                </div>

                {/* Section Count & Confidence Metric */}
                <div className="grid grid-cols-2 gap-3 text-center text-xs">
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Sections</span>
                    <span className="text-base font-black text-slate-900 dark:text-white">
                      {resume.sections.filter((s) => s.visible).length}
                    </span>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Parse Confidence</span>
                    <span
                      className={`text-base font-black ${
                        lowConfFields.length > 0 ? "text-amber-500" : "text-emerald-500"
                      }`}
                    >
                      {lowConfFields.length > 0 ? `${lowConfFields.length} Unparsed` : "100% Verified"}
                    </span>
                  </div>
                </div>

                {/* Download Actions */}
                {token ? (
                  <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <a
                      href={getTemplateDownloadUrl(selectedTemplate, "pdf")}
                      download
                      className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20"
                    >
                      <PdfLogoIcon className="h-4 w-4" /> Export as PDF ({TEMPLATES.find((t) => t.id === selectedTemplate)?.title})
                    </a>

                    <a
                      href={getTemplateDownloadUrl(selectedTemplate, "docx")}
                      download
                      className="w-full py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs border border-slate-200 dark:border-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <WordLogoIcon className="h-4 w-4" /> Export as DOCX
                    </a>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(true)}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs hover:bg-indigo-700 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Lock className="h-4 w-4" /> Sign In to Export Resume
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : isLoadingResume ? (
          /* Loading State */
          <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center max-w-xl mx-auto space-y-4 my-12">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 mx-auto">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Loading Master Resume...</p>
          </div>
        ) : isParsing ? (
          /* Parsing State */
          <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/60 shadow-xl shadow-indigo-500/5 text-center max-w-xl mx-auto space-y-6 my-12 relative overflow-hidden">
            <div className="h-16 w-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white mx-auto shadow-lg shadow-indigo-500/30 animate-pulse">
              <Sparkles className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin text-indigo-500" />
                AI Parsing Resume into Structured Sections...
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Extracting contact info, skills categories, work experience, and education into your unified Master Resume format.
              </p>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden max-w-sm mx-auto">
              <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 h-full w-3/4 animate-pulse rounded-full" />
            </div>
          </div>
        ) : (
          /* Empty Initial State Card */
          <div className="p-12 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm text-center max-w-xl mx-auto space-y-6 my-8">
            <div className="h-16 w-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mx-auto">
              <UploadCloud className="h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Import Your Resume to Start Building
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                Upload your DOCX or PDF resume. RoleCraft AI parses your content into structured, editable sections so you can modify details, manage section ordering, and export cleanly into ATS single-column templates.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-indigo-500/25 inline-flex items-center gap-2"
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
    </div>
  );
}
