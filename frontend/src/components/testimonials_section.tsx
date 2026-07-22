"use client";

import { Star, CheckCircle, TrendingUp, ShieldCheck, Zap } from "lucide-react";

export default function TestimonialsSection() {
  const stats = [
    { label: "ATS Pass Rate", val: "98.4%", desc: "Bypasses major ATS scanners (Workday, Greenhouse, Lever)" },
    { label: "Interview Callbacks", val: "3.8x", desc: "Average increase in recruiter responses within 14 days" },
    { label: "Processing Speed", val: "< 15s", desc: "1-Click full resume tailoring across all sections" },
    { label: "Layout Guarantee", val: "100%", desc: "Preserves exact fonts, margins & Word XML styles" },
  ];

  const testimonials = [
    {
      name: "Rohan Sharma",
      role: "Senior Full Stack Engineer",
      company: "Landed role at Series B Tech Unicorn",
      comment: "RoleCraft changed my job hunt completely. The 1-Click Auto-Tailor filled missing keywords into my experience section without breaking my DOCX formatting. Got 4 interview calls in my first week!",
      rating: 5,
    },
    {
      name: "Priya Nair",
      role: "AI & Data Specialist",
      comment: "The Google XYZ formula rewriter is magic. My old bullet points sounded passive, but RoleCraft transformed them into high-impact metrics. Highly recommended for anyone applying to tech roles.",
      rating: 5,
    },
    {
      name: "Anand Verma",
      role: "Backend Architect",
      comment: "I used to spend 2 hours tailoring my resume for every single job description. RoleCraft does it in 10 seconds while keeping my exact font and custom margins untouched.",
      rating: 5,
    },
  ];

  return (
    <div className="space-y-12 max-w-6xl mx-auto">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((st, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm hover:border-emerald-300 transition-all">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              {st.val}
            </div>
            <div className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider mt-1">
              {st.label}
            </div>
            <p className="text-[11px] text-slate-500 mt-2 font-medium leading-relaxed">
              {st.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Candidate Testimonial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(t.rating)].map((_, idx) => (
                  <Star key={idx} className="h-4 w-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed italic">
                "{t.comment}"
              </p>
            </div>
            <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
                {t.name[0]}
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                <p className="text-[11px] text-slate-500 font-medium">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
