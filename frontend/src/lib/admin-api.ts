import { API_BASE_URL } from "./api";

export interface AdminUserItem {
  id: number;
  email: string;
  name?: string | null;
  provider: string;
  is_admin: boolean;
  credits: number;
  plan_type: string;
  subscription_status: string;
  razorpay_subscription_id?: string | null;
  phone_number?: string | null;
  created_at: string;
  analysis_count: number;
  tailored_count: number;
}

export interface AdminUserDetail extends AdminUserItem {
  address?: string | null;
  linkedin_url?: string | null;
  base_resume_filename?: string | null;
  base_cover_letter_filename?: string | null;
  missing_skills_tracker?: Record<string, number> | null;
}

export interface AdminUserListResponse {
  items: AdminUserItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminOverviewStats {
  total_users: number;
  pro_users: number;
  elite_users: number;
  free_users: number;
  admin_users: number;
  estimated_mrr_inr: number;
  total_analyses: number;
  total_tailored_resumes: number;
  open_tickets_count: number;
}

export interface AdminSignupStat {
  date: string;
  count: number;
}

export interface AdminUsageStat {
  date: string;
  analyses: number;
  tailored: number;
}

export interface AdminSupportTicketItem {
  id: number;
  user_id?: number | null;
  user_email?: string | null;
  issue_type: string;
  subject?: string | null;
  description: string;
  context_data?: string | null;
  status: "open" | "investigating" | "resolved";
  created_at: string;
}

export interface AdminSupportListResponse {
  items: AdminSupportTicketItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface AdminConfigResponse {
  configs: {
    FREE_TIER_CREDITS: number;
    PRO_CREDITS: number;
    ELITE_CREDITS: number;
    VIP_EMAILS: string[];
    [key: string]: unknown;
  };
  last_updated: Record<string, { updated_at: string | null; updated_by: string | null }>;
}

export interface AdminSubscriptionItem {
  user_id: number;
  email: string;
  name?: string | null;
  plan_type: string;
  subscription_status: string;
  razorpay_subscription_id?: string | null;
  created_at: string;
}

export interface AdminBillingResponse {
  estimated_mrr_inr: number;
  pro_subscribers_count: number;
  elite_subscribers_count: number;
  active_subscriptions: AdminSubscriptionItem[];
}

export interface AdminActivityLogItem {
  id: number;
  admin_email: string;
  action: string;
  target_user_id?: number | null;
  payload_json?: string | null;
  created_at: string;
}

export interface AdminActivityLogResponse {
  items: AdminActivityLogItem[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Storage helpers - use sessionStorage so tokens automatically expire on window/tab close
export const ADMIN_JWT_KEY = "rc_admin_jwt";
export const ADMIN_SESSION_TOKEN_KEY = "rc_admin_token";
export const ADMIN_EMAIL_KEY = "rc_admin_email";

export function getAdminJwt(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_JWT_KEY) || localStorage.getItem("rc_token");
}

export function getAdminSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
}

export function getAdminEmail(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_EMAIL_KEY);
}

export function setAdminAuth(jwt: string, email: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ADMIN_JWT_KEY, jwt);
  sessionStorage.setItem(ADMIN_EMAIL_KEY, email);
}

export function setAdminSessionToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, token);
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_JWT_KEY);
  sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
  sessionStorage.removeItem(ADMIN_EMAIL_KEY);
}

export function isAdminLoggedIn(): boolean {
  return !!(getAdminJwt() && getAdminSessionToken());
}

function getAdminHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const jwt = getAdminJwt();
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }
  return headers;
}

function withAdminToken(urlStr: string): string {
  const token = getAdminSessionToken();
  if (!token) return urlStr;
  const separator = urlStr.includes("?") ? "&" : "?";
  return `${urlStr}${separator}admin_token=${encodeURIComponent(token)}`;
}

async function handleAdminResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      // If unauthorized, redirect to login page if in browser
      if (typeof window !== "undefined" && window.location.pathname.startsWith("/xrc-control/dashboard")) {
        clearAdminSession();
        window.location.href = "/xrc-control";
      }
    }
    const errBody = await res.json().catch(() => ({}));
    const message = errBody?.error?.detail || errBody?.detail || `Admin request failed (${res.status})`;
    throw new Error(message);
  }
  return res.json();
}

// ── API Methods ────────────────────────────────────────────────────────────

export async function loginAdminStep1(email: string, password: string) {
  const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.detail || err?.detail || "Invalid email or password.");
  }

  const data = await res.json();
  const user = data.user;
  if (!data.access_token) {
    throw new Error("Authentication failed. No access token returned.");
  }

  setAdminAuth(data.access_token, user?.email || email.trim());
  return data;
}

export async function verifyAdminPinStep2(pin: string) {
  const jwt = getAdminJwt();
  if (!jwt) {
    throw new Error("Authentication session missing. Please sign in again.");
  }

  const res = await fetch(`${API_BASE_URL}/api/v1/admin/auth/verify-pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({ pin: pin.trim() }),
  });

  const data = await handleAdminResponse<{
    admin_session_token: string;
    expires_in_minutes: number;
    email: string;
  }>(res);

  setAdminSessionToken(data.admin_session_token);
  return data;
}

export async function fetchOverviewStats(): Promise<AdminOverviewStats> {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/stats/overview`), {
    headers: getAdminHeaders(),
  });
  return handleAdminResponse<AdminOverviewStats>(res);
}

