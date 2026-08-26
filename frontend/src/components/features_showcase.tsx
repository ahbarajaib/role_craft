"use client";

import { useState } from "react";
import { Sparkles, Cpu, Layers, ShieldCheck, Zap, ArrowRight, FileText, CheckCircle2, Sliders, RefreshCw, FileCode, Check } from "lucide-react";

export default function FeaturesShowcase() {
  const [activeTab, setActiveTab] = useState<"summary" | "skills" | "experience">("experience");

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Bento Grid Container */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Bento 1 (Span 2 Columns): 1-Click Auto-Tailor Hero Bento */}
        <div className="md:col-span-2 rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-8 shadow-sm hover:shadow-xl hover:shadow-teal-500/10 hover:border-teal-300 transition-all space-y-6 relative overflow-hidden group glass-card-interactive reveal-on-scroll">
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E6F7F4] border border-[#99F6E4] text-teal-800 text-[11px] font-black uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-[#FF6B4A]" />
                <span>Featured AI Architecture</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-[#0F172A] tracking-tight">
                1-Click Full Resume Auto-Tailor Engine
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 font-medium max-w-lg leading-relaxed">
                Simultaneously transforms summary, Technical Skills matrix, and work history to align with recruiter criteria in under 15 seconds.
              </p>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl self-start sm:self-auto shrink-0 border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("experience")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "experience" ? "bg-white text-teal-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Experience
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("skills")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "skills" ? "bg-white text-teal-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Skills
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeTab === "summary" ? "bg-white text-teal-700 shadow-2xs" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Summary
              </button>
            </div>
          </div>

          {/* Interactive Live Diff Card */}
          <div className="p-4 sm:p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 space-y-3 font-sans text-xs">
            <div className="flex items-center justify-between text-[11px] font-extrabold pb-2 border-b border-slate-200/60">
              <span className="text-slate-400 uppercase tracking-wider">Live Tailoring Preview</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 font-black">
                <Check className="h-3.5 w-3.5 stroke-[3]" /> Recruiter Score: 98/100
              </span>
            </div>

            {activeTab === "experience" && (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-red-50/60 border border-red-100 text-slate-600 line-through opacity-70">
                  &quot;Responsible for writing backend APIs and helping team manage cloud infrastructure.&quot;
                </div>
                <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-slate-800 font-medium flex items-start gap-2 shadow-2xs">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-600 text-white font-extrabold text-[10px] shrink-0 mt-0.5">
                    Tailored
                  </span>
                  <span>
                    &quot;Architected resilient distributed REST &amp; gRPC microservices on Kubernetes, reducing API latency by <strong>42%</strong> across <strong>1.5M+ daily requests</strong>.&quot;
                  </span>
                </div>
              </div>
            )}

            {activeTab === "skills" && (
              <div className="space-y-2">
                <span className="text-[11px] text-slate-500 font-semibold">Matched &amp; Inserted ATS Competencies:</span>
                <div className="flex flex-wrap gap-2 pt-1">
                  <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-bold flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 className="h-3 w-3 text-teal-600" /> Distributed Systems
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 font-bold flex items-center gap-1 shadow-2xs">
                    <CheckCircle2 className="h-3 w-3 text-teal-600" /> Cloud Orchestration
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold flex items-center gap-1 shadow-2xs">
                    <Sparkles className="h-3 w-3 text-[#FF6B4A]" /> Low-Latency gRPC
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
                    PostgreSQL / Redis
                  </span>
                </div>
              </div>
            )}

            {activeTab === "summary" && (
              <div className="space-y-2">
                <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 text-slate-800 leading-relaxed font-medium">
                  &quot;Results-driven Software Engineer with 6+ years of expertise designing high-throughput backend services and cloud automation. Proven track record scaling infrastructure for 500K+ concurrent users with zero downtime.&quot;
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bento 2: Google XYZ Formula Engine */}
        <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-sm hover:shadow-xl hover:shadow-teal-500/10 hover:border-teal-300 transition-all flex flex-col justify-between space-y-6 relative overflow-hidden group glass-card-interactive reveal-on-scroll reveal-delay-1">
          <div className="space-y-4">
            <div className="ai-icon-wrap glow-teal">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0F172A] via-teal-700 to-[#14B8A6] text-white flex items-center justify-center shadow-md shadow-teal-500/30 group-hover:scale-105 transition-transform">
                <Cpu className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#E6F7F4] text-teal-800 border border-[#99F6E4] uppercase tracking-wider">
                Recruiter Benchmark
              </span>
              <h4 className="text-lg font-extrabold text-[#0F172A] mt-2">
                Google XYZ Formula Rewriter
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                Converts passive duty statements into quantified achievements: <em>&quot;Accomplished [X], measured by [Y], by doing [Z]&quot;</em>.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
            <div className="text-[11px] font-bold text-slate-500 flex items-center justify-between">
              <span>Impact Metric Multiplier</span>
              <span className="font-extrabold text-emerald-600">+3.8x Callbacks</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full w-[88%]" />
            </div>
          </div>
        </div>

        {/* Bento 3: 100% Visual DOCX Layout Preservation */}
        <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-sm hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300 transition-all flex flex-col justify-between space-y-6 relative overflow-hidden group glass-card-interactive reveal-on-scroll">
          <div className="space-y-4">
            <div className="ai-icon-wrap glow-blue">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0F172A] via-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30 group-hover:scale-105 transition-transform">
                <Layers className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#E6F7F4] text-teal-800 border border-[#99F6E4] uppercase tracking-wider">
                Zero Template Drift
              </span>
              <h4 className="text-lg font-extrabold text-[#0F172A] mt-2">
                100% DOCX OpenXML Fidelity
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                Operates directly at the native OpenXML paragraph (<code className="text-[10px] font-mono">&lt;w:p&gt;</code>) and run (<code className="text-[10px] font-mono">&lt;w:r&gt;</code>) level. Margins, fonts, and tables stay 100% intact.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-extrabold text-teal-700 bg-teal-50/70 p-3 rounded-xl border border-teal-200/80">
            <CheckCircle2 className="h-4 w-4 text-teal-600 shrink-0" />
            <span>Word Tables, Headers &amp; Fonts Preserved</span>
          </div>
        </div>

        {/* Bento 4: ATS Keyword Weaver & Real-Time Matrix */}
        <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-sm hover:shadow-xl hover:shadow-violet-500/10 hover:border-violet-300 transition-all flex flex-col justify-between space-y-6 relative overflow-hidden group glass-card-interactive reveal-on-scroll reveal-delay-1">
          <div className="space-y-4">
            <div className="ai-icon-wrap glow-purple">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0F172A] via-violet-700 to-purple-600 text-white flex items-center justify-center shadow-md shadow-violet-500/30 group-hover:scale-105 transition-transform">
                <Zap className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#E6F7F4] text-teal-800 border border-[#99F6E4] uppercase tracking-wider">
                Real-Time Scanner
              </span>
              <h4 className="text-lg font-extrabold text-[#0F172A] mt-2">
                Domain-Agnostic ATS Matrix
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                Evaluates job descriptions across any profession (engineering, healthcare, sales, finance) and maps critical keywords dynamically.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <span>Passes Scanner Checks</span>
            <span className="text-teal-700">Workday • Lever • Taleo</span>
          </div>
        </div>

        {/* Bento 5: Strict Truthfulness Shield & Multi-Format Exports */}
        <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-sm hover:shadow-xl hover:shadow-orange-500/10 hover:border-orange-300 transition-all flex flex-col justify-between space-y-6 relative overflow-hidden group glass-card-interactive reveal-on-scroll reveal-delay-2">
          <div className="space-y-4">
            <div className="ai-icon-wrap glow-coral">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-[#0F172A] via-orange-600 to-amber-500 text-white flex items-center justify-center shadow-md shadow-orange-500/30 group-hover:scale-105 transition-transform">
                <ShieldCheck className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#E6F7F4] text-teal-800 border border-[#99F6E4] uppercase tracking-wider">
                Recruiter-Grade
              </span>
              <h4 className="text-lg font-extrabold text-[#0F172A] mt-2">
                Zero Hallucinations Guarantee
              </h4>
              <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                Strict evidence bounding ensures the AI never invents false credentials, degrees, or employers. Exports as clean DOCX and PDF.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">DOCX Word</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">Clean PDF</span>
            <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 font-extrabold">Verified Grounding</span>
          </div>
        </div>

      </div>
    </div>
  );
}

