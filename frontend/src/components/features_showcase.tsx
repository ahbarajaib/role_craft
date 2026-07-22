"use client";

import { Sparkles, Cpu, Layers, ShieldCheck, Zap, ArrowRight, FileText, CheckCircle2 } from "lucide-react";

export default function FeaturesShowcase() {
  const features = [
    {
      icon: Sparkles,
      title: "1-Click Full Resume Auto-Tailor",
      desc: "Simultaneously rewrites your Professional Summary, weaves missing ATS keywords into your Technical Skills, and tailors Work Experience bullets in under 15 seconds.",
      tag: "1-Click AI Engine",
    },
    {
      icon: Cpu,
      title: "Google XYZ Impact Formula Engine",
      desc: "Automatically restructures achievement bullets into high-impact format: 'Accomplished [X] as measured by [Y], by doing [Z]', maximizing recruiter evaluation scores.",
      tag: "Recruiter Formula",
    },
    {
      icon: Layers,
      title: "100% Visual DOCX Layout Preservation",
      desc: "Operates directly at low-level OpenXML (<w:numPr>, <w:t>, <w:rPr>). Never loses your custom font choices, alignment, margins, or bullet XML structure.",
      tag: "Formatting Guarantee",
    },
    {
      icon: ShieldCheck,
      title: "Recruiter-Grade Truthfulness Rules",
      desc: "Enforces strict grounding guidelines. Never invents fake degrees or credentials, keeping all rewritten content 100% grounded in your actual background.",
      tag: "Zero Hallucinations",
    },
    {
      icon: Zap,
      title: "Real-Time ATS Keyword Matrix",
      desc: "Scans job description text to detect confirmed matched skills, supported evidence keywords, and missing high-priority keywords ready for instant 1-click insertion.",
      tag: "ATS Keyword Weaver",
    },
    {
      icon: FileText,
      title: "DOCX & PDF Instant Exports",
      desc: "Export your final tailored resume instantly as an editable Word `.docx` file or as a clean `.pdf` document ready to submit directly to job portals.",
      tag: "Instant Export",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {features.map((f, i) => {
        const Icon = f.icon;
        return (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4 group"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded uppercase tracking-wider">
                  {f.tag}
                </span>
              </div>
              <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                {f.title}
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                {f.desc}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-emerald-600">
              <span>Explore Capability</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