export async function fetchSignupStats(days: number = 30): Promise<AdminSignupStat[]> {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/stats/signups?days=${days}`), {
    headers: getAdminHeaders(),
  });
  return handleAdminResponse<AdminSignupStat[]>(res);
}

export async function fetchUsageStats(days: number = 30): Promise<AdminUsageStat[]> {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/stats/usage?days=${days}`), {
    headers: getAdminHeaders(),
  });
  return handleAdminResponse<AdminUsageStat[]>(res);
}

export async function fetchUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  plan_type?: string;
  is_admin?: boolean;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}): Promise<AdminUserListResponse> {
  const url = new URL(`${API_BASE_URL}/api/v1/admin/users`);
  if (params.page) url.searchParams.set("page", params.page.toString());
  if (params.limit) url.searchParams.set("limit", params.limit.toString());
  if (params.search) url.searchParams.set("search", params.search);
  if (params.plan_type && params.plan_type !== "all") url.searchParams.set("plan_type", params.plan_type);
  if (params.is_admin !== undefined) url.searchParams.set("is_admin", params.is_admin.toString());
  if (params.sort_by) url.searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) url.searchParams.set("sort_order", params.sort_order);

  const res = await fetch(withAdminToken(url.toString()), {
    headers: getAdminHeaders(),
  });
  return handleAdminResponse<AdminUserListResponse>(res);
}

export async function fetchUserDetail(userId: number): Promise<AdminUserDetail> {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/users/${userId}`), {
    headers: getAdminHeaders(),
  });
  return handleAdminResponse<AdminUserDetail>(res);
}

export async function updateUserCredits(userId: number, amount: number, mode: "set" | "add" = "set") {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/users/${userId}/credits`), {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ amount, mode }),
  });
  return handleAdminResponse<{ success: boolean; user_id: number; old_credits: number; new_credits: number }>(res);
}

export async function updateUserPlan(userId: number, plan_type: string, subscription_status: string) {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/users/${userId}/plan`), {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ plan_type, subscription_status }),
  });
  return handleAdminResponse<{ success: boolean; user_id: number; plan_type: string; subscription_status: string }>(res);
}

export async function toggleUserAdmin(userId: number, is_admin: boolean) {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/users/${userId}/admin`), {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ is_admin }),
  });
  return handleAdminResponse<{ success: boolean; user_id: number; is_admin: boolean }>(res);
}

export async function fetchSupportTickets(params: {
  page?: number;
  limit?: number;
  status?: string;
  issue_type?: string;
}): Promise<AdminSupportListResponse> {
  const url = new URL(`${API_BASE_URL}/api/v1/admin/support`);
  if (params.page) url.searchParams.set("page", params.page.toString());
  if (params.limit) url.searchParams.set("limit", params.limit.toString());
  if (params.status && params.status !== "all") url.searchParams.set("status", params.status);
  if (params.issue_type && params.issue_type !== "all") url.searchParams.set("issue_type", params.issue_type);

  const res = await fetch(withAdminToken(url.toString()), {
    headers: getAdminHeaders(),
  });
  return handleAdminResponse<AdminSupportListResponse>(res);
}

export async function updateSupportStatus(reportId: number, status: "open" | "investigating" | "resolved") {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/support/${reportId}/status`), {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ status }),
  });
  return handleAdminResponse<{ success: boolean; report_id: number; status: string }>(res);
}

export async function fetchSiteConfig(): Promise<AdminConfigResponse> {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/config`), {
    headers: getAdminHeaders(),
  });
  return handleAdminResponse<AdminConfigResponse>(res);
}

export async function updateSiteConfig(key: string, value: unknown) {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/config`), {
    method: "POST",
    headers: getAdminHeaders(),
    body: JSON.stringify({ key, value }),
  });
  return handleAdminResponse<{ success: boolean; key: string; value: unknown }>(res);
}

export async function fetchBillingDashboard(): Promise<AdminBillingResponse> {
  const res = await fetch(withAdminToken(`${API_BASE_URL}/api/v1/admin/billing/subscriptions`), {
    headers: getAdminHeaders(),
  });
  return handleAdminResponse<AdminBillingResponse>(res);
}

export async function fetchActivityLogs(params: {
  page?: number;
  limit?: number;
  action?: string;
}): Promise<AdminActivityLogResponse> {
  const url = new URL(`${API_BASE_URL}/api/v1/admin/activity-log`);
  if (params.page) url.searchParams.set("page", params.page.toString());
  if (params.limit) url.searchParams.set("limit", params.limit.toString());
  if (params.action && params.action !== "all") url.searchParams.set("action", params.action);

  const res = await fetch(withAdminToken(url.toString()), {
    headers: getAdminHeaders(),
  });
  return handleAdminResponse<AdminActivityLogResponse>(res);
}

