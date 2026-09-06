"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  IndianRupee,
  Sparkles,
  Crown,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { fetchBillingDashboard, AdminBillingResponse } from "@/lib/admin-api";

export default function BillingPage() {
  const [data, setData] = useState<AdminBillingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadBilling() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetchBillingDashboard();
        setData(res);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load billing metrics.");
      } finally {
        setIsLoading(false);
      }
    }
    loadBilling();
  }, []);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-sm">Loading billing metrics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Subscriptions & Revenue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Overview of recurring active subscriptions, plan breakdown, and estimated MRR.
          </p>
        </div>
        <a
          href="https://dashboard.razorpay.com"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all self-start sm:self-auto cursor-pointer"
        >
          <span>Razorpay Dashboard</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Revenue Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Total MRR */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs bg-gradient-to-br from-white to-emerald-50/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Estimated Monthly Recurring Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            ₹{(data?.estimated_mrr_inr || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>(Pro × ₹399) + (Elite × ₹599)</span>
          </div>
        </div>

        {/* Pro Subscribers */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pro Plan Subscribers
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {data?.pro_subscribers_count || 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            ₹{((data?.pro_subscribers_count || 0) * 399).toLocaleString()}/month recurring
          </div>
        </div>

        {/* Elite Subscribers */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Elite Plan Subscribers
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {data?.elite_subscribers_count || 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            ₹{((data?.elite_subscribers_count || 0) * 599).toLocaleString()}/month recurring
          </div>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Active & Subscribed Accounts</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Users with Razorpay subscription IDs or active paid memberships.
            </p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
            {data?.active_subscriptions.length || 0} Records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Subscription Status</th>
                <th className="py-3.5 px-4">Razorpay Sub ID</th>
                <th className="py-3.5 px-4">Joined Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!data?.active_subscriptions || data.active_subscriptions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <CreditCard className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <span>No active paid subscriptions found.</span>
                  </td>
                </tr>
              ) : (
                data.active_subscriptions.map((sub) => (
                  <tr key={sub.user_id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{sub.name || "User"}</div>
                      <div className="text-slate-500 font-mono text-[11px] mt-0.5">{sub.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md capitalize ${
                          sub.plan_type === "elite"
                            ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                            : "bg-indigo-50 text-indigo-700 border border-indigo-200/60"
                        }`}
                      >
                        {sub.plan_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md capitalize ${
                          sub.subscription_status === "active"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {sub.subscription_status === "active" && (
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        )}
                        {sub.subscription_status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600 text-[11px]">
                      {sub.razorpay_subscription_id || (
                        <span className="text-slate-400 italic">Manual Admin Grant</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
