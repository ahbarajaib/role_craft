export interface StructuredRoleEntry {
  title: string;
  companyAndDates?: string;
  bullets: string[];
}

export function parseTextIntoStructuredEntries(lines: string[]): StructuredRoleEntry[] {
  const result: StructuredRoleEntry[] = [];
  let currentEntry: StructuredRoleEntry | null = null;

  const bulletSymbols = ["•", "-", "*", "–", "—", "▪", "▸"];
  const actionVerbStarters = [
    "engineered", "spearheaded", "achieved", "optimized", "designed", "developed",
    "implemented", "configured", "conducted", "streamlined", "automated", "collaborated",
    "resolved", "handled", "delivered", "maintained", "consistently", "assisted", "created",
    "built", "provided", "utilized", "authors", "authored", "increased", "reduced", "led"
  ];

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    const isExplicitBullet = bulletSymbols.some((s) => trimmed.startsWith(s));
    const startsWithVerb = actionVerbStarters.some((v) => lower.startsWith(v));
    const hasDatePattern = /\b(19|20)\d{2}\b/.test(trimmed) || lower.includes("present");

    // A true Title Line must be short (< 55 chars), not end with period, not start with an action verb
    const isTitleLine =
      !isExplicitBullet &&
      !startsWithVerb &&
      trimmed.length < 55 &&
      !trimmed.endsWith(".") &&
      (
        i + 1 < lines.length && (lines[i + 1].includes("|") || lines[i + 1].includes(",") || /\b(19|20)\d{2}\b/.test(lines[i + 1]))
      );

    const isCompanyLine =
      !isExplicitBullet &&
      !startsWithVerb &&
      !isTitleLine &&
      (trimmed.includes("|") || (hasDatePattern && trimmed.length < 90 && (trimmed.includes(",") || trimmed.includes("–") || trimmed.includes("-"))));

    if (isTitleLine) {
      if (currentEntry) result.push(currentEntry);
      currentEntry = { title: trimmed, bullets: [] };
    } else if (isCompanyLine && currentEntry && !currentEntry.companyAndDates) {
      currentEntry.companyAndDates = trimmed;
    } else {
      let bulletContent = trimmed;
      const matchSymbol = bulletSymbols.find((s) => trimmed.startsWith(s));
      if (matchSymbol) {
        bulletContent = trimmed.substring(matchSymbol.length).trim();
      }
      if (!currentEntry) {
        currentEntry = { title: "Overview / Highlights", bullets: [] };
      }
      currentEntry.bullets.push(bulletContent);
    }
  }

  if (currentEntry) result.push(currentEntry);
  return result;
}

export function convertTailoredResumeToRewrites(tailoredResume: any): Record<string, string> {
  const rewrites: Record<string, string> = {};
  if (!tailoredResume || !tailoredResume.sections) return rewrites;

  for (const sec of tailoredResume.sections) {
    const titleLower = (sec.section_title || "").toLowerCase().trim();
    const typeLower = (sec.section_type || "").toLowerCase().trim();

    let textBlock = "";
    if (sec.section_type === "summary") {
      textBlock = sec.content?.text || "";
    } else if (sec.section_type === "skills") {
      const cats = sec.content?.categories || [];
      textBlock = cats.map((c: any) => `${c.category_name}: ${(c.skills || []).join(", ")}`).join("\n");
    } else if (sec.section_type === "experience") {
      const entries = sec.content?.entries || [];
      const lines: string[] = [];
      for (const e of entries) {
        if (e.job_title) lines.push(e.job_title);
        let meta = e.company || "";
        if (e.location) meta += `, ${e.location}`;
        if (e.start_date) meta += ` | ${e.start_date} - ${e.end_date || "Present"}`;
        if (meta) lines.push(meta);
        if (e.bullets && e.bullets.length > 0) {
          lines.push(...e.bullets.map((b: string) => `• ${b}`));
        }
      }
      textBlock = lines.join("\n");
    } else if (sec.section_type === "projects") {
      const entries = sec.content?.entries || [];
      const lines: string[] = [];
      for (const e of entries) {
        if (e.name) lines.push(e.name);
        if (e.technologies && e.technologies.length > 0) {
          lines.push(`Technologies: ${e.technologies.join(", ")}`);
        }
        if (e.bullets && e.bullets.length > 0) {
          lines.push(...e.bullets.map((b: string) => `• ${b}`));
        }
      }
      textBlock = lines.join("\n");
    }

    if (textBlock.trim()) {
      if (titleLower) rewrites[titleLower] = textBlock;
      if (typeLower) rewrites[typeLower] = textBlock;
    }
  }

  return rewrites;
}

