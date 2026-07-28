"use client";

import { useState, useEffect } from "react";
import {
  X,
  History,
  Target,
  Trophy,
  Search,
  CheckCircle,
  FileText,
  Download,
  Trash2,
  ExternalLink,
  RefreshCw,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import {
  fetchAnalysisHistory,
  updateDailyTarget,
  fetchHistoryDetail,
  deleteHistoryItem,
  HistoryResponse,
  AnalysisHistoryItem,
  API_BASE_URL,
} from "@/lib/api";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSession: (analysisResult: any, jobDescriptionText: string, documentId: string, filename: string) => void;
}

export default function HistoryModal({
  isOpen,
  onClose,
  onRestoreSession,
}: HistoryModalProps) {
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isUpdatingTarget, setIsUpdatingTarget] = useState(false);
  const [loadingItemId, setLoadingItemId] = useState<number | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);

  const loadHistory = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAnalysisHistory();
      setHistoryData(data);
    } catch (err: any) {
      setError(err?.message || "Failed to load analysis history.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTargetChange = async (newTarget: number) => {
    if (!historyData) return;
    setIsUpdatingTarget(true);
    setError(null);
    try {
      const updatedSummary = await updateDailyTarget(newTarget);
      setHistoryData({
        ...historyData,
        summary: {
          ...historyData.summary,
          daily_summary: updatedSummary,
        },
      });
    } catch (err: any) {
      console.error("Failed to update target:", err);
      setError(err?.message || "Failed to update daily target. Please try again.");
    } finally {
      setIsUpdatingTarget(false);
    }
  };

  const handleRestore = async (item: AnalysisHistoryItem) => {
    setLoadingItemId(item.id);
    try {
      const detail = await fetchHistoryDetail(item.id);
      onRestoreSession(
        detail.analysis_result,
        detail.job_description_text,
        detail.item.document_id,
        detail.item.filename
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to restore session.");
    } finally {
      setLoadingItemId(null);
    }
  };

  const handleDelete = async (historyId: number) => {
    if (!confirm("Are you sure you want to delete this history record?")) return;
    setDeletingItemId(historyId);
    try {
      await deleteHistoryItem(historyId);
      await loadHistory();
    } catch (err: any) {
      setError(err?.message || "Failed to delete history item.");
    } finally {
      setDeletingItemId(null);
    }
  };

  const filteredItems = (historyData?.items || []).filter((item) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (item.target_role && item.target_role.toLowerCase().includes(q)) ||
      (item.target_company && item.target_company.toLowerCase().includes(q)) ||
      (item.filename && item.filename.toLowerCase().includes(q))
    );
  });

  const daily = historyData?.summary?.daily_summary;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shrink-0">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Resume Tailoring History & Goals
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track your daily application goals and reload past analysis sessions in 1-click.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-slate-200/60 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </div>
          )}

          {/* 🎯 Daily Application Target Tracker Card */}
          {daily && (
            <div className="glass-panel p-5 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/80 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 space-y-3.5 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                      Daily Application Target
                      {daily.goal_achieved && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold flex items-center gap-1">
                          <Trophy className="h-3 w-3" /> Goal Accomplished!
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                      Today: <span className="font-bold text-indigo-600 dark:text-indigo-400">{daily.today_completed}</span> / {daily.daily_target} jobs tailored ({daily.progress_percentage}%)
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Resets daily at 00:00 UTC (5:30 AM IST)
                    </p>
                  </div>
                </div>

                {/* Target Selector Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Set Target:</span>
                  <select
                    value={daily.daily_target}
                    disabled={isUpdatingTarget}
                    onChange={(e) => handleTargetChange(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {[5, 10, 15, 20, 25, 30, 40, 50].map((num) => (
                      <option key={num} value={num}>
                        {num} jobs / day
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300/50 dark:border-slate-700">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-500 transition-all duration-500 shadow-sm"
                    style={{ width: `${daily.progress_percentage}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Aggregate Stats Header Row */}
          {historyData?.summary && (
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Total Tailored
                </span>
                <span className="text-lg font-black text-slate-900 dark:text-white">
                  {historyData.summary.total_analyzed}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Average ATS Match
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                  {historyData.summary.average_score}%
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Today's Count
                </span>
                <span className="text-lg font-black text-indigo-600 dark:text-indigo-400">
                  {historyData.summary.daily_summary.today_completed}
                </span>
              </div>
            </div>
          )}

          {/* Search & Filter Bar */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by job title, company, or file name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="button"
              onClick={loadHistory}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all cursor-pointer"
              title="Refresh history"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* History Items List */}
          {isLoading ? (
            <div className="p-12 text-center space-y-3">
              <div className="h-6 w-6 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Loading analysis history...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 space-y-2">
              <History className="h-8 w-8 text-slate-400 mx-auto opacity-50" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {searchQuery ? "No history entries match your search." : "No resume analysis history found yet."}
              </p>
              <p className="text-[11px] text-slate-400">
                Analyze a job description with your resume to start tracking your application history!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => {
                const isoStr = item.created_at;
                const formattedIso = isoStr && !isoStr.endsWith("Z") && !isoStr.includes("+") ? `${isoStr}Z` : isoStr;
                const d = new Date(formattedIso);
                const dateStr = `${d.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })} at ${d.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`;

                return (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all duration-150 space-y-3 shadow-sm group"
                  >
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 dark:text-white">
                            {item.target_role || "Target Role"}
                          </span>
                          {item.target_company && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {item.target_company}
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-medium">
                            {dateStr}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <FileText className="h-3 w-3 shrink-0" />
                          <span>{item.filename}</span>
                        </p>
                      </div>

                      {/* Score Badge */}
                      <div className="flex items-center gap-2">
                        <div className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs">
                          {item.overall_score}% Match
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {item.sections_need_improvement === 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" /> All sections optimized
                          </span>
                        ) : (
                          <span>
                            {item.sections_need_improvement} of {item.total_sections} sections improved
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* 1-Click Open in Workspace */}
                        <button
                          type="button"
                          disabled={loadingItemId === item.id}
                          onClick={() => handleRestore(item)}
                          className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {loadingItemId === item.id ? (
                            <div className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-indigo-200" />
                          )}
                          Open in Workspace
                        </button>

                        {/* Direct Download links if available */}
                        {item.download_id && (
                          <>
                            <a
                              href={`${API_BASE_URL}/api/v1/resume/download/${item.download_id}`}
                              download
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                              title="Download DOCX"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={`${API_BASE_URL}/api/v1/resume/download/${item.download_id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                              title="Download PDF"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </>
                        )}

                        {/* Delete history entry */}
                        <button
                          type="button"
                          disabled={deletingItemId === item.id}
                          onClick={() => handleDelete(item.id)}
                          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-rose-600 hover:border-rose-300 transition-all cursor-pointer"
                          title="Delete record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
