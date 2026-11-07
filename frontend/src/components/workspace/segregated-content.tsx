"use client";

import React from "react";
import type { StructuredResume } from "@/lib/structured_resume_api";
import { parseTextIntoStructuredEntries } from "@/lib/resume-utils";

export function FormattedSectionText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;

  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  const bulletSymbols = ["•", "-", "*", "–", "—", "▪", "▸"];

  // Heuristic: if most lines are long sentences (> 40 chars), treat the whole block as
  // a bullet list even if there are no explicit bullet symbols.
  const longSentenceLines = lines.filter(
    (l) => l.trim().length > 40 && !l.trim().includes(": ")
  );
  const isImplicitBulletBlock =
    lines.length >= 2 &&
    longSentenceLines.length >= Math.ceil(lines.length * 0.6);

  return (
    <div className={`space-y-2.5 text-[13px] text-slate-800 dark:text-slate-200 leading-relaxed ${className || ""}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        const bulletMatch = bulletSymbols.find((s) => trimmed.startsWith(s));

        // Case 1: Explicit bullet symbol prefix
        if (bulletMatch) {
          const content = trimmed.substring(bulletMatch.length).trim();
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="text-teal-600 dark:text-teal-400 font-bold shrink-0 mt-0.5 select-none">•</span>
              <p className="flex-1 select-all">{content}</p>
            </div>
          );
        }

        // Case 2: Skills category lines
        const colonIdx = trimmed.indexOf(":");
        const labelPart = colonIdx > 0 ? trimmed.substring(0, colonIdx) : "";
        const restPart = colonIdx > 0 ? trimmed.substring(colonIdx + 1).trim() : "";

        const isSkillCategory =
          !isImplicitBulletBlock &&
          colonIdx > 0 &&
          labelPart.length >= 3 &&
          labelPart.length <= 45 &&
          labelPart.split(" ").length <= 6 &&
          labelPart[0] === labelPart[0].toUpperCase() &&
          (restPart.includes(",") || restPart.split(" ").length <= 8);

        if (isSkillCategory) {
          const label = trimmed.substring(0, colonIdx + 1);
          const rest = trimmed.substring(colonIdx + 1);
          return (
            <div
              key={idx}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 select-all flex flex-wrap items-baseline gap-1.5"
            >
              <span className="font-bold text-teal-700 dark:text-teal-300 text-xs tracking-wide uppercase">
                {label}
              </span>
              <span className="text-slate-800 dark:text-slate-200 text-xs">{rest}</span>
            </div>
          );
        }

        // Case 3: Job Title / Role & Date header line
        const lowerLine = trimmed.toLowerCase();
        const isDateHeader = /\b(19|20)\d{2}\b/.test(trimmed) || lowerLine.includes("present");
        const isJobRoleHeader =
          !isImplicitBulletBlock &&
          (isDateHeader ||
            ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst"].some((r) =>
              lowerLine.includes(r)
            ));

        if (isJobRoleHeader && trimmed.length < 90 && !trimmed.endsWith(".")) {
          return (
            <div
              key={idx}
              className="font-extrabold text-slate-900 dark:text-white text-sm pt-2.5 pb-1 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 mt-1"
            >
              <span>{trimmed}</span>
            </div>
          );
        }

        // Case 4: Company & Location header line
        const isCompanyHeader =
          !isImplicitBulletBlock &&
          (trimmed.includes(",") || trimmed.endsWith(".")) &&
          ["inc", "ltd", "llc", "fze", "pvt", "corp", "dubai", "uae", "usa", "uk", "india", "bangalore", "remote", "freelance"].some((loc) =>
            lowerLine.includes(loc)
          );

        if (isCompanyHeader && trimmed.length < 80) {
          return (
            <div key={idx} className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs italic mb-2">
              {trimmed}
            </div>
          );
        }

        // Case 5: Implicit bullet
        if (isImplicitBulletBlock) {
          return (
            <div key={idx} className="flex items-start gap-2.5 pl-1">
              <span className="text-teal-600 dark:text-teal-400 font-bold shrink-0 mt-0.5 select-none">•</span>
              <p className="flex-1 select-all">{trimmed}</p>
            </div>
          );
        }

        // Case 6: Plain paragraph
        return (
          <p key={idx} className="select-all leading-relaxed">
            {trimmed}
          </p>
        );
      })}
    </div>
  );
}

export function RenderSegregatedContent({
  lines,
  masterResume,
  sectionName,
  variant = "rose",
}: {
  lines: string[];
  masterResume?: StructuredResume | null;
  sectionName?: string;
  variant?: "rose" | "emerald";
}) {
  if (!lines || lines.length === 0) return null;

  const isEmerald = variant === "emerald";
  const borderStyle = isEmerald
    ? "border-teal-200/80 dark:border-teal-900/50 hover:border-teal-300 dark:hover:border-teal-700"
    : "border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700";
  const iconStyle = isEmerald
    ? "bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400"
    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";
  const badgeStyle = isEmerald
    ? "text-teal-700 dark:text-teal-300 bg-teal-50/80 dark:bg-teal-950/50 border-teal-200/60 dark:border-teal-800/40"
    : "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-700";
  const bulletDotStyle = isEmerald ? "text-teal-500 font-bold" : "text-slate-400 font-bold";
  const dividerStyle = isEmerald ? "border-teal-100 dark:border-teal-900/40" : "border-slate-100 dark:border-slate-800/60";

  // Try retrieving structured entries directly from masterResume if available
  if (masterResume && sectionName) {
    const secNameLower = sectionName.toLowerCase();
    const matchingSec = masterResume.sections.find(
      (s) => s.section_title.toLowerCase().includes(secNameLower) || s.section_type.toLowerCase().includes(secNameLower)
    );
    if (matchingSec && matchingSec.section_type === "experience" && matchingSec.content?.entries?.length > 0) {
      return (
        <div className="space-y-3.5">
          {matchingSec.content.entries.map((entry: any, eIdx: number) => {
            const companyPart = entry.company || "";
            const locationPart = entry.location ? `, ${entry.location}` : "";
            const datePart = entry.start_date ? ` | ${entry.start_date} - ${entry.end_date || "Present"}` : "";
            const metaStr = `${companyPart}${locationPart}${datePart}`;

            return (
              <div
                key={eIdx}
                className={`p-4 bg-white dark:bg-slate-900 rounded-xl border ${borderStyle} shadow-2xs space-y-2.5 transition-all`}
              >
                <div className={`flex flex-wrap items-center justify-between gap-2 pb-2 border-b ${dividerStyle}`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-lg ${iconStyle} flex items-center justify-center font-bold text-xs shrink-0`}>
                      💼
                    </div>
                    <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                      {entry.job_title || "Experience Role"}
                    </span>
                  </div>
                  {metaStr && (
                    <span className={`text-[11px] font-bold ${badgeStyle} px-2.5 py-1 rounded-md border`}>
                      {metaStr}
                    </span>
                  )}
                </div>
                {entry.bullets && entry.bullets.length > 0 && (
                  <ul className="space-y-1.5 pt-1">
                    {entry.bullets.map((bullet: string, bIdx: number) => (
                      <li key={bIdx} className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed flex items-start gap-2 select-all">
                        <span className={`${bulletDotStyle} shrink-0 mt-0.5`}>•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      );
    }
  }

  // Fallback to intelligent line parser
  const entries = parseTextIntoStructuredEntries(lines);

  if (entries.length === 1 && entries[0].title === "Overview / Highlights") {
    return (
      <div className={`space-y-2 bg-white/90 dark:bg-slate-900/80 p-3.5 rounded-xl border ${borderStyle} text-xs text-slate-800 dark:text-slate-200 font-medium`}>
        {lines.map((l, i) => (
          <p key={i} className="leading-relaxed border-b border-slate-200/50 dark:border-slate-800/50 last:border-b-0 pb-1.5 last:pb-0 select-all">
            {l}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {entries.map((entry, eIdx) => (
        <div
          key={eIdx}
          className={`p-4 bg-white dark:bg-slate-900 rounded-xl border ${borderStyle} shadow-2xs space-y-2.5 transition-all`}
        >
          <div className={`flex flex-wrap items-center justify-between gap-2 pb-2 border-b ${dividerStyle}`}>
            <div className="flex items-center gap-2">
              <div className={`h-6 w-6 rounded-lg ${iconStyle} flex items-center justify-center font-bold text-xs shrink-0`}>
                💼
              </div>
              <span className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">
                {entry.title}
              </span>
            </div>
            {entry.companyAndDates && (
              <span className={`text-[11px] font-bold ${badgeStyle} px-2.5 py-1 rounded-md border`}>
                {entry.companyAndDates}
              </span>
            )}
          </div>
          {entry.bullets.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {entry.bullets.map((bullet, bIdx) => (
                <li key={bIdx} className="text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed flex items-start gap-2 select-all">
                  <span className={`${bulletDotStyle} shrink-0 mt-0.5`}>•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

