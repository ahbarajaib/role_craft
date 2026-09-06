"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  Sparkles,
  Crown,
  IndianRupee,
  FileSearch,
  Wand2,
  LifeBuoy,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  Loader2,
  AlertCircle,
  Clock,
} from "lucide-react";
import {
  fetchOverviewStats,
  fetchSignupStats,
  fetchUsageStats,
  fetchUsers,
  fetchSupportTickets,
  AdminOverviewStats,
  AdminSignupStat,
  AdminUsageStat,
  AdminUserItem,
  AdminSupportTicketItem,
} from "@/lib/admin-api";

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [signups, setSignups] = useState<AdminSignupStat[]>([]);
  const [usage, setUsage] = useState<AdminUsageStat[]>([]);
  const [recentUsers, setRecentUsers] = useState<AdminUserItem[]>([]);
  const [recentTickets, setRecentTickets] = useState<AdminSupportTicketItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError(null);

    try {
      const [overviewData, signupData, usageData, usersData, ticketsData] = await Promise.all([
        fetchOverviewStats(),
        fetchSignupStats(30),
        fetchUsageStats(30),
        fetchUsers({ page: 1, limit: 5, sort_by: "created_at", sort_order: "desc" }),
        fetchSupportTickets({ page: 1, limit: 5 }),
      ]);

      setStats(overviewData);
      setSignups(signupData);
      setUsage(usageData);
      setRecentUsers(usersData.items);
      setRecentTickets(ticketsData.items);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load dashboard data.";
      setError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Compute max values for simple SVG chart normalization
  const maxSignup = Math.max(...signups.map((s) => s.count), 1);
  const totalSignupsLast30 = signups.reduce((acc, s) => acc + s.count, 0);

  const maxUsage = Math.max(...usage.map((u) => Math.max(u.analyses, u.tailored)), 1);
  const totalAnalyses30 = usage.reduce((acc, u) => acc + u.analyses, 0);
  const totalTailored30 = usage.reduce((acc, u) => acc + u.tailored, 0);

  if (isLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
        <span className="text-sm">Loading admin metrics...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Real-time platform metrics, revenue estimates, and operational health.
          </p>
        </div>
        <button
          onClick={() => loadAllData(true)}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-600" : ""}`} />
          <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Row 1: Key Financial & User Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Users */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Users
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {stats?.total_users.toLocaleString() || 0}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
            <span className="font-medium text-slate-700">{stats?.free_users || 0} Free</span>
            <span>·</span>
            <span className="font-medium text-indigo-600">{stats?.admin_users || 0} Admins</span>
          </div>
        </div>

        {/* Pro Plan */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pro Subscribers
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {stats?.pro_users || 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            ₹399/month active subscribers
          </div>
        </div>

        {/* Elite Plan */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Elite Subscribers
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Crown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {stats?.elite_users || 0}
          </div>
          <div className="mt-2 text-xs text-slate-500">
            ₹599/month active subscribers
          </div>
        </div>

        {/* Estimated MRR */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs bg-gradient-to-br from-white to-indigo-50/30">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-700">
              Est. Monthly Revenue
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
            ₹{(stats?.estimated_mrr_inr || 0).toLocaleString()}
          </div>
          <div className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>MRR calculation based on active plans</span>
          </div>
        </div>
      </div>

      {/* Row 2: Secondary Operational Badges */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
              <FileSearch className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">All-Time Analyses</div>
              <div className="text-xl font-bold text-slate-900">{stats?.total_analyses.toLocaleString()}</div>
            </div>
          </div>
          <Link
            href="/xrc-control/dashboard/users"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Users <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Tailored Resumes</div>
              <div className="text-xl font-bold text-slate-900">{stats?.total_tailored_resumes.toLocaleString()}</div>
            </div>
          </div>
          <Link
            href="/xrc-control/dashboard/users"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Users <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                (stats?.open_tickets_count || 0) > 0
                  ? "bg-amber-50 text-amber-600 animate-pulse"
                  : "bg-emerald-50 text-emerald-600"
              }`}
            >
              <LifeBuoy className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-500">Open Tickets</div>
              <div className="text-xl font-bold text-slate-900">{stats?.open_tickets_count || 0}</div>
            </div>
          </div>
          <Link
            href="/xrc-control/dashboard/support"
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            Review <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Row 3: Visual Trend Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signups Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Signups (Last 30 Days)</h2>
              <p className="text-xs text-slate-500">
                Total: <span className="font-semibold text-slate-800">{totalSignupsLast30}</span> new accounts
              </p>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              Daily
            </span>
          </div>

          <div className="h-44 flex items-end gap-1 pt-6 pb-2 border-b border-slate-100">
            {signups.map((item, idx) => {
              const heightPct = Math.max(8, (item.count / maxSignup) * 100);
              const dateLabel = item.date.slice(5); // MM-DD
              return (
                <div
                  key={idx}
                  className="flex-1 flex flex-col items-center group relative h-full justify-end"
                >
                  {/* Tooltip */}
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap">
                    {dateLabel}: {item.count}
                  </div>
                  <div
                    style={{ height: `${heightPct}%` }}
                    className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t-sm transition-all"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>{signups[0]?.date || ""}</span>
            <span>{signups[signups.length - 1]?.date || ""}</span>
          </div>
        </div>

        {/* Feature Usage Chart */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Feature Usage (Last 30 Days)</h2>
              <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  Analyses ({totalAnalyses30})
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                  Tailoring ({totalTailored30})
                </span>
              </div>
            </div>
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              AI Activity
            </span>
          </div>

          <div className="h-44 flex items-end gap-1 pt-6 pb-2 border-b border-slate-100">
            {usage.map((item, idx) => {
              const aHeight = Math.max(4, (item.analyses / maxUsage) * 100);
              const tHeight = Math.max(4, (item.tailored / maxUsage) * 100);
              const dateLabel = item.date.slice(5);
              return (
                <div
                  key={idx}
                  className="flex-1 flex items-end justify-center gap-0.5 group relative h-full"
                >
                  <div className="absolute -top-7 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded shadow z-10 whitespace-nowrap">
                    {dateLabel}: {item.analyses}a / {item.tailored}t
                  </div>
                  <div
                    style={{ height: `${aHeight}%` }}
                    className="w-1/2 bg-teal-500 hover:bg-teal-600 rounded-t-sm transition-all"
                  />
                  <div
                    style={{ height: `${tHeight}%` }}
                    className="w-1/2 bg-purple-500 hover:bg-purple-600 rounded-t-sm transition-all"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-mono">
            <span>{usage[0]?.date || ""}</span>
            <span>{usage[usage.length - 1]?.date || ""}</span>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Users & Recent Support Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Recent Signups</h2>
            <Link
              href="/xrc-control/dashboard/users"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentUsers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No users found.</div>
            ) : (
              recentUsers.map((u) => (
                <div key={u.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 truncate">
                        {u.name || u.email.split("@")[0]}
                      </span>
                      {u.is_admin && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                          Admin
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.2 rounded capitalize ${
                          u.plan_type === "elite"
                            ? "bg-amber-50 text-amber-700"
                            : u.plan_type === "pro"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {u.plan_type}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{u.email}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xs font-semibold text-slate-800">{u.credits} credits</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Support Tickets */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Recent Support Reports</h2>
            <Link
              href="/xrc-control/dashboard/support"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              View All <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recentTickets.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">No support tickets reported.</div>
            ) : (
              recentTickets.map((t) => (
                <div key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                          t.status === "open"
                            ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                            : t.status === "investigating"
                            ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                        }`}
                      >
                        {t.status}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {t.subject || t.issue_type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-1">
                      {t.description}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(t.created_at).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate max-w-[120px] mt-0.5">
                      {t.user_email || "Anonymous"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
