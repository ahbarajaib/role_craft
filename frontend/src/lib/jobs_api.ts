import { API_BASE_URL } from "./api";

export interface ScoredJob {
  title: string;
  company: string;
  url: string;
  snippet: string;
  location: string | null;
  score: number;
  rationale: string;
}

export interface JobSearchResponse {
  jobs: ScoredJob[];
}

export interface JobSearchRequest {
  document_id?: string | null;
  query: string;
  location: string;
  limit?: number;
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("rc_token");
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }
  return headers;
}

export async function searchAndScoreJobs(request: JobSearchRequest): Promise<JobSearchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/v1/jobs/search-and-score`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData?.error?.detail || "Failed to search and score jobs");
  }

  return response.json();
}
