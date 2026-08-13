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
  // Accept both DOCX and PDF
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
  jobDescriptionText: string,
  documentId?: string,
): Promise<ResumeAnalysisResult> {
  const body: Record<string, unknown> = { job_description_text: jobDescriptionText };
  if (documentId) body.document_id = documentId;

  const response = await fetch(`${API_BASE_URL}/api/v1/resume/analyze`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
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
  document_id?: string;          // Legacy DOCX mode: UUID of uploaded file
  section_name: string;
  section_type?: string;         // JSON-first mode: 'summary' | 'skills' | 'experience' | ...
  section_content?: Record<string, unknown>; // JSON-first mode: content dict from StructuredResume
  evidence_text?: string;        // JSON-first mode: full resume plain text for evidence gating
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

export interface BatchRewriteItem {
  section_name: string;
  section_type?: string;
  section_content?: any;
  recommendations?: string[];
  user_instructions?: string;
  metric_inputs?: Record<string, string>;
}

export interface BatchRewriteRequest {
  document_id?: string;
  job_description_text: string;
  sections: BatchRewriteItem[];
  user_instructions?: string;
  metric_inputs?: Record<string, string>;
}

export interface BatchRewriteResponse {
  rewrites: Record<string, string>;
  download_id?: string;
  download_url?: string;
}

export async function batchRewriteSections(
  request: BatchRewriteRequest
): Promise<BatchRewriteResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resume/batch-rewrite`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to execute batch rewrite");
  }

  return response.json();
}

export interface ApplyRewriteItem {
  section: string;
  rewritten_text: string;
}

export interface ApplyRewriteRequest {
  document_id?: string;          // Optional: if omitted, ATS template generated from JSON
  accepted_rewrites: ApplyRewriteItem[];
  preferred_template?: string;   // 'clean_classic' | 'modern_professional' | 'executive_profile'
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
  target_role?: string;
  contact_info?: string;
  rewritten_sections?: Record<string, string>;
  confirmed_matched_skills?: string[];
}

export interface ProfileUpdatePayload {
  name?: string;
  phone_number?: string;
  address?: string;
  linkedin_url?: string;
}

export async function updateProfile(payload: ProfileUpdatePayload): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/profile`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.detail || "Failed to update profile");
  }
  return response.json();
}

export async function clearMissingSkills(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/clear-missing-skills`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.detail || "Failed to clear missing skills");
  }
  return response.json();
}

export async function setBaseResume(documentId: string, filename: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/v1/documents/set-base`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ document_id: documentId, filename }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.detail || "Failed to set base resume");
  }
  return response.json();
}

export async function setBaseCoverLetter(documentId: string, filename: string): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/v1/documents/set-base-cover-letter`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ document_id: documentId, filename }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.detail || "Failed to save base cover letter");
  }
  return response.json();
}

export async function deleteBaseCoverLetter(): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/api/v1/documents/base-cover-letter`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err?.error?.detail || "Failed to remove base cover letter");
  }
  return response.json();
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

export interface AnalysisHistoryItem {
  id: number;
  document_id: string;
  filename: string;
  target_role: string | null;
  target_company: string | null;
  overall_score: number;
  sections_need_improvement: number;
  total_sections: number;
  download_id: string | null;
  created_at: string;
}

export interface DailyTargetSummary {
  today_completed: number;
  daily_target: number;
  progress_percentage: number;
  goal_achieved: boolean;
}

export interface HistorySummaryStats {
  total_analyzed: number;
  average_score: number;
  latest_analysis_at: string | null;
  daily_summary: DailyTargetSummary;
}

export interface HistoryResponse {
  items: AnalysisHistoryItem[];
  summary: HistorySummaryStats;
}

export interface HistoryDetailResponse {
  item: AnalysisHistoryItem;
  analysis_result: Record<string, any>;
  job_description_text: string;
}

export async function fetchAnalysisHistory(): Promise<HistoryResponse> {
  const tzOffset = new Date().getTimezoneOffset();
  const response = await fetch(`${API_BASE_URL}/api/v1/history?tz_offset=${tzOffset}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to fetch analysis history");
  }

  return response.json();
}

export async function updateDailyTarget(dailyTarget: number): Promise<DailyTargetSummary> {
  const tzOffset = new Date().getTimezoneOffset();
  let response = await fetch(`${API_BASE_URL}/api/v1/history/target?tz_offset=${tzOffset}`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify({ daily_target: dailyTarget }),
  });

  if (!response.ok) {
    response = await fetch(`${API_BASE_URL}/api/v1/history/target?tz_offset=${tzOffset}`, {
      method: "PATCH",
      headers: getHeaders(),
      body: JSON.stringify({ daily_target: dailyTarget }),
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to update daily target");
  }

  return response.json();
}

export async function fetchHistoryDetail(historyId: number): Promise<HistoryDetailResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/history/${historyId}`, {
    method: "GET",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to fetch history session");
  }

  return response.json();
}

export async function deleteHistoryItem(historyId: number): Promise<{ status: string; message: string }> {
  const response = await fetch(`${API_BASE_URL}/api/v1/history/${historyId}`, {
    method: "DELETE",
    headers: getHeaders(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to delete history item");
  }

  return response.json();
}

export interface ProfileCompletionItem {
  id: string;
  label: string;
  weight: number;
  isComplete: boolean;
}

export function calculateProfileCompletion(user: any) {
  const items: ProfileCompletionItem[] = [
    {
      id: "email",
      label: "Email Address",
      weight: 15,
      isComplete: Boolean(user?.email && user.email.trim().length > 0),
    },
    {
      id: "name",
      label: "Full Name",
      weight: 15,
      isComplete: Boolean(user?.name && user.name.trim().length > 0),
    },
    {
      id: "address",
      label: "Location / Address",
      weight: 15,
      isComplete: Boolean(user?.address && user.address.trim().length > 0),
    },
    {
      id: "phone",
      label: "Phone Number",
      weight: 15,
      isComplete: Boolean(user?.phone_number && user.phone_number.trim().length > 0),
    },
    {
      id: "linkedin",
      label: "LinkedIn / Portfolio",
      weight: 15,
      isComplete: Boolean(user?.linkedin_url && user.linkedin_url.trim().length > 0),
    },
    {
      id: "base_resume",
      label: "Master Base Resume (.docx)",
      weight: 15,
      isComplete: Boolean(user?.base_resume_id),
    },
    {
      id: "base_cover_letter",
      label: "Base Cover Letter Template (.docx)",
      weight: 10,
      isComplete: Boolean(user?.base_cover_letter_id),
    },
  ];

  const totalPercentage = items.reduce((acc, item) => acc + (item.isComplete ? item.weight : 0), 0);
  return { items, totalPercentage };
}


