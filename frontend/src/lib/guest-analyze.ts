/**
 * guest-analyze.ts
 *
 * Utilities for the freemium "try-before-sign-in" flow.
 *
 * 1. extractDocxText — extracts plain text from a .docx File object client-side
 *    using mammoth.js. The original binary File is NEVER sent to the server during
 *    the guest phase — it stays in React state intact for the authenticated upload
 *    that happens after sign-in, which preserves all DOCX formatting/layout.
 *
 * 2. runGuestAnalysis — calls POST /api/v1/resume/analyze-guest with the extracted
 *    text and the job description. Returns the same ResumeAnalysisResult shape as
 *    the authenticated endpoint.
 */

import { API_BASE_URL, ResumeAnalysisResult } from "./api";

/**
 * Extract plain text from a .docx File object using mammoth.js.
 * This is used ONLY for the guest ATS analysis — the original File object
 * is preserved separately for authenticated DOCX patching.
 */
export async function extractDocxText(file: File): Promise<string> {
  // mammoth works on ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  // Dynamic import keeps mammoth out of the initial bundle
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  if (!result.value || result.value.trim().length < 50) {
    throw new Error(
      "Could not extract readable text from this file. Please ensure it is a valid .docx document."
    );
  }
  return result.value;
}

/**
 * Call the guest (unauthenticated) analysis endpoint.
 * Rate-limited server-side to 3 requests/hour per IP.
 */
export async function runGuestAnalysis(
  resumeText: string,
  jobDescription: string
): Promise<ResumeAnalysisResult> {
  const response = await fetch(`${API_BASE_URL}/api/v1/resume/analyze-guest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // No Authorization header — this endpoint is intentionally auth-free
    body: JSON.stringify({
      resume_text: resumeText,
      job_description: jobDescription,
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data?.detail || data?.message || "Guest analysis failed.";
    throw new Error(detail);
  }

  return response.json();
}
