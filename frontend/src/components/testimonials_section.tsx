"use client";

import { Star, CheckCircle, TrendingUp, ShieldCheck, Zap, Briefcase, Award } from "lucide-react";

export default function TestimonialsSection() {
  const testimonials = [
    {
      name: "Rohan Sharma",
      role: "Senior Full Stack Engineer",
      company: "Placed at Series B Tech Unicorn",
      salaryGain: "From 1 call/mo → 5 calls/week",
      comment: "RoleCraft changed my job hunt completely. The 1-Click Auto-Tailor filled missing keywords into my experience section without breaking my DOCX formatting. Got 4 interview callbacks in my first week!",
      rating: 5,
      roleTag: "Software Engineering",
    },
    {
      name: "Priya Nair",
      role: "AI & Data Specialist",
      company: "Placed at Global Analytics Firm",
      salaryGain: "+45% Callback Improvement",
      comment: "The Google XYZ formula rewriter is magic. My old bullet points sounded like plain task lists, but RoleCraft transformed them into quantified metrics. Landed 3 final rounds within 10 days.",
      rating: 5,
      roleTag: "Data & AI",
    },
    {
      name: "Anand Verma",
      role: "Solutions & Cloud Architect",
      company: "Enterprise Cloud Placement",
      salaryGain: "Bypassed Workday & Lever ATS",
      comment: "I used to spend 2 hours tailoring my resume for every single job posting. RoleCraft does it in under 15 seconds while keeping my exact custom margins and font styling 100% untouched.",
      rating: 5,
      roleTag: "Cloud Architecture",
    },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Candidate Testimonial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {testimonials.map((t, i) => (
          <div
            key={i}
            className={`rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm hover:shadow-xl hover:shadow-teal-500/10 hover:border-teal-300 transition-all flex flex-col justify-between space-y-6 glass-card-interactive relative overflow-hidden reveal-on-scroll ${
              i === 1 ? "reveal-delay-1" : i === 2 ? "reveal-delay-2" : ""
            }`}
          >
            <div className="space-y-4">
              {/* Header with stars & conversion pill */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-1 text-amber-400">
                  {[...Array(t.rating)].map((_, idx) => (
                    <Star key={idx} className="h-4 w-4 fill-amber-400" />
                  ))}
                </div>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-[#E6F7F4] text-teal-800 border border-[#99F6E4] shadow-2xs">
                  <TrendingUp className="h-3 w-3 text-teal-600" />
                  {t.salaryGain}
                </span>
              </div>

              {/* Quote */}
              <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed italic">
                &ldquo;{t.comment}&rdquo;
              </p>
            </div>

            {/* Candidate Footer */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-[#0F172A] via-teal-700 to-[#14B8A6] text-white font-black flex items-center justify-center text-xs shadow-md shadow-teal-500/20">
                  {t.name[0]}
                </div>
                <div>
                  <h4 className="text-xs font-black text-[#0F172A] flex items-center gap-1.5">
                    <span>{t.name}</span>
                    <CheckCircle className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  </h4>
                  <p className="text-[11px] text-slate-500 font-semibold">{t.role}</p>
                </div>
              </div>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                {t.roleTag}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