export function getRewrittenTextForSection(
  sectionName: string,
  rewrites: Record<string, string>,
  sectionType?: string
): string | undefined {
  if (!rewrites || !sectionName) return undefined;
  const nameLower = (sectionName || "").toLowerCase().trim();
  const typeLower = (sectionType || "").toLowerCase().trim();

  // 1. Direct match on exact normalized section name
  if (rewrites[nameLower]) return rewrites[nameLower];
  if (typeLower && rewrites[typeLower]) return rewrites[typeLower];

  // 2. Direct match on key contained in sectionName or vice-versa
  for (const [key, val] of Object.entries(rewrites)) {
    const kLower = key.toLowerCase().trim();
    if (kLower === nameLower) return val;
    if (kLower.length > 3 && (nameLower.includes(kLower) || kLower.includes(nameLower))) {
      return val;
    }
  }

  // 3. Sub-role matching inside multi-entry experience / project text blocks
  const cleanTitleWords = nameLower.split(/[\t\-\|\,\–\—\:]/)[0].trim().split(" ").filter((w) => w.length > 2);
  for (const [, textVal] of Object.entries(rewrites)) {
    if (!textVal || typeof textVal !== "string") continue;
    const blocks = textVal.split(/\n\n+/);
    for (const block of blocks) {
      const blockLower = block.toLowerCase();
      const matchesTitle = cleanTitleWords.length > 0 && cleanTitleWords.every((word) => blockLower.includes(word));
      if (matchesTitle) {
        return block.trim();
      }
    }
  }

  // 4. Overall section type fallback
  if (typeLower === "experience" || nameLower.includes("experience") || nameLower.includes("work")) {
    const expKey = Object.keys(rewrites).find((k) => k.includes("experience") || k.includes("work") || k === "experience");
    if (expKey && rewrites[expKey]) return rewrites[expKey];
  }
  if (typeLower === "skills" || nameLower.includes("skill")) {
    const skillKey = Object.keys(rewrites).find((k) => k.includes("skill"));
    if (skillKey && rewrites[skillKey]) return rewrites[skillKey];
  }
  if (typeLower === "summary" || nameLower.includes("summary")) {
    const sumKey = Object.keys(rewrites).find((k) => k.includes("summary"));
    if (sumKey && rewrites[sumKey]) return rewrites[sumKey];
  }

  return undefined;
}

export function cleanCoverLetterText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\bto\s+jo\s*n\b/gi, "to join")
    .replace(/\bdel\s*ver\b/gi, "deliver")
    .replace(/\brel\s*iabl\s*e\b/gi, "reliable")
    .replace(/\butil\s*iz\s*ing\b/gi, "utilizing")
    .replace(/\bfacil\s*itated\b/gi, "facilitated")
    .replace(/\benabl\s*ing\b/gi, "enabling")
    .replace(/\bequi\s*p\s+me\b/gi, "equip me")
    .replace(/\bworkfl\s*ows\b/gi, "workflows")
    .replace(/\bspecifcat\s*ons\b/gi, "specifications")
    .replace(/\bexcel\s*ence\b/gi, "excellence")
    .replace(/\bw\s+th\b/gi, "with")
    .replace(/Node\s*\.\s*j\s*s/gi, "Node.js")
    .replace(/React\s*\.\s*j\s*s/gi, "React.js")
    .replace(/\baFull\s+Stack/gi, "a Full Stack")
    .replace(/Full\s+Stack\s+Devel\s*oper/gi, "Full Stack Developer");
}

