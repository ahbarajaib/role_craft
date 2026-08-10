"use client";

import React from "react";
import { Check, Sparkles, User, FileText, Layout } from "lucide-react";

export interface TemplateOption {
  id: "clean_classic" | "modern_professional" | "executive_profile";
  title: string;
  subtitle: string;
  font: string;
  badge: string;
  hasPhotoSupport: boolean;
  colorScheme: string;
}

export const TEMPLATES: TemplateOption[] = [
  {
    id: "clean_classic",
    title: "Clean Classic",
    subtitle: "Minimalist academic & corporate standard. Maximum ATS pass rate.",
    font: "Times New Roman",
    badge: "100% ATS Safe",
    hasPhotoSupport: false,
    colorScheme: "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900",
  },
  {
    id: "modern_professional",
    title: "Modern Professional",
    subtitle: "Calibri font, subtle navy section dividers, crisp spacing.",
    font: "Calibri",
    badge: "Popular",
    hasPhotoSupport: false,
    colorScheme: "border-indigo-200 dark:border-indigo-900 bg-indigo-50/20 dark:bg-indigo-950/20",
  },
  {
    id: "executive_profile",
    title: "Executive Profile",
    subtitle: "Aptos/Calibri font, blue accents, optional profile photo header.",
    font: "Aptos / Calibri",
    badge: "Supports Photo",
    hasPhotoSupport: true,
    colorScheme: "border-blue-300 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/30",
  },
];

interface TemplateSelectorProps {
  selectedTemplate: string;
  onSelectTemplate: (templateId: "clean_classic" | "modern_professional" | "executive_profile") => void;
  sourceFormat?: string | null;
}

export default function TemplateSelector({
  selectedTemplate,
  onSelectTemplate,
  sourceFormat,
}: TemplateSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Layout className="h-3.5 w-3.5 text-indigo-500" />
          Select ATS Template
        </h3>
        {sourceFormat === "docx" && (
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Auto-Matched from Upload
          </span>
        )}
        {sourceFormat === "pdf" && (
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-full">
            PDF Uploaded — Choose ATS Template
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TEMPLATES.map((tmpl) => {
          const isSelected = selectedTemplate === tmpl.id;
          return (
            <button
              key={tmpl.id}
              type="button"
              onClick={() => onSelectTemplate(tmpl.id)}
              className={`relative text-left p-3.5 rounded-2xl border transition-all cursor-pointer shadow-sm flex flex-col justify-between ${
                isSelected
                  ? "border-indigo-600 dark:border-indigo-400 ring-2 ring-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/40"
                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                    {tmpl.title}
                  </span>
                  {isSelected && (
                    <span className="h-4 w-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mb-2">
                  {tmpl.subtitle}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px] font-medium text-slate-400">
                <span>Font: {tmpl.font}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                    tmpl.hasPhotoSupport
                      ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {tmpl.badge}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
