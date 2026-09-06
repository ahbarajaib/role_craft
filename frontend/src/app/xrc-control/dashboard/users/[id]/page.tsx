"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User as UserIcon,
  Coins,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Phone,
  Globe,
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Code,
  Trash2,
} from "lucide-react";
import {
  fetchUserDetail,
  updateUserCredits,
  updateUserPlan,
  toggleUserAdmin,
  deleteUser,
  AdminUserDetail,
  getAdminEmail,
} from "@/lib/admin-api";

export default function SingleUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const userId = parseInt(resolvedParams.id, 10);
  const router = useRouter();

  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Form states
  const [credits, setCredits] = useState(0);
  const [planType, setPlanType] = useState("free");
  const [subStatus, setSubStatus] = useState("inactive");

  const currentAdminEmail = getAdminEmail();

  const loadUser = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchUserDetail(userId);
      setUser(data);
      setCredits(data.credits);
      setPlanType(data.plan_type);
      setSubStatus(data.subscription_status);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load user profile.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isNaN(userId)) {
      loadUser();
    }
  }, [userId]);

  const handleUpdateCredits = async (mode: "set" | "add") => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await updateUserCredits(userId, credits, mode);
      setUser((prev) => (prev ? { ...prev, credits: res.new_credits } : null));
      setFeedback({
        type: "success",
        text: `Credits successfully ${mode === "add" ? "added" : "set"}. New balance: ${res.new_credits}`,
      });
    } catch (err: unknown) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Failed to update credits." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePlan = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await updateUserPlan(userId, planType, subStatus);
      setUser((prev) =>
        prev
          ? {
              ...prev,
              plan_type: res.plan_type,
              subscription_status: res.subscription_status,
              credits: res.credits ?? prev.credits,
            }
          : null
      );
      if (res.credits !== undefined) {
        setCredits(res.credits);
      }
      setFeedback({
        type: "success",
        text: `Plan updated to ${res.plan_type.toUpperCase()} (${res.subscription_status}). Credit balance: ${res.credits ?? credits}`,
      });
    } catch (err: unknown) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Failed to update plan." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleAdmin = async () => {
    if (!user) return;
    const targetState = !user.is_admin;
    const confirmed = window.confirm(
      targetState
        ? `Promote ${user.email} to Administrator?`
        : `Remove Administrator access from ${user.email}?`
    );
    if (!confirmed) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await toggleUserAdmin(userId, targetState);
      setUser((prev) => (prev ? { ...prev, is_admin: res.is_admin } : null));
      setFeedback({ type: "success", text: `User is now ${res.is_admin ? "an Admin" : "a regular user"}.` });
    } catch (err: unknown) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Failed to toggle admin role." });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    if (user.email === currentAdminEmail) {
      alert("You cannot delete your own admin account.");
      return;
    }
    const confirmed = window.confirm(
      `⚠️ PERMANENT ACCOUNT DELETION\n\nAre you sure you want to permanently delete user:\n${user.email} (ID: #${user.id})?\n\nThis will purge all analysis histories, tailored resumes, and credit balances. This action CANNOT be undone.`
    );
    if (!confirmed) return;

    setActionLoading(true);
    setFeedback(null);
    try {
      await deleteUser(user.id);
      alert(`User ${user.email} was successfully deleted.`);
      router.push("/xrc-control/dashboard/users");
    } catch (err: unknown) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Failed to delete user." });
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-sm">Loading user profile #{userId}...</span>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="space-y-4">
        <Link
          href="/xrc-control/dashboard/users"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Users
        </Link>
        <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          {error || "User not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back button */}
      <Link
        href="/xrc-control/dashboard/users"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Users Table
      </Link>

      {/* Profile Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <UserIcon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{user.name || "Unnamed User"}</h1>
              {user.is_admin && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/70">
                  <ShieldCheck className="w-3 h-3 text-indigo-600" />
                  Admin
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">{user.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
            <div className="text-slate-400 text-[10px] uppercase font-sans">Analyses</div>
            <div className="font-bold text-slate-800 text-sm">{user.analysis_count}</div>
          </div>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 text-center">
            <div className="text-slate-400 text-[10px] uppercase font-sans">Tailored</div>
            <div className="font-bold text-slate-800 text-sm">{user.tailored_count}</div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 ${
            feedback.type === "success"
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-rose-50 text-rose-800 border border-rose-200"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Action Panels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Credits Panel */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Coins className="w-4 h-4 text-indigo-600" /> Credits Management
            </span>
            <span className="font-mono font-bold text-base text-slate-900">{user.credits} balance</span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              value={credits}
              onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
              className="w-28 px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => handleUpdateCredits("set")}
              disabled={actionLoading}
              className="flex-1 py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer"
            >
              Set Exact
            </button>
            <button
              onClick={() => handleUpdateCredits("add")}
              disabled={actionLoading}
              className="flex-1 py-2.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer"
            >
              + Add
            </button>
          </div>
        </div>

        {/* Plan Panel */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
            Subscription Tier
          </span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Plan</label>
              <select
                value={planType}
                onChange={(e) => setPlanType(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="free">Free</option>
                <option value="pro">Pro (₹399)</option>
                <option value="elite">Elite (₹599)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
              <select
                value={subStatus}
                onChange={(e) => setSubStatus(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <button
            onClick={handleUpdatePlan}
            disabled={actionLoading}
            className="w-full py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer"
          >
            Save Subscription Changes
          </button>
        </div>
      </div>

      {/* Admin Privilege Panel */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Administrator Role</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Admin users have unrestricted access to all control center metrics, user credit grants, and site configurations.
          </p>
        </div>
        <button
          onClick={handleToggleAdmin}
          disabled={actionLoading || (user.email === currentAdminEmail && user.is_admin)}
          className={`px-4 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer flex-shrink-0 ${
            user.is_admin
              ? "border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700"
              : "border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {user.email === currentAdminEmail && user.is_admin
            ? "Cannot Demote Self"
            : user.is_admin
            ? "Revoke Admin Access"
            : "Promote to Admin"}
        </button>
      </div>

      {/* Profile Details Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-4 text-xs">
        <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-3">
          Account Profile Attributes
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-600">
          <div>
            <span className="text-slate-400 block text-[11px]">User ID</span>
            <span className="font-mono text-slate-800">#{user.id}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Authentication Provider</span>
            <span className="capitalize text-slate-800">{user.provider}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Registered On</span>
            <span className="text-slate-800">{new Date(user.created_at).toLocaleString()}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Phone Number</span>
            <span className="text-slate-800">{user.phone_number || "None"}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Address</span>
            <span className="text-slate-800">{user.address || "None"}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">LinkedIn</span>
            {user.linkedin_url ? (
              <a
                href={user.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="text-indigo-600 hover:underline truncate block"
              >
                {user.linkedin_url}
              </a>
            ) : (
              <span className="text-slate-400">None</span>
            )}
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Master Resume Filename</span>
            <span className="font-mono text-slate-800">{user.base_resume_filename || "None"}</span>
          </div>

          <div>
            <span className="text-slate-400 block text-[11px]">Master Cover Letter Filename</span>
            <span className="font-mono text-slate-800">{user.base_cover_letter_filename || "None"}</span>
          </div>
        </div>

        {user.missing_skills_tracker && Object.keys(user.missing_skills_tracker).length > 0 && (
          <div className="pt-4 border-t border-slate-100">
            <span className="text-slate-400 block text-[11px] mb-2">
              Missing Skills Tracker (Aggregated across analyses)
            </span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(user.missing_skills_tracker).map(([skill, count]) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 text-[11px] font-mono border border-slate-200/60"
                >
                  {skill}: <span className="font-bold text-indigo-600">{count}x</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Danger Zone: Delete User */}
      <div className="bg-rose-50/70 rounded-2xl p-6 border border-rose-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-rose-600" />
            Delete User Account
          </h3>
          <p className="text-xs text-rose-600/80 mt-0.5">
            Permanently delete this user, purging their analysis histories, resumes, and credits. This action cannot be undone.
          </p>
        </div>
        <button
          onClick={handleDeleteUser}
          disabled={actionLoading || (user.email === currentAdminEmail)}
          className="px-4 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer flex-shrink-0 bg-rose-600 hover:bg-rose-700 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {user.email === currentAdminEmail ? "Cannot Delete Self" : "Permanently Delete User"}
        </button>
      </div>
    </div>
  );
}

