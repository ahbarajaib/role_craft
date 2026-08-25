"use client";

import { Sparkles, Cpu, Layers, ShieldCheck, Zap, ArrowRight, FileText } from "lucide-react";

const features = [
  {
    icon: Sparkles,
    title: "1-Click Full Resume Auto-Tailor",
    desc: "Simultaneously rewrites your Professional Summary, weaves missing ATS keywords into your Technical Skills, and tailors Work Experience bullets in under 15 seconds.",
    tag: "1-Click AI Engine",
    gradient: "from-teal-600 to-teal-500",
    tagColor: "text-teal-700 bg-teal-50 border-teal-200",
  },
  {
    icon: Cpu,
    title: "Google XYZ Impact Formula Engine",
    desc: "Automatically restructures achievement bullets into high-impact format: 'Accomplished [X] as measured by [Y], by doing [Z]', maximizing recruiter evaluation scores.",
    tag: "Recruiter Formula",
    gradient: "from-indigo-600 to-blue-500",
    tagColor: "text-teal-700 bg-teal-50 border-teal-200",
  },
  {
    icon: Layers,
    title: "100% Visual DOCX Layout Preservation",
    desc: "Operates directly at low-level OpenXML (<w:numPr>, <w:t>, <w:rPr>). Never loses your custom font choices, alignment, margins, or bullet XML structure.",
    tag: "Formatting Guarantee",
    gradient: "from-blue-500 to-sky-400",
    tagColor: "text-sky-700 bg-sky-50 border-sky-200",
  },
  {
    icon: ShieldCheck,
    title: "Recruiter-Grade Truthfulness Rules",
    desc: "Enforces strict grounding guidelines. Never invents fake degrees or credentials, keeping all rewritten content 100% grounded in your actual background.",
    tag: "Zero Hallucinations",
    gradient: "from-blue-700 to-blue-500",
    tagColor: "text-teal-700 bg-teal-50 border-teal-200",
  },
  {
    icon: Zap,
    title: "Real-Time ATS Keyword Matrix",
    desc: "Scans job description text to detect confirmed matched skills, supported evidence keywords, and missing high-priority keywords ready for instant 1-click insertion.",
    tag: "ATS Keyword Weaver",
    gradient: "from-cyan-600 to-teal-600",
    tagColor: "text-cyan-700 bg-cyan-50 border-cyan-200",
  },
  {
    icon: FileText,
    title: "DOCX & PDF Instant Exports",
    desc: "Export your final tailored resume instantly as an editable Word `.docx` file or as a clean `.pdf` document ready to submit directly to job portals.",
    tag: "Instant Export",
    gradient: "from-blue-600 to-indigo-600",
    tagColor: "text-teal-700 bg-teal-50 border-teal-200",
  },
];

export default function FeaturesShowcase() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {features.map((f, i) => {
        const Icon = f.icon;
        return (
          <div key={i} className="feature-card p-6 flex flex-col justify-between space-y-4 group">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                {/* Gradient Icon Container */}
                <div className={`icon-gradient h-11 w-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center shrink-0`}>
                  <Icon className="h-5 w-5 text-white" strokeWidth={2} />
                </div>
                <span className={`text-[10px] font-extrabold border px-2 py-0.5 rounded-full uppercase tracking-wider ${f.tagColor}`}>
                  {f.tag}
                </span>
              </div>
              <h3 className="text-[15px] font-bold text-slate-900 group-hover:text-teal-700 transition-colors leading-snug">
                {f.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {f.desc}
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:text-teal-700">
              <span>Explore Capability</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1.5 transition-transform duration-200" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
