"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { FREE_TIER_CREDITS, PRO_CREDITS, ELITE_CREDITS } from "@/lib/constants";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export default function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "Does RoleCraft preserve 100% of my DOCX document formatting and fonts?",
      a: "Yes, 100%. Unlike tools that paste your resume into a text box and lose all your fonts, spacing, and layout — RoleCraft rewrites only the text inside your existing sections. Your original DOCX comes back exactly as you designed it.",
    },
    {
      q: "How does the 1-Click Auto-Tailoring feature work?",
      a: "When you click '⚡ Auto-Tailor Full Resume', RoleCraft reads your resume and the job description together. It rewrites your Professional Summary, updates your Skills section with relevant keywords, and strengthens your Work Experience bullet points — all in one go.",
    },
    {
      q: "How does RoleCraft rewrite my bullet points?",
      a: "RoleCraft strengthens weak bullet points by making them more specific, results-focused, and relevant to the job you're applying for. Instead of 'Worked on backend systems', it rewrites to something like 'Built backend API that reduced response time by 40%'. Clearer, stronger, more likely to get noticed.",
    },
    {
      q: "How do monthly credits work?",
      a: `Every new account receives ${FREE_TIER_CREDITS} free credits. Pro users get ${PRO_CREDITS} credits/mo and Elite users get ${ELITE_CREDITS} credits/mo. 1 credit is used for a section rewrite or document patch.`,
    },
    {
      q: "What is the LinkedIn 1-Click Copier Chrome Extension and who gets access?",
      a: "Our companion Chrome Extension adds a smart 'Copy Job Details' button directly to LinkedIn job pages. It automatically expands descriptions, strips out ads/UI clutter, and formats clean job requirements ready for RoleCraft. It is included free for all Pro and Elite subscribers and installs in 15 seconds.",
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
    <div className="w-full max-w-4xl mx-auto space-y-3.5">
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <Card
            key={idx}
            variant="default"
            className={cn(
              "overflow-hidden transition-all duration-200",
              isOpen
                ? "border-teal-300 ring-2 ring-teal-500/10 shadow-md"
                : "border-slate-200/90 hover:border-teal-200"
            )}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : idx)}
              className="w-full p-5 text-left font-bold text-sm sm:text-base text-slate-900 flex items-center justify-between gap-4 cursor-pointer select-none"
            >
              <span className="flex items-center gap-2.5">
                <HelpCircle
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isOpen ? "text-teal-600" : "text-teal-500"
                  )}
                />
                {faq.q}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200",
                  isOpen && "rotate-180 text-teal-600"
                )}
              />
            </button>
            {isOpen && (
              <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3.5 animate-fade-in">
                {faq.a}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
