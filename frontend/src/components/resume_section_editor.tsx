"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  AlertTriangle,
  GripVertical,
  Briefcase,
  GraduationCap,
  Award,
  FolderGit2,
  Code,
  FileText,
  Layers,
  Zap,
  Lock,
} from "lucide-react";
import { ResumeSection } from "@/lib/structured_resume_api";

interface ResumeSectionEditorProps {
  section: ResumeSection;
  index: number;
  lowConfidenceFields: string[];
  onChange: (updatedSection: ResumeSection) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export default function ResumeSectionEditor({
  section,
  index,
  lowConfidenceFields,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: ResumeSectionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const isLowConf = (fieldPath: string) => {
    return lowConfidenceFields.some(
      (path) => path.startsWith(fieldPath) || path === fieldPath
    );
  };

  const getSectionIcon = (type: string) => {
    switch (type) {
      case "summary":
        return <FileText className="h-4 w-4 text-indigo-500" />;
      case "skills":
        return <Code className="h-4 w-4 text-emerald-500" />;
      case "experience":
        return <Briefcase className="h-4 w-4 text-blue-500" />;
      case "education":
        return <GraduationCap className="h-4 w-4 text-purple-500" />;
      case "projects":
        return <FolderGit2 className="h-4 w-4 text-amber-500" />;
      case "certifications":
        return <Award className="h-4 w-4 text-rose-500" />;
      default:
        return <Layers className="h-4 w-4 text-slate-500" />;
    }
  };

  const updateContent = (newContent: Record<string, any>) => {
    onChange({
      ...section,
      content: newContent,
    });
  };

  return (
    <div
      className={`rounded-2xl border transition-all shadow-sm ${
        section.visible
          ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
          : "bg-slate-50/60 dark:bg-slate-900/40 border-slate-200/60 dark:border-slate-800/60 opacity-75"
      }`}
    >
      {/* Card Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50 rounded-t-2xl">
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="flex items-center gap-1 text-slate-400">
            {onMoveUp && (
              <button
                type="button"
                onClick={onMoveUp}
                className="p-1 hover:text-slate-700 dark:hover:text-white transition-all cursor-pointer"
                title="Move section up"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
            {onMoveDown && (
              <button
                type="button"
                onClick={onMoveDown}
                className="p-1 hover:text-slate-700 dark:hover:text-white transition-all cursor-pointer"
                title="Move section down"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-800">
            {getSectionIcon(section.section_type)}
          </div>

          <input
            type="text"
            value={section.section_title}
            onChange={(e) => onChange({ ...section, section_title: e.target.value })}
            className="font-bold text-sm text-slate-900 dark:text-white bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none px-1 py-0.5 transition-all flex-1 min-w-0"
            placeholder="Section Title"
          />

          {isLowConf(`sections.${index}`) && (
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-950/50 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
              <AlertTriangle className="h-3 w-3 shrink-0" /> Review Required
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          <button
            type="button"
            onClick={() => onChange({ ...section, visible: !section.visible })}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border select-none ${
              section.visible
                ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/20"
                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-slate-300 dark:border-slate-700"
            }`}
            title={section.visible ? "AI Tailoring ENABLED for this section. Click to Lock/Disable." : "AI Tailoring DISABLED for this section. Click to Enable."}
          >
            {section.visible ? (
              <>
                <Zap className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />
                <span>AI Tailor ON</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>AI Tailor OFF</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
            title="Delete section"
          >
            <Trash2 className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Card Content Body */}
      {isExpanded && (
        <div className="p-4 space-y-4 text-xs">
          {/* 1. Summary Section */}
          {section.section_type === "summary" && (
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Professional Summary Text
              </label>
              <textarea
                value={section.content?.text || section.content?.summary || ""}
                onChange={(e) => updateContent({ ...section.content, text: e.target.value })}
                rows={4}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all leading-relaxed"
                placeholder="Write your professional summary..."
              />
            </div>
          )}

          {/* 2. Skills Section */}
          {section.section_type === "skills" && (
            <SkillsEditor
              categories={section.content?.categories || []}
              onChange={(newCategories) => updateContent({ ...section.content, categories: newCategories })}
            />
          )}

          {/* 3. Experience Section */}
          {section.section_type === "experience" && (
            <ExperienceEditor
              entries={section.content?.entries || []}
              sectionIndex={index}
              lowConfidenceFields={lowConfidenceFields}
              onChange={(newEntries) => updateContent({ ...section.content, entries: newEntries })}
            />
          )}

          {/* 4. Education Section */}
          {section.section_type === "education" && (
            <EducationEditor
              entries={section.content?.entries || []}
              sectionIndex={index}
              lowConfidenceFields={lowConfidenceFields}
              onChange={(newEntries) => updateContent({ ...section.content, entries: newEntries })}
            />
          )}

          {/* 5. Projects Section */}
          {section.section_type === "projects" && (
            <ProjectsEditor
              entries={section.content?.entries || []}
              sectionIndex={index}
              lowConfidenceFields={lowConfidenceFields}
              onChange={(newEntries) => updateContent({ ...section.content, entries: newEntries })}
            />
          )}

          {/* 6. Certifications Section */}
          {section.section_type === "certifications" && (
            <CertificationsEditor
              entries={section.content?.entries || []}
              sectionIndex={index}
              lowConfidenceFields={lowConfidenceFields}
              onChange={(newEntries) => updateContent({ ...section.content, entries: newEntries })}
            />
          )}

          {/* 7. Custom or Fallback List Section */}
          {section.section_type === "custom" && (
            <CustomListEditor
              entries={section.content?.entries || []}
              sectionIndex={index}
              onChange={(newEntries) => updateContent({ ...section.content, entries: newEntries })}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Skills Editor ─────────────────────────────────────────────────────────────
function SkillsEditor({
  categories,
  onChange,
}: {
  categories: any[];
  onChange: (cats: any[]) => void;
}) {
  const addCategory = () => {
    onChange([...categories, { category_name: "New Skill Category", skills: ["Skill 1"] }]);
  };

  const updateCategory = (idx: number, cat: any) => {
    const updated = [...categories];
    updated[idx] = cat;
    onChange(updated);
  };

  const removeCategory = (idx: number) => {
    onChange(categories.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {categories.map((cat, idx) => (
        <div
          key={idx}
          className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              value={cat.category_name || ""}
              onChange={(e) => updateCategory(idx, { ...cat, category_name: e.target.value })}
              className="font-bold text-xs text-slate-800 dark:text-slate-200 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:outline-none px-1"
              placeholder="Category Name (e.g. Languages)"
            />
            <button
              type="button"
              onClick={() => removeCategory(idx)}
              className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(cat.skills || []).map((skill: string, sIdx: number) => (
              <span
                key={sIdx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-800 dark:text-slate-200 shadow-sm"
              >
                <input
                  type="text"
                  value={skill}
                  onChange={(e) => {
                    const newSkills = [...cat.skills];
                    newSkills[sIdx] = e.target.value;
                    updateCategory(idx, { ...cat, skills: newSkills });
                  }}
                  className="bg-transparent focus:outline-none w-24"
                />
                <button
                  type="button"
                  onClick={() => {
                    const newSkills = cat.skills.filter((_: any, i: number) => i !== sIdx);
                    updateCategory(idx, { ...cat, skills: newSkills });
                  }}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer"
                >
                  ×
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() => updateCategory(idx, { ...cat, skills: [...(cat.skills || []), "New Skill"] })}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 text-xs font-semibold hover:bg-indigo-100 transition-all cursor-pointer"
            >
              <Plus className="h-3 w-3" /> Add Skill
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addCategory}
        className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Add Skill Category
      </button>
    </div>
  );
}

// ── Experience Editor ─────────────────────────────────────────────────────────
function ExperienceEditor({
  entries,
  sectionIndex,
  lowConfidenceFields,
  onChange,
}: {
  entries: any[];
  sectionIndex: number;
  lowConfidenceFields: string[];
  onChange: (entries: any[]) => void;
}) {
  const addEntry = () => {
    onChange([
      ...entries,
      {
        job_title: "Senior Role",
        company: "Company Name",
        location: "City, Country",
        start_date: "Jan 2023",
        end_date: "Present",
        bullets: ["Achieved major milestone improving efficiency by 30%."],
      },
    ]);
  };

  const updateEntry = (idx: number, entry: any) => {
    const updated = [...entries];
    updated[idx] = entry;
    onChange(updated);
  };

  const removeEntry = (idx: number) => {
    onChange(entries.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-4">
      {entries.map((item, idx) => {
        const e = typeof item === "string" ? { job_title: item, company: "", location: "", start_date: "", end_date: "", bullets: [] } : item;
        const titlePath = `sections.${sectionIndex}.content.entries.${idx}.job_title`;
        const companyPath = `sections.${sectionIndex}.content.entries.${idx}.company`;
        const isTitleLow = lowConfidenceFields.includes(titlePath);
        const isCompanyLow = lowConfidenceFields.includes(companyPath);

        return (
          <div
            key={idx}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                Experience #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => removeEntry(idx)}
                className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  Job Title
                  {isTitleLow && (
                    <span className="text-rose-500 font-bold text-[10px] flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" /> Verify Title
                    </span>
                  )}
                </label>
                <input
                  id={`field-sections-${sectionIndex}-content-entries-${idx}-job_title`}
                  data-field={titlePath}
                  type="text"
                  value={e.job_title || ""}
                  onChange={(evt) => updateEntry(idx, { ...e, job_title: evt.target.value })}
                  className={`w-full p-2 rounded-lg border text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ${
                    isTitleLow
                      ? "border-rose-400 dark:border-rose-500 bg-rose-50/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                  placeholder="e.g. Senior Full Stack Developer"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  Company
                  {isCompanyLow && (
                    <span className="text-rose-500 font-bold text-[10px] flex items-center gap-0.5">
                      <AlertTriangle className="h-3 w-3" /> Verify Company
                    </span>
                  )}
                </label>
                <input
                  id={`field-sections-${sectionIndex}-content-entries-${idx}-company`}
                  data-field={companyPath}
                  type="text"
                  value={e.company || ""}
                  onChange={(evt) => updateEntry(idx, { ...e, company: evt.target.value })}
                  className={`w-full p-2 rounded-lg border text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none ${
                    isCompanyLow
                      ? "border-rose-400 dark:border-rose-500 bg-rose-50/20"
                      : "border-slate-200 dark:border-slate-700"
                  }`}
                  placeholder="e.g. Tech Corp Inc"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  Location
                </label>
                <input
                  type="text"
                  value={e.location || ""}
                  onChange={(evt) => updateEntry(idx, { ...e, location: evt.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                  placeholder="e.g. San Francisco, CA"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Start Date
                  </label>
                  <input
                    type="text"
                    value={e.start_date || ""}
                    onChange={(evt) => updateEntry(idx, { ...e, start_date: evt.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                    placeholder="e.g. Jan 2021"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    End Date
                  </label>
                  <input
                    type="text"
                    value={e.end_date || ""}
                    onChange={(evt) => updateEntry(idx, { ...e, end_date: evt.target.value })}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                    placeholder="e.g. Present"
                  />
                </div>
              </div>
            </div>

            {/* Bullet Points */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Key Achievements / Bullets</label>
              {(e.bullets || []).map((bullet: string, bIdx: number) => (
                <div key={bIdx} className="flex items-start gap-2">
                  <textarea
                    value={bullet}
                    onChange={(evt) => {
                      const newBullets = [...(e.bullets || [])];
                      newBullets[bIdx] = evt.target.value;
                      updateEntry(idx, { ...e, bullets: newBullets });
                    }}
                    rows={2}
                    className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newBullets = (e.bullets || []).filter((_: any, i: number) => i !== bIdx);
                      updateEntry(idx, { ...e, bullets: newBullets });
                    }}
                    className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer pt-1"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateEntry(idx, { ...e, bullets: [...(e.bullets || []), "New achievement bullet point."] })}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer pt-1"
              >
                <Plus className="h-3 w-3" /> Add Bullet Point
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addEntry}
        className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Add Experience Entry
      </button>
    </div>
  );
}

// ── Education Editor ──────────────────────────────────────────────────────────
function EducationEditor({
  entries,
  sectionIndex,
  lowConfidenceFields,
  onChange,
}: {
  entries: any[];
  sectionIndex?: number;
  lowConfidenceFields?: string[];
  onChange: (e: any[]) => void;
}) {
  const addEntry = () => {
    onChange([
      ...entries,
      { degree: "Bachelor of Technology", institution: "University Name", location: "City", graduation_date: "2022" },
    ]);
  };

  const updateEntry = (idx: number, entry: any) => {
    const updated = [...entries];
    updated[idx] = entry;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {entries.map((item, idx) => {
        const e = typeof item === "string" ? { degree: item, institution: "", location: "", graduation_date: "" } : item;
        const degreePath = `education.${idx}.degree`;
        const instPath = `education.${idx}.institution`;
        const locPath = `education.${idx}.location`;
        const gradPath = `education.${idx}.graduation_date`;

        const isLocLow = lowConfidenceFields?.some((p) => p.includes(`education.${idx}.location`) || p.includes(`entries.${idx}.location`));
        const isGradLow = lowConfidenceFields?.some((p) => p.includes(`education.${idx}.graduation_date`) || p.includes(`entries.${idx}.graduation_date`));

        return (
          <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-purple-600 dark:text-purple-400">Education #{idx + 1}</span>
              <button type="button" onClick={() => onChange(entries.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Degree / Qualification</label>
                <input
                  id={`field-education-${idx}-degree`}
                  data-field={degreePath}
                  type="text"
                  value={e.degree || ""}
                  onChange={(evt) => updateEntry(idx, { ...e, degree: evt.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  placeholder="Degree / Qualification"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 block mb-1">Institution / University</label>
                <input
                  id={`field-education-${idx}-institution`}
                  data-field={instPath}
                  type="text"
                  value={e.institution || ""}
                  onChange={(evt) => updateEntry(idx, { ...e, institution: evt.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  placeholder="Institution / University"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 flex items-center justify-between mb-1">
                  Location
                  {isLocLow && <span className="text-rose-500 font-bold text-[9px]">⚠️ Verify</span>}
                </label>
                <input
                  id={`field-education-${idx}-location`}
                  data-field={locPath}
                  type="text"
                  value={e.location || ""}
                  onChange={(evt) => updateEntry(idx, { ...e, location: evt.target.value })}
                  className={`w-full p-2 rounded-lg border text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${
                    isLocLow ? "border-rose-400 dark:border-rose-500 bg-rose-50/20" : "border-slate-200 dark:border-slate-700"
                  }`}
                  placeholder="Location"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 flex items-center justify-between mb-1">
                  Graduation Year / Date
                  {isGradLow && <span className="text-rose-500 font-bold text-[9px]">⚠️ Verify</span>}
                </label>
                <input
                  id={`field-education-${idx}-graduation_date`}
                  data-field={gradPath}
                  type="text"
                  value={e.graduation_date || ""}
                  onChange={(evt) => updateEntry(idx, { ...e, graduation_date: evt.target.value })}
                  className={`w-full p-2 rounded-lg border text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white ${
                    isGradLow ? "border-rose-400 dark:border-rose-500 bg-rose-50/20" : "border-slate-200 dark:border-slate-700"
                  }`}
                  placeholder="Graduation Year / Date"
                />
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={addEntry} className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1">
        <Plus className="h-3.5 w-3.5" /> Add Education
      </button>
    </div>
  );
}

// ── Projects Editor ───────────────────────────────────────────────────────────
function ProjectsEditor({
  entries,
  sectionIndex,
  lowConfidenceFields,
  onChange,
}: {
  entries: any[];
  sectionIndex?: number;
  lowConfidenceFields?: string[];
  onChange: (e: any[]) => void;
}) {
  const addEntry = () => {
    onChange([
      ...entries,
      { name: "New Project", description: "", url: "", technologies: ["React", "Node.js"], bullets: ["Built scalable project feature."] },
    ]);
  };

  const updateEntry = (idx: number, entry: any) => {
    const updated = [...entries];
    updated[idx] = entry;
    onChange(updated);
  };

  return (
    <div className="space-y-4">
      {entries.map((item, idx) => {
        const e = typeof item === "string" ? { name: item, description: "", url: "", technologies: [], bullets: [] } : item;
        const namePath = `projects.${idx}.name`;
        const urlPath = `projects.${idx}.url`;

        return (
          <div
            key={idx}
            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                Project #{idx + 1}
              </span>
              <button
                type="button"
                onClick={() => onChange(entries.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Project Name</label>
                <input
                  id={`field-projects-${idx}-name`}
                  data-field={namePath}
                  type="text"
                  value={e.name || ""}
                  onChange={(evt) => updateEntry(idx, { ...e, name: evt.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                  placeholder="e.g. AI CRM Assistant"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Project URL / Link</label>
                <input
                  id={`field-projects-${idx}-url`}
                  data-field={urlPath}
                  type="text"
                  value={e.url || ""}
                  onChange={(evt) => updateEntry(idx, { ...e, url: evt.target.value })}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                  placeholder="e.g. ginnirich.com or github.com/..."
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Technologies Used</label>
              <input
                type="text"
                value={Array.isArray(e.technologies) ? e.technologies.join(", ") : (e.technologies || "")}
                onChange={(evt) => updateEntry(idx, { ...e, technologies: evt.target.value.split(",").map((s: string) => s.trim()) })}
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                placeholder="Technologies (comma separated e.g. Next.js, TypeScript, PostgreSQL)"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Brief Overview / Description</label>
              <textarea
                value={e.description || ""}
                onChange={(evt) => updateEntry(idx, { ...e, description: evt.target.value })}
                rows={2}
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                placeholder="Brief project description..."
              />
            </div>

            {/* Bullet Points */}
            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Project Highlights / Bullets</label>
              {(e.bullets || []).map((bullet: string, bIdx: number) => (
                <div key={bIdx} className="flex items-start gap-2">
                  <textarea
                    value={bullet}
                    onChange={(evt) => {
                      const newBullets = [...(e.bullets || [])];
                      newBullets[bIdx] = evt.target.value;
                      updateEntry(idx, { ...e, bullets: newBullets });
                    }}
                    rows={2}
                    className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const newBullets = (e.bullets || []).filter((_: any, i: number) => i !== bIdx);
                      updateEntry(idx, { ...e, bullets: newBullets });
                    }}
                    className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer pt-1"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateEntry(idx, { ...e, bullets: [...(e.bullets || []), "New project highlight bullet."] })}
                className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer pt-1"
              >
                <Plus className="h-3 w-3" /> Add Project Bullet Point
              </button>
            </div>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addEntry}
        className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1"
      >
        <Plus className="h-3.5 w-3.5" /> Add Project
      </button>
    </div>
  );
}

// ── Certifications Editor ─────────────────────────────────────────────────────
function CertificationsEditor({
  entries,
  sectionIndex,
  lowConfidenceFields,
  onChange,
}: {
  entries: any[];
  sectionIndex?: number;
  lowConfidenceFields?: string[];
  onChange: (e: any[]) => void;
}) {
  const addEntry = () => {
    onChange([
      ...entries,
      { name: "Certification Name", issuer: "Issuing Organization", date: "2023", credential_id: "" },
    ]);
  };

  const updateEntry = (idx: number, entry: any) => {
    const updated = [...entries];
    updated[idx] = entry;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {entries.map((item, idx) => {
        const e = typeof item === "string" ? { name: item, issuer: "", date: "", credential_id: "" } : item;
        const namePath = `certifications.${idx}.name`;

        return (
          <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-rose-600 dark:text-rose-400">Certification #{idx + 1}</span>
              <button type="button" onClick={() => onChange(entries.filter((_, i) => i !== idx))} className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                id={`field-certifications-${idx}-name`}
                data-field={namePath}
                type="text"
                value={e.name || ""}
                onChange={(evt) => updateEntry(idx, { ...e, name: evt.target.value })}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                placeholder="Certification / License Name"
              />
              <input
                type="text"
                value={e.issuer || ""}
                onChange={(evt) => updateEntry(idx, { ...e, issuer: evt.target.value })}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                placeholder="Issuing Organization"
              />
              <input
                type="text"
                value={e.date || ""}
                onChange={(evt) => updateEntry(idx, { ...e, date: evt.target.value })}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                placeholder="Issue Date / Year"
              />
              <input
                type="text"
                value={e.credential_id || ""}
                onChange={(evt) => updateEntry(idx, { ...e, credential_id: evt.target.value })}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                placeholder="Credential ID / URL"
              />
            </div>
          </div>
        );
      })}
      <button type="button" onClick={addEntry} className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-semibold rounded-xl flex items-center justify-center gap-1 cursor-pointer">
        <Plus className="h-3.5 w-3.5" /> Add Certification
      </button>
    </div>
  );
}

// ── Custom List Editor ────────────────────────────────────────────────────────
function CustomListEditor({
  entries,
  sectionIndex,
  onChange,
}: {
  entries: any[];
  sectionIndex?: number;
  onChange: (e: any[]) => void;
}) {
  return (
    <div className="space-y-2.5">
      {entries.map((entry, idx) => (
        <div key={idx} className="flex items-start gap-2 group">
          <span className="text-slate-400 dark:text-slate-500 font-bold text-xs pt-2 select-none">•</span>
          <textarea
            value={typeof entry === "string" ? entry : entry.text || ""}
            onChange={(e) => {
              const updated = [...entries];
              updated[idx] = e.target.value;
              onChange(updated);
            }}
            rows={2}
            placeholder="Enter custom section detail, bullet point, or item..."
            className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:border-indigo-500 focus:outline-none shadow-sm transition-all"
          />
          <button
            type="button"
            onClick={() => onChange(entries.filter((_, i) => i !== idx))}
            className="text-slate-400 hover:text-rose-500 p-1.5 cursor-pointer pt-2 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...entries, "New item entry."])}
        className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
      >
        <Plus className="h-3.5 w-3.5 text-indigo-500" /> Add Custom Entry Item
      </button>
    </div>
  );
}
