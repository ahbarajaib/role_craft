"use client";

import React from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  FileText, 
  Target, 
  Zap, 
  Lock, 
  Edit3, 
  ShieldCheck, 
  Globe 
} from "lucide-react";

export default function GuidePage() {
  return (
    <div className="min-h-screen hero-mesh text-slate-900 pb-20">
      {/* Simple Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-[#0B1120]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 shadow-sm transition-all duration-300 py-3">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2 group cursor-pointer">
            <div className="h-9 w-9 bg-teal-500 rounded-xl flex items-center justify-center shrink-0 shadow-sm shadow-teal-500/20 group-hover:scale-105 transition-transform">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
              RoleCraft
            </span>
          </Link>
          <Link
            href="/#workspace"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 shadow-sm transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Workspace
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 mt-12 space-y-16 animate-fade-in-up">
        {/* Title Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-black uppercase tracking-wider mb-2">
            <Zap className="h-3.5 w-3.5 text-teal-600" />
            <span>Official Guide</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight">
            How to Win with <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500">RoleCraft</span>
          </h1>
          <p className="text-lg text-slate-500 font-medium max-w-2xl mx-auto">
            No fluff. Just the exact steps and pro-tips you need to beat ATS scanners and triple your interview callbacks.
          </p>
        </div>

        {/* Section 1: The Golden Path */}
        <section className="space-y-6">
          <h2 className="text-2xl font-black text-slate-800 border-b border-slate-200 pb-3">
            The 30-Second Golden Path
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:border-teal-300 transition-all group">
              <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-200 mb-4 group-hover:scale-110 group-hover:bg-teal-500 group-hover:text-white transition-all shadow-sm">
                <FileText className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">1. The Master Resume</h3>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Upload a comprehensive DOCX containing all your past experience. Don't worry if it's 3 pages long—the AI will trim the fat.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-lg hover:border-teal-300 transition-all group">
              <div className="h-12 w-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center border border-teal-200 mb-4 group-hover:scale-110 group-hover:bg-teal-500 group-hover:text-white transition-all shadow-sm">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-slate-900 mb-2">2. The Target JD</h3>
              <p className="text-sm text-slate-600 font-medium leading-relaxed">
                Paste the Job Description you are applying for. The more detailed it is, the better the AI can identify missing keywords.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-[#0F172A] to-teal-900 border border-teal-700 shadow-lg hover:shadow-teal-500/20 transition-all group relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-teal-500/20 rounded-full blur-2xl group-hover:bg-teal-400/30 transition-colors" />
              <div className="h-12 w-12 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center border border-teal-500/30 mb-4 group-hover:scale-110 group-hover:bg-teal-400 group-hover:text-slate-900 transition-all shadow-sm relative z-10">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-extrabold text-white mb-2 relative z-10">3. The Magic</h3>
              <p className="text-sm text-teal-100/80 font-medium leading-relaxed relative z-10">
                Hit <strong>1-Click Tailor</strong>. We rewrite your bullets using the Google X-Y-Z formula and weave in ATS keywords seamlessly.
              </p>
            </div>
          </div>
        </section>

        {/* Section 2: Pro Tips Bento Box */}
        <section className="space-y-6">
          <h2 className="text-2xl font-black text-slate-800 border-b border-slate-200 pb-3">
            Pro Tips & Hidden Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Bento 1: Extension (Spans 2 columns) */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-50/80 hover:bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-300 transition-all group overflow-hidden relative">
              <div className="absolute right-0 bottom-0 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 translate-y-4">
                <Globe className="w-32 h-32 text-blue-600" />
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center border border-blue-200 mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <Zap className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Browser Extensions</h3>
              <p className="text-sm text-slate-600 font-medium max-w-sm relative z-10">
                Install our Chrome extensions to <strong>1-Click import</strong> job descriptions straight from LinkedIn, Bayt, or Naukri without messy copy-pasting.
              </p>
            </div>

            {/* Bento 2: Locking Sections */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-50/80 hover:bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-amber-300 transition-all group overflow-hidden relative">
              <div className="absolute right-0 bottom-0 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 translate-y-4">
                <Lock className="w-32 h-32 text-amber-600" />
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center border border-amber-200 mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <Lock className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Locking Sections</h3>
              <p className="text-sm text-slate-600 font-medium relative z-10">
                Don't want the AI to touch your Education or a specific project? Toggle the section OFF in the Pre-Analysis controls to lock it.
              </p>
            </div>

            {/* Bento 3: Edit Master */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-50/80 hover:bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all group overflow-hidden relative">
               <div className="absolute right-0 bottom-0 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 translate-y-4">
                <Edit3 className="w-32 h-32 text-emerald-600" />
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center border border-emerald-200 mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <Edit3 className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Edit Master JSON</h3>
              <p className="text-sm text-slate-600 font-medium relative z-10">
                Click the 'Edit' button on your base resume to manually fix parsed dates or skills <em>before</em> the AI analyzes them. 
              </p>
            </div>

            {/* Bento 4: Why DOCX */}
            <div className="lg:col-span-2 p-6 rounded-3xl bg-slate-50/80 hover:bg-white border border-slate-200 shadow-sm hover:shadow-md hover:border-purple-300 transition-all group overflow-hidden relative">
               <div className="absolute right-0 bottom-0 opacity-5 group-hover:opacity-10 transition-opacity transform translate-x-4 translate-y-4">
                <ShieldCheck className="w-32 h-32 text-purple-600" />
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center border border-purple-200 mb-4 shadow-sm group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-black text-slate-900 mb-2">Why DOCX Only?</h3>
              <p className="text-sm text-slate-600 font-medium relative z-10">
                ATS scanners hate broken PDFs. We require DOCX uploads so we can patch your XML data without ruining your beautiful formatting.
              </p>
            </div>
            
          </div>
        </section>

      </main>
    </div>
  );
}
