export interface DocumentUploadResponse {
  document_id: string;
  filename: string;
  content_type: string;
  size: number;
  uploaded_at: string;
  status: string;
}

export interface ReviewedSection {
  section_name: string;
  review_status: "improve" | "keep" | "reduce_emphasis";
  rewrite_worthwhile: boolean;
  priority: "high" | "medium" | "low";
  reason: string;
  recommendations: string[];
  evidence_used: string[];
  missing_keywords: string[];
  strengths: string[];
  coverage_percentage: number;
  recruiter_impact: string;
  ats_impact: string;
}

export interface OverallSummary {
  overall_coverage_percentage: number;
  sections_reviewed: number;
  sections_to_improve: number;
  job_title: string;
}

export interface StrengthItem {
  name: string;
  category: "technology" | "skill" | "concept" | "responsibility";
  reason: string;
}

export interface ImprovementItem {
  name: string;
  priority: number;
  section: string;
  reason: string;
  expected_interview_impact: string;
  evidence_reused: string;
  confidence: number;
}

export interface ResumeAnalysisResult {
  document_id: string;
  overall_summary: OverallSummary;
  sections: ReviewedSection[];
  top_strengths: StrengthItem[];
  top_improvements: ImprovementItem[];
}

const rawApiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const API_BASE_URL = rawApiUrl.replace(/\/api\/v1\/?$/, "");

function getHeaders(contentType: string | null = "application/json"): HeadersInit {
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

export async function uploadResume(file: File): Promise<DocumentUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE_URL}/api/v1/documents/upload`, {
    method: "POST",
    headers: getHeaders(null),
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to upload resume");
  }

  return response.json();
}




export async function analyzeResume(
  documentId: string,
  jobDescriptionText: string
): Promise<ResumeAnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resume/analyze`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      document_id: documentId,
      job_description_text: jobDescriptionText,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to analyze resume");
  }

  return response.json();
}

export interface RewriteChangeItem {
  type: "keyword" | "clarity" | "structure" | "emphasis";
  description: string;
}

export interface RewriteSectionResponse {
  section: string;
  original_text: string;
  rewritten_text: string;
  reasoning: string;
  changes: RewriteChangeItem[];
}

export interface RewriteSectionRequest {
  document_id: string;
  section_name: string;
  job_description_text: string;
  recommendations: string[];
  user_instructions?: string;
  metric_inputs?: Record<string, string>;
}

export async function rewriteSection(
  request: RewriteSectionRequest
): Promise<RewriteSectionResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resume/rewrite`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to rewrite section");
  }

  return response.json();
}

export interface ApplyRewriteItem {
  section: string;
  rewritten_text: string;
}

export interface ApplyRewriteRequest {
  document_id: string;
  accepted_rewrites: ApplyRewriteItem[];
}

export interface ApplyRewriteResponse {
  download_id: string;
  sections_updated: number;
  download_url: string;
}

export async function applyRewrites(
  request: ApplyRewriteRequest
): Promise<ApplyRewriteResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resume/apply`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to apply edits");
  }

  return response.json();
}

export interface CoverLetterRequest {
  document_id: string;
  job_description_text: string;
  candidate_name?: string;
  rewritten_sections?: Record<string, string>;
  confirmed_matched_skills?: string[];
}

export interface CoverLetterResponse {
  download_id: string;
  cover_letter_text: string;
  candidate_name: string;
  target_role: string;
}

export async function generateCoverLetter(
  request: CoverLetterRequest
): Promise<CoverLetterResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resume/cover-letter`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to generate cover letter");
  }

  return response.json();
}

export async function updateCoverLetter(
  downloadId: string,
  coverLetterText: string
): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resume/cover-letter/${downloadId}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ cover_letter_text: coverLetterText }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to update cover letter");
  }

  return response.json();
}

