"use client";

import { useState } from "react";
import { Sparkles, AlertCircle, CheckCircle2, Sliders, ArrowRight } from "lucide-react";

export default function BeforeAfterSlider() {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [activeTab, setActiveTab] = useState<"bullet1" | "bullet2" | "bullet3">("bullet1");

  const examples = {
    bullet1: {
      role: "Full Stack Engineer",
      before: {
        text: "Worked on React and Node.js applications for client web projects and fixed database performance bugs.",
        flaws: ["No quantifiable impact", "Passive action verbs", "Missed core ATS keywords: RAG Systems, Microservices, Redis"],
        score: "42% ATS Match",
      },
      after: {
        text: "Engineered scalable React.js & Node.js microservices, reducing API query response latency by 42% across 15+ production modules using Redis caching and RAG workflows.",
        gains: ["Google XYZ Formula Applied", "+42% Speed Metric", "100% ATS Keyword Match"],
        score: "96% ATS Match",
      },
    },
    bullet2: {
      role: "AI & ML Engineer",
      before: {
        text: "Used OpenAI APIs and Python scripts to build a chatbot for customer support.",
        flaws: ["Lacks engineering depth", "Zero accuracy metrics", "Generic wording"],
        score: "48% ATS Match",
      },
      after: {
        text: "Architected enterprise RAG chatbot using OpenAI GPT-4o APIs and Vector Embeddings, boosting first-contact resolution rates by 38% while processing 25,000+ monthly queries.",
        gains: ["Enterprise Scope Highlighted", "38% Resolution Metric", "High-Impact AI Action Verbs"],
        score: "98% ATS Match",
      },
    },
    bullet3: {
      role: "Backend Developer",
      before: {
        text: "Responsible for managing PostgreSQL database tables and writing REST API endpoints.",
        flaws: ["Passive 'Responsible for' phrasing", "No scale or volume metrics", "Unformatted bullets"],
        score: "39% ATS Match",
      },
      after: {
        text: "Spearheaded PostgreSQL database schema refactoring and optimized REST API throughput, supporting 100k+ daily active users with 99.9% uptime SLA.",
        gains: ["Active Verb 'Spearheaded'", "100k+ DAU & 99.9% SLA Metric", "Recruiter-Grade Structure"],
        score: "95% ATS Match",
      },
    },
  };

  const current = examples[activeTab];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Role Selection Tabs */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {(Object.keys(examples) as Array<keyof typeof examples>).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              activeTab === key
                ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            {examples[key].role}
          </button>
        ))}
      </div>

      {/* Visual Comparison Card */}
      <div className="relative rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xl overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          
          {/* BEFORE CARD */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-rose-700 bg-rose-100 px-2.5 py-1 rounded-full border border-rose-200">
                <AlertCircle className="h-3.5 w-3.5" /> Before (Generic Resume)
              </span>
              <span className="text-xs font-extrabold text-rose-600">
                {current.before.score}
              </span>
            </div>
            
            <p className="text-sm text-slate-800 font-medium leading-relaxed bg-white/80 p-3.5 rounded-lg border border-rose-100 italic">
              "{current.before.text}"
            </p>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Flaws detected:</span>
              <ul className="space-y-1 text-xs text-rose-700 font-medium">
                {current.before.flaws.map((flaw, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                    <span>{flaw}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* AFTER CARD */}
          <div className="rounded-xl border border-emerald-300 bg-emerald-50/40 p-5 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> After (RoleCraft 1-Click Tailored)
              </span>
              <span className="text-xs font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200">
                {current.after.score}
              </span>
            </div>

            <p className="text-sm text-slate-900 font-semibold leading-relaxed bg-white p-3.5 rounded-lg border border-emerald-200 shadow-sm">
              "{current.after.text}"
            </p>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Optimizations applied:</span>
              <ul className="space-y-1 text-xs text-emerald-800 font-semibold">
                {current.after.gains.map((gain, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>{gain}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
