"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "Does RoleCraft preserve 100% of my DOCX document formatting and fonts?",
      a: "Yes, 100%. Unlike generic tools that convert your resume into plain text or destroy your custom styles, RoleCraft operates at low-level OpenXML. It preserves your exact font families, font sizes, margins, bullet list XML (<w:numPr>), colors, and table structures.",
    },
    {
      q: "How does the 1-Click Auto-Tailoring feature work?",
      a: "When you click '⚡ Auto-Tailor Full Resume', RoleCraft concurrently analyzes your base resume against the target Job Description. It rewrites your Professional Summary, weaves missing ATS keywords into your Technical Skills, and formats your Work Experience bullets using Google's XYZ Formula.",
    },
    {
      q: "What is Google's XYZ Impact Formula?",
      a: "Google's formula structures achievement bullets as: 'Accomplished [X] as measured by [Y], by doing [Z]'. RoleCraft automatically converts weak bullet points into high-impact, quantifiable statements that capture recruiter attention immediately.",
    },
    {
      q: "How do monthly credits work?",
      a: "Every new account receives 50 free credits per month. Pro users get 200 credits/mo and Elite users get 400 credits/mo. 1 credit is used for a section rewrite or document patch.",
    },
    {
      q: "Can I download my final tailored resume as both DOCX and PDF?",
      a: "Yes! Once you accept section rewrites, you can download your tailored resume as an editable `.docx` file or as a clean `.pdf` ready for instant job applications.",
    },
    {
      q: "Is my personal data and resume content secure?",
      a: "Absolutely. We adhere to strict data privacy standards. Your uploaded resumes and generated content are encrypted and processed securely. We never sell your personal information or share resume text with third parties.",
    },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 bg-white transition-all overflow-hidden shadow-sm hover:border-slate-300"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full p-5 text-left font-bold text-sm sm:text-base text-slate-900 flex items-center justify-between gap-4 cursor-pointer select-none"
            >
              <span className="flex items-center gap-2.5">
                <HelpCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                {faq.q}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-emerald-600" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-5 pt-0 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                {faq.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
