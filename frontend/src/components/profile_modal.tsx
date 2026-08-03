"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User as UserIcon,
  Phone,
  MapPin,
  Globe,
  FileText,
  UploadCloud,
  CheckCircle,
  Trash2,
  Save,
  Sparkles,
  Info,
} from "lucide-react";
import { updateProfile, setBaseCoverLetter, deleteBaseCoverLetter, uploadResume, calculateProfileCompletion } from "@/lib/api";
import { WordLogoIcon } from "@/components/file_format_icons";


interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  token: string | null;
  onProfileUpdated: () => void;
}

export function ProfileModal({
  isOpen,
  onClose,
  user,
  token,
  onProfileUpdated,
}: ProfileModalProps) {
  const [name, setName] = useState(user?.name || "");
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || "");
  const [address, setAddress] = useState(user?.address || "");
  const [linkedinUrl, setLinkedinUrl] = useState(user?.linkedin_url || "");

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCl, setIsUploadingCl] = useState(false);
  const [isDeletingCl, setIsDeletingCl] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPhoneNumber(user.phone_number || "");
      setAddress(user.address || "");
      setLinkedinUrl(user.linkedin_url || "");
    }
  }, [user]);

  if (!isOpen) return null;

  // Calculate live profile completion score
  const completion = calculateProfileCompletion({
    ...user,
    name,
    phone_number: phoneNumber,
    address,
    linkedin_url: linkedinUrl,
  });

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMsg(null);
    try {
      await updateProfile({
        name,
        phone_number: phoneNumber,
        address,
        linkedin_url: linkedinUrl,
      });
      setStatusMsg({ type: "success", text: "Profile contact details saved successfully!" });
      onProfileUpdated();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Failed to update profile." });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBaseCoverLetterUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".docx")) {
      setStatusMsg({ type: "error", text: "Only Word (.docx) cover letter templates are supported." });
      return;
    }
    setIsUploadingCl(true);
    setStatusMsg(null);
    try {
      const uploadRes = await uploadResume(file);
      await setBaseCoverLetter(uploadRes.document_id, file.name);
      setStatusMsg({ type: "success", text: "Base cover letter template uploaded and saved!" });
      onProfileUpdated();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Failed to upload cover letter template." });
    } finally {
      setIsUploadingCl(false);
    }
  };

  const handleDeleteBaseCoverLetter = async () => {
    if (!confirm("Are you sure you want to remove your saved base cover letter template?")) return;
    setIsDeletingCl(true);
    setStatusMsg(null);
    try {
      await deleteBaseCoverLetter();
      setStatusMsg({ type: "success", text: "Base cover letter template removed." });
      onProfileUpdated();
    } catch (err: any) {
      setStatusMsg({ type: "error", text: err?.message || "Failed to remove cover letter template." });
    } finally {
      setIsDeletingCl(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <UserIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Profile & Central Base Documents
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage contact info and master templates stored centrally for your applications
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1 text-sm">
          {/* Profile Completion Progress Card */}
          <div className="p-4 rounded-2xl border border-indigo-500/30 dark:border-indigo-500/20 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-emerald-500/5 dark:from-indigo-950/20 dark:to-emerald-950/20 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-indigo-500 animate-pulse" />
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Profile Completion Score
                </span>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full font-black text-xs border ${
                completion.totalPercentage === 100
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : "bg-indigo-500/10 text-indigo-600 border-indigo-500/30"
              }`}>
                {completion.totalPercentage}% Complete
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${completion.totalPercentage}%` }}
              />
            </div>

            {/* Breakdown List with Percentages */}
            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 space-y-1.5">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                Completion Breakdown by Item:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
                {completion.items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-2 rounded-xl border text-xs font-medium transition-all ${
                      item.isComplete
                        ? "bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-300"
                        : "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40 text-amber-800 dark:text-amber-300"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 truncate mr-2">
                      {item.isComplete ? (
                        <CheckCircle className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
                      )}
                      <span className="truncate">{item.label}</span>
                    </div>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 border ${
                      item.isComplete
                        ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border-emerald-200"
                        : "bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300 border-amber-200"
                    }`}>
                      {item.isComplete ? `+${item.weight}%` : `${item.weight}%`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {statusMsg && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-medium border flex items-center gap-2 ${
                statusMsg.type === "success"
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-300"
              }`}
            >
              <Info className="h-4 w-4 shrink-0" />
              <span>{statusMsg.text}</span>
            </div>
          )}

          {/* Form: Contact Details */}
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                Contact Details (Used in Executive Cover Letter Headers)
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Danielle Brasseur"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <UserIcon className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Phone Number
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. (313) 555-0100"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Phone className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Location / Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Carson City, NV | Seattle, WA"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <MapPin className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  LinkedIn URL / Portfolio
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    placeholder="e.g. linkedin.com/in/danielle"
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Globe className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>
            </div>

            <div className="p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-[11px] text-slate-600 dark:text-slate-400 flex items-start gap-2">
              <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />
              <span>
                <strong>Cover Letter Auto-Format Header preview:</strong>
                <br />
                {name || "YOUR NAME"} • {address || "Location"} | {phoneNumber || "Phone"} | {user?.email} | {linkedinUrl || "LinkedIn"}
              </span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isSaving ? "Saving..." : "Save Contact Info"}
              </button>
            </div>
          </form>

          {/* Central Base Documents Storage */}
          <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-emerald-500" />
              Central Base Master Documents
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Base Resume Storage Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <WordLogoIcon className="h-4 w-4 shrink-0" />
                    Master Base Resume (.docx)
                  </span>
                  {user?.base_resume_id ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Saved
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 text-[10px]">
                      Not uploaded
                    </span>
                  )}
                </div>

                {user?.base_resume_filename ? (
                  <div className="flex items-center gap-2 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs truncate text-slate-700 dark:text-slate-300">
                    <WordLogoIcon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{user.base_resume_filename}</span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Upload your master resume in the workspace to save it centrally here.
                  </p>
                )}
              </div>

              {/* Base Cover Letter Storage Card */}
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <WordLogoIcon className="h-4 w-4 shrink-0" />
                    Base Cover Letter (.docx)
                  </span>
                  {user?.base_cover_letter_id ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" /> Template Active
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]">
                      Using Default Style
                    </span>
                  )}
                </div>

                {user?.base_cover_letter_filename ? (
                  <div className="flex items-center justify-between p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs truncate text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-2 truncate">
                      <WordLogoIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{user.base_cover_letter_filename}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeleteBaseCoverLetter}
                      disabled={isDeletingCl}
                      className="p-1 text-slate-400 hover:text-red-500 transition-colors ml-2 cursor-pointer"
                      title="Remove cover letter template"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Upload your custom Word cover letter template to preserve your custom formatting.
                  </p>
                )}

                <label className="flex items-center justify-center gap-1.5 w-full py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-indigo-600 dark:text-indigo-400 transition-all cursor-pointer shadow-sm">
                  <WordLogoIcon className="h-4 w-4 shrink-0" />
                  <span>{isUploadingCl ? "Uploading..." : "Upload Cover Letter Template (.docx)"}</span>
                  <input
                    type="file"
                    accept=".docx"
                    onChange={handleBaseCoverLetterUpload}
                    className="hidden"
                    disabled={isUploadingCl}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
