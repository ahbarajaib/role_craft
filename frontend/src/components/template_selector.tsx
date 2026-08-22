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
    colorScheme: "border-slate-300 bg-white",
  },
  {
    id: "modern_professional",
    title: "Modern Professional",
    subtitle: "Calibri font, subtle navy section dividers, crisp spacing.",
    font: "Calibri",
    badge: "Popular",
    hasPhotoSupport: false,
    colorScheme: "border-blue-200 bg-blue-50/20",
  },
  {
    id: "executive_profile",
    title: "Executive Profile",
    subtitle: "Aptos/Calibri font, blue accents, optional profile photo header.",
    font: "Aptos / Calibri",
    badge: "Supports Photo",
    hasPhotoSupport: true,
    colorScheme: "border-blue-300 bg-blue-50/30",
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
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Layout className="h-3.5 w-3.5 text-blue-600" />
          Select ATS Template
        </h3>
        {sourceFormat === "docx" && (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-emerald-500" /> Auto-Matched from Upload
          </span>
        )}
        {sourceFormat === "pdf" && (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
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
                  ? "border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/50"
                  : "border-slate-200 hover:border-blue-300 bg-white"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold text-slate-900 flex items-center gap-1">
                    {tmpl.title}
                  </span>
                  {isSelected && (
                    <span className="h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-tight mb-2">
                  {tmpl.subtitle}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] font-medium text-slate-400">
                <span>Font: {tmpl.font}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md font-bold text-[9px] ${
                    tmpl.hasPhotoSupport
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-600"
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
