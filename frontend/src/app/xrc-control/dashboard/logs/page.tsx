"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ScrollText,
  Filter,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Code,
  AlertCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { fetchActivityLogs, AdminActivityLogItem } from "@/lib/admin-api";

export default function LogsPage() {
  const [logs, setLogs] = useState<AdminActivityLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchActivityLogs({
        page,
        limit: 20,
        action: actionFilter !== "all" ? actionFilter : undefined,
      });
      setLogs(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load audit logs.");
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const toggleExpand = (id: number) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case "credit_update":
        return "bg-blue-50 text-blue-700 border-blue-200/60";
      case "plan_change":
        return "bg-purple-50 text-purple-700 border-purple-200/60";
      case "admin_toggle":
        return "bg-rose-50 text-rose-700 border-rose-200/60";
      case "config_change":
        return "bg-amber-50 text-amber-700 border-amber-200/60";
      case "support_status":
        return "bg-emerald-50 text-emerald-700 border-emerald-200/60";
      case "admin_login":
        return "bg-slate-100 text-slate-700 border-slate-200/60";
      default:
        return "bg-slate-50 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Trail Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Immutable system record of all administrative modifications, plan grants, and security logins.
          </p>
        </div>
        <div className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/60 self-start sm:self-auto">
          Total Logs: {total.toLocaleString()}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <Filter className="w-3.5 h-3.5" />
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Actions</option>
            <option value="credit_update">Credit Updates</option>
            <option value="plan_change">Plan Changes</option>
            <option value="admin_toggle">Admin Toggles</option>
            <option value="config_change">Config Changes</option>
            <option value="support_status">Support Status Changes</option>
            <option value="admin_login">Admin Logins</option>
          </select>
        </div>
        <span className="text-xs text-slate-400">
          Click any row to inspect full JSON payload.
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-4 w-12">#</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Admin</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target User ID</th>
                <th className="py-3.5 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-indigo-600 mb-2" />
                    <span>Loading audit trail...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <ScrollText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <span>No audit logs recorded yet.</span>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isExpanded = expandedId === log.id;
                  let parsedPayload: Record<string, unknown> | null = null;
                  if (log.payload_json) {
                    try {
                      parsedPayload = JSON.parse(log.payload_json);
                    } catch {
                      parsedPayload = null;
                    }
                  }

                  return (
                    <tr
                      key={log.id}
                      onClick={() => toggleExpand(log.id)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 px-4 text-slate-400 font-mono">{log.id}</td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {new Date(log.created_at).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-800">
                        {log.admin_email}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${getActionBadgeClass(
                            log.action
                          )}`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500">
                        {log.target_user_id !== null ? `#${log.target_user_id}` : "Global"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(log.id);
                          }}
                          className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-600 font-semibold"
                        >
                          <Code className="w-3.5 h-3.5" />
                          <span>{isExpanded ? "Hide" : "JSON"}</span>
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Expandable JSON Detail Display if selected */}
        {expandedId !== null && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 text-xs">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="font-mono text-[11px] font-semibold text-indigo-400">
                Audit Payload Details · Log #{expandedId}
              </span>
              <button
                onClick={() => setExpandedId(null)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
            <pre className="text-slate-200 font-mono text-[11px] overflow-x-auto leading-relaxed max-h-60">
              {(() => {
                const target = logs.find((l) => l.id === expandedId);
                if (!target || !target.payload_json) return "No payload data recorded.";
                try {
                  return JSON.stringify(JSON.parse(target.payload_json), null, 2);
                } catch {
                  return target.payload_json;
                }
              })()}
            </pre>
          </div>
        )}

        {/* Pagination Footer */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing Page <span className="font-semibold text-slate-800">{page}</span> of{" "}
            <span className="font-semibold text-slate-800">{totalPages}</span> ({total} logs)
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