export function parseBulletsFromText(text: string): { line: string; isBullet: boolean; isHeader?: boolean; isCompany?: boolean }[] {
  if (!text) return [];
  const bulletSymbols = ["•", "-", "*", "–", "—", "▪", "▸"];

  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      const trimmed = line.trim();
      const lowerLine = trimmed.toLowerCase();
      const isExplicitBullet = bulletSymbols.some((s) => trimmed.startsWith(s));

      const isDateHeader = /\b(19|20)\d{2}\b/.test(trimmed) || lowerLine.includes("present");
      const isJobRoleHeader =
        !isExplicitBullet &&
        trimmed.length < 90 &&
        !trimmed.endsWith(".") &&
        (isDateHeader || ["developer", "engineer", "architect", "manager", "lead", "designer", "consultant", "analyst", "executive", "specialist", "director"].some(r => lowerLine.includes(r)));

      const isCompanyHeader =
        !isExplicitBullet &&
        trimmed.length < 80 &&
        (trimmed.includes(",") || trimmed.includes("|") || trimmed.endsWith(".")) &&
        ["inc", "ltd", "llc", "fze", "pvt", "corp", "dubai", "uae", "usa", "uk", "india", "bangalore", "remote", "freelance"].some(loc => lowerLine.includes(loc));

      if (isJobRoleHeader) {
        return { line: trimmed, isBullet: false, isHeader: true };
      }
      if (isCompanyHeader) {
        return { line: trimmed, isBullet: false, isCompany: true };
      }

      const isBullet = isExplicitBullet || trimmed.length > 40;
      return { line: trimmed, isBullet };
    });
}

export function filterBulletsByChecked(text: string, excludedIndexes: Set<number>): string {
  if (!text || excludedIndexes.size === 0) return text;
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  return lines.filter((_, i) => !excludedIndexes.has(i)).join("\n");
}

export const GRAMMATICAL_STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "will", "have",
  "your", "our", "you", "are", "not", "but", "can", "all", "also",
  "any", "who", "how", "what", "when", "where", "than", "been", "more",
  "they", "their", "them", "into", "its", "over", "such", "each",
  "well", "both", "about", "work", "role", "using", "able", "must",
  "should", "would", "could", "other", "some", "within", "across",
  "which", "through", "great", "excellent", "help", "high", "plus",
  "needs", "need", "deliver", "delivering", "collaborate", "collaborating",
  "driven", "drive", "drives", "very", "much", "many", "good", "best",
  "better", "daily", "overall", "overall fit", "missing", "clarify",
  "approach", "value", "values", "overview", "practices", "responsibilities",
  "requirements", "opportunity", "opportunities", "environment", "environments",
  "assistant", "corporate", "employment", "fast", "follow-up", "followup",
  "hiring", "information", "interested", "like", "platforms", "platform",
  "reimbursement", "time", "wing", "urgency", "willing", "process", "processes",
  "missing technologies", "clarify integration projects", "extensive",
  "proven expertise", "building full-stack solutions", "deal progression",
  "and deal progression", "strong full-stack development", "results-oriented",
  "hands-on", "end-to-end", "proficient", "proficient in", "experience",
  "experiences", "skills", "knowledge", "understanding", "ability",
]);

