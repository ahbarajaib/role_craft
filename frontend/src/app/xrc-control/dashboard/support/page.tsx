"use client";

import { useEffect, useState, useCallback } from "react";
import {
  LifeBuoy,
  Filter,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Code,
  Mail,
  User as UserIcon,
} from "lucide-react";
import {
  fetchSupportTickets,
  updateSupportStatus,
  AdminSupportTicketItem,
} from "@/lib/admin-api";

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<AdminSupportTicketItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expanded row ID
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSupportTickets({
        page,
        limit: 15,
        status: statusFilter !== "all" ? statusFilter : undefined,
        issue_type: typeFilter !== "all" ? typeFilter : undefined,
      });
      setTickets(data.items);
      setTotal(data.total);
      setTotalPages(data.total_pages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load support tickets.");
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, typeFilter]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleStatusChange = async (reportId: number, newStatus: "open" | "investigating" | "resolved") => {
    setUpdatingId(reportId);
    try {
      await updateSupportStatus(reportId, newStatus);
      setTickets((prev) =>
        prev.map((t) => (t.id === reportId ? { ...t, status: newStatus } : t))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to update ticket status.");
    } finally {
      setUpdatingId(null);
    }
  };

  const toggleExpand = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Support Tickets & Feedback</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Triage user bug reports, formatting issues, and general inquiries in real-time.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 self-start sm:self-auto">
          Total Reports: {total.toLocaleString()}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="open">Open Only</option>
              <option value="investigating">Investigating Only</option>
              <option value="resolved">Resolved Only</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Issue Types</option>
              <option value="bug">Bug</option>
              <option value="formatting">Formatting</option>
              <option value="ai_quality">AI Quality</option>
              <option value="payment">Payment</option>
              <option value="feature_request">Feature Request</option>
              <option value="general">General</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400">
          Tip: Click any row to expand full details and metadata context.
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
              <span className="text-xs">Loading support tickets...</span>
            </div>
          ) : tickets.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <LifeBuoy className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <span className="text-xs font-medium">No support tickets found.</span>
            </div>
          ) : (
            tickets.map((t) => {
              const isExpanded = expandedId === t.id;
              let parsedContext: Record<string, unknown> | null = null;
              if (t.context_data) {
                try {
                  parsedContext = JSON.parse(t.context_data);
                } catch {
                  parsedContext = null;
                }
              }

              return (
                <div key={t.id} className="transition-colors hover:bg-slate-50/50">
                  {/* Row Header */}
                  <div
                    onClick={() => toggleExpand(t.id)}
                    className="p-4.5 flex items-start sm:items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-slate-400 font-mono text-xs">#{t.id}</span>
                        {/* Status Badge */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            t.status === "open"
                              ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                              : t.status === "investigating"
                              ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                              : "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          }`}
                        >
                          {t.status}
                        </span>

                        {/* Type Badge */}
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase tracking-wider">
                          {t.issue_type}
                        </span>

                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {t.subject || "No subject provided"}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-1 line-clamp-1">
                        {t.description}
                      </p>

                      <div className="flex items-center gap-4 text-[11px] text-slate-400 mt-2">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {t.user_email || "Anonymous"}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(t.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Status Dropdown Quick Changer */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-2 flex-shrink-0"
                    >
                      <select
                        value={t.status}
                        disabled={updatingId === t.id}
                        onChange={(e) =>
                          handleStatusChange(t.id, e.target.value as "open" | "investigating" | "resolved")
                        }
                        className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                      >
                        <option value="open">Mark Open</option>
                        <option value="investigating">Mark Investigating</option>
                        <option value="resolved">Mark Resolved</option>
                      </select>

                      <button
                        onClick={() => toggleExpand(t.id)}
                        className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 bg-slate-50/70 border-t border-slate-100 text-xs space-y-4">
                      {/* Full description */}
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                          Full Description
                        </span>
                        <div className="p-3.5 rounded-xl bg-white border border-slate-200 text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {t.description}
                        </div>
                      </div>

                      {/* Context data JSON */}
                      {t.context_data && (
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1 mb-1">
                            <Code className="w-3.5 h-3.5" /> Technical Context (JSON)
                          </span>
                          <pre className="p-3.5 rounded-xl bg-slate-900 text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed">
                            {JSON.stringify(parsedContext || t.context_data, null, 2)}
                          </pre>
                        </div>
                      )}

                      {/* User Info */}
                      <div className="flex items-center gap-4 text-slate-500 text-[11px]">
                        <span>
                          User ID: <span className="font-mono text-slate-700">{t.user_id || "None (Guest)"}</span>
                        </span>
                        <span>·</span>
                        <span>
                          User Email: <span className="font-mono text-slate-700">{t.user_email || "Not provided"}</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing Page <span className="font-semibold text-slate-800">{page}</span> of{" "}
            <span className="font-semibold text-slate-800">{totalPages}</span> ({total} tickets)
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
