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

export interface FetchUrlResponse {
  success: boolean;
  url: string;
  domain: string;
  job_title?: string;
  company_name?: string;
  job_description?: string;
  char_count?: number;
  error_message?: string;
}

export async function fetchJobUrl(url: string): Promise<FetchUrlResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/job-descriptions/fetch-url`, {
    method: "POST",
    headers: getHeaders("application/json"),
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || errorData?.detail || "Failed to fetch job URL");
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