export function formatDomainSkill(str: string): string {
  if (!str) return "";
  if (str.length <= 5 && str === str.toUpperCase() && !str.includes(" ")) {
    return str;
  }
  return str
    .split(/\s+/)
    .map((w) => {
      if (w.length <= 4 && w === w.toUpperCase() && /^[A-Z0-9&]+$/.test(w)) {
        return w;
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

export function cleanKeywordName(rawName: string): string {
  if (!rawName) return "";
  let clean = rawName
    .replace(/^[\s•\-–—*·▪▸►✓✔→\d.)\]]+/g, "")
    .replace(/^(add|include|highlight|emphasize|condense|surface|rephrase|incorporate|integrate|leverage|utilize|apply|demonstrate|showcase|built|clarify|missing|ensure)\s+/i, "")
    .replace(/^(experience (with|in)|proficien(t|cy) (in|with)|hands-on with|strong background in|knowledge of|familiarity with|understanding of|ability to|proven track record in|deep understanding of|practical experience in|specializing in|focus on|expertise in)\s+/i, "")
    .replace(/\s+(usage|skills|experience|experiences|knowledge|stack|level|concepts|proficiency|background)$/i, "")
    .replace(/^(\d+\+?\s+years?(\s+of)?)\s+/i, "")
    .replace(/^and\s+/i, "")
    .trim();

  clean = clean.replace(/[.,;:—\-]+$/, "").trim();
  return formatDomainSkill(clean);
}

export function isActualATSKeyword(kw: string): boolean {
  if (!kw) return false;
  const clean = kw.trim();
  if (clean.length < 2 || clean.length > 45) return false;

  if (/[—;?]|when\s|where\s|which\s|with the\s|and when|in order to|ability to|because\s|although\s|missing technologies|clarify/i.test(clean)) {
    return false;
  }

  const lower = clean.toLowerCase();
  if (GRAMMATICAL_STOPWORDS.has(lower)) return false;

  const words = clean.split(/\s+/);
  if (words.length > 4) return false;

  if (words.length === 1 && (lower.length < 2 || ["with", "from", "that", "this", "have", "time", "like", "fast", "lead", "wing"].includes(lower))) {
    return false;
  }

  if (["and", "with", "or", "to", "for", "in", "of", "the", "by"].includes(words[0].toLowerCase())) {
    return false;
  }

  return true;
}

export function extractJobTitleFromJD(jdText: string): string {
  if (!jdText) return "";
  const lines = jdText.split("\n").map((l) => l.trim()).filter(Boolean);

  const genericHeaders = new Set([
    "full job description", "job description", "about the role", "overview",
    "job summary", "description", "about us", "position overview", "role summary",
    "job title", "details", "role details", "careers", "position description", "about the position",
    "about the job", "company", "location", "job type", "experience", "key responsibilities"
  ]);

  for (let i = 0; i < Math.min(lines.length, 25); i++) {
    const line = lines[i];

    if (/^(?:job\s*title|title|role|position)\s*[:–-]?$/i.test(line) && lines[i + 1]) {
      const nextVal = lines[i + 1].trim();
      if (
        nextVal &&
        !genericHeaders.has(nextVal.toLowerCase()) &&
        !/^(about|description|requirements|responsibilities|summary|company|location|overview|job type)/i.test(nextVal)
      ) {
        return nextVal;
      }
    }

    const match = line.match(/^(?:job\s*title|title|role|position)\s*[:–-]\s*(.+)$/i);
    if (match && match[1]) {
      const val = match[1].trim();
      if (
        val &&
        !genericHeaders.has(val.toLowerCase()) &&
        !/^(about|description|requirements|responsibilities|summary|company|location|overview|job type)/i.test(val)
      ) {
        return val;
      }
    }
  }

  const roleKeywords = [
    "developer", "engineer", "architect", "manager", "lead", "designer",
    "consultant", "analyst", "specialist", "administrator", "executive",
    "fullstack", "full stack", "backend", "frontend", "devops", "sre", "scientist",
    "director", "head", "vp", "associate", "intern", "product"
  ];

  for (const line of lines.slice(0, 15)) {
    const clean = line.replace(/^#+\s*/, "").trim();
    const lower = clean.toLowerCase();
    if (
      clean.length >= 4 &&
      clean.length <= 80 &&
      !clean.includes("http") &&
      !clean.includes("@") &&
      !genericHeaders.has(lower) &&
      !/^(about|description|requirements|responsibilities|summary|company|location|overview|job type)/i.test(clean) &&
      roleKeywords.some((r) => lower.includes(r))
    ) {
      return clean;
    }
  }

  for (const line of lines.slice(0, 5)) {
    const clean = line.replace(/^#+\s*/, "").trim();
    const lower = clean.toLowerCase();
    if (
      clean.length >= 4 &&
      clean.length <= 60 &&
      !clean.includes("http") &&
      !clean.includes("@") &&
      !genericHeaders.has(lower) &&
      !/^(about|description|requirements|responsibilities|summary|company|location|overview|job type)/i.test(clean)
    ) {
      return clean;
    }
  }

  return "";
}

export function getSkillCategory(skillName: string): { label: string; badgeColor: string } {
  const s = skillName.toLowerCase();

  if (/lead|manage|direct|coordinat|supervis|stakeholder|communicat|collaborat|team|agile|scrum|strategy|negotiat|client|talent|recruit|train|hiring|cross-functional/i.test(s)) {
    return { label: "Leadership & Strategy", badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  if (/complian|gaap|hipaa|sox|iso|audit|standard|regul|govern|quality|qa|qc|protocol|safety|customs|tax|law|legal|policy/i.test(s)) {
    return { label: "Compliance & Standards", badgeColor: "bg-amber-50 text-amber-700 border-amber-200" };
  }

  if (/financ|budget|analyt|data|metric|report|forecast|model|p&l|revenue|cost|ledger|reconcil|math|statist|econom|pricing|kpi/i.test(s)) {
    return { label: "Analytics & Finance", badgeColor: "bg-purple-50 text-purple-700 border-purple-200" };
  }

  if (/system|software|tool|platform|portal|app|erp|crm|sap|oracle|cloud|db|database|server|net|api|hubspot|salesforce|jira|figma|git|linux/i.test(s) || (skillName.length <= 5 && skillName === skillName.toUpperCase())) {
    return { label: "Systems & Tools", badgeColor: "bg-teal-50 text-teal-700 border-teal-200" };
  }

  return { label: "Domain Competency", badgeColor: "bg-teal-50 text-teal-700 border-teal-200" };
}

export function extractStrictKeywordsFromRaw(raw: string): string[] {
  if (!raw) return [];
  const cleaned = cleanKeywordName(raw);
  const parts = cleaned.split(/\s+(?:and|&)\s+|,\s*/i);
  return parts
    .map((p) => cleanKeywordName(p))
    .filter((p) => isActualATSKeyword(p));
}

export function cleanSectionTitle(title: string): string {
  if (!title) return "";
  const parts = title.trim().split(/\s+/);
  const deduplicated: string[] = [];
  for (const p of parts) {
    if (deduplicated.length === 0 || deduplicated[deduplicated.length - 1].toLowerCase() !== p.toLowerCase()) {
      deduplicated.push(p);
    }
  }
  return deduplicated.join(" ");
}

export function removeSkillFromText(text: string, skill: string): string {
  if (!text || !skill) return text;
  const target = skill.trim();
  if (!target) return text;

  const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`,\\s*${escaped}\\b`, 'gi'),
    new RegExp(`\\b${escaped}\\s*,`, 'gi'),
    new RegExp(`\\b${escaped}\\b`, 'gi'),
    new RegExp(escaped, 'gi'),
  ];

  let current = text;
  for (const pat of patterns) {
    if (pat.test(current)) {
      current = current.replace(pat, '');
      break;
    }
  }

  return current
    .replace(/:\s*,/g, ': ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*$/gm, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function buildResumeFilename(
  jobDescription: string,
  userName: string | null | undefined,
  jobTitle: string | undefined,
  fallbackFileName?: string
): string {
  let candidateName = userName?.trim() || null;

  if (!candidateName && fallbackFileName) {
    const cleanName = fallbackFileName.replace(/\.(docx|pdf)$/i, "").replace(/[^a-zA-Z0-9& ]/g, " ").trim();
    if (cleanName.length > 2 && !/^(resume|my_resume|cv|document|base)$/i.test(cleanName)) {
      candidateName = cleanName;
    }
  }

  if (!candidateName) {
    candidateName = "Resume";
  }

  let designation: string | null = jobTitle?.trim() || null;
  if (designation && /^(target role|full job description|job description|overview|target)$/i.test(designation)) {
    designation = null;
  }

  if (!designation && jobDescription) {
    const titleMatch = jobDescription.match(/(?:^|\n)\s*(?:Job Designation|Role|Job Title|Position)\s*[:\-]\s*([^\n,]+)/i);
    if (titleMatch && titleMatch[1]) {
      const parsedTitle = titleMatch[1].trim().replace(/[^a-zA-Z0-9& ]/g, "").trim();
      if (parsedTitle.length > 2 && !/^(target role|full job description|job description)$/i.test(parsedTitle)) {
        designation = parsedTitle;
      }
    }
  }

  const parts = [candidateName, designation].filter(Boolean);
  const baseName = parts.join(" - ").replace(/[/\\?%*:|"<>]/g, "");
  return `${baseName}.docx`;
}

export function cleanSectionModalTitle(title: string): string {
  if (!title) return "";
  const clean = title
    .replace(/(?:\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b|\b201\d|\b202\d|\bpresent\b).*/i, "")
    .replace(/[,|\-–•].*$/, "")
    .trim();
  return clean || title;
}

