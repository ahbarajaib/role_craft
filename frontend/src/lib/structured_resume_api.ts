import { API_BASE_URL } from "./api";

export interface ContactInfo {
  full_name?: string | null;
  job_title?: string | null;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  portfolio_url?: string | null;
  github_url?: string | null;
}

export interface SkillCategory {
  category_name: string;
  skills: string[];
}

export interface ExperienceEntry {
  job_title?: string | null;
  company?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  bullets: string[];
}

export interface EducationEntry {
  degree?: string | null;
  institution?: string | null;
  location?: string | null;
  graduation_date?: string | null;
  gpa?: string | null;
  details: string[];
}

export interface ProjectEntry {
  name: string;
  description?: string | null;
  technologies: string[];
  bullets: string[];
  url?: string | null;
}

export interface CertificationEntry {
  name: string;
  issuer?: string | null;
  date?: string | null;
  credential_id?: string | null;
}

export interface ResumeSection {
  section_type: "summary" | "skills" | "experience" | "education" | "projects" | "certifications" | "custom";
  section_title: string;
  order: number;
  visible: boolean;
  content: Record<string, any>;
}

export interface ParseConfidence {
  low_confidence_fields: string[];
  overall_confidence: number;
}

export interface StructuredResume {
  contact_info: ContactInfo;
  summary?: string | null;
  profile_photo_url?: string | null;
  sections: ResumeSection[];
  parse_confidence?: ParseConfidence;
  source_format?: "docx" | "pdf" | "manual" | null;
  preferred_template?: "clean_classic" | "modern_professional" | "executive_profile" | null;
}

function getAuthHeaders(contentType: string | null = "application/json"): HeadersInit {
  const headers: Record<string, string> = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("rc_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

export async function parseAndSaveStructuredResume(file: File): Promise<StructuredResume> {
  const formData = new FormData();
  formData.append("file", file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000);

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/structured-resume/parse`, {
      method: "POST",
      headers: getAuthHeaders(null),
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData?.error?.detail || "Failed to parse resume file");
    }

    return await response.json();
  } catch (err: any) {
    if (err.name === "AbortError") {
      throw new Error("Parsing request timed out. Please verify your connection and try again.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchStructuredResume(): Promise<StructuredResume | null> {
  const response = await fetch(`${API_BASE_URL}/api/v1/structured-resume`, {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to fetch structured resume");
  }

  return response.json();
}

export async function updateStructuredResume(resume: StructuredResume): Promise<StructuredResume> {
  const response = await fetch(`${API_BASE_URL}/api/v1/structured-resume`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(resume),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to save structured resume changes");
  }

  return response.json();
}

export async function uploadProfilePhoto(file: File): Promise<{ status: string; photo_url: string }> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/structured-resume/photo`, {
    method: "POST",
    headers: getAuthHeaders(null),
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to upload profile photo");
  }

  return response.json();
}

export async function deleteProfilePhoto(): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/structured-resume/photo`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to delete profile photo");
  }

  return response.json();
}

export function getTemplateDownloadUrl(template: string, format: "docx" | "pdf"): string {
  const token = typeof window !== "undefined" ? localStorage.getItem("rc_token") : null;
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${API_BASE_URL}/api/v1/structured-resume/generate/${template}/${format}${query}`;
}

export async function downloadStructuredResume(template: string, format: "docx" | "pdf", customFilename?: string): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("rc_token") : null;
  const response = await fetch(`${API_BASE_URL}/api/v1/structured-resume/generate/${template}/${format}`, {
    method: "GET",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || `Failed to generate ${format.toUpperCase()} export file`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = customFilename || `Resume_${template}.${format}`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
