"use client";

import { useState, useEffect, useMemo } from "react";
import {
  X,
  History,
  Target,
  Trophy,
  Search,
  CheckCircle,
  FileText,
  Trash2,
  RefreshCw,
  Sparkles,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Calendar,
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
import { WordLogoIcon, PdfLogoIcon } from "@/components/file_format_icons";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreSession: (
    analysisResult: any,
    jobDescriptionText: string,
    documentId: string,
    filename: string
  ) => void;
}

type TimeframeFilter = "all" | "day" | "week" | "month";
type SortOption = "newest" | "oldest" | "score_high" | "score_low" | "role_az";

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

  // Advanced Filtering, Sorting & Pagination States
  const [timeframeFilter, setTimeframeFilter] = useState<TimeframeFilter>("all");
  const [dayOffset, setDayOffset] = useState(0); // 0 = Today, -1 = Yesterday, -2 = 2 days ago...
  const [weekOffset, setWeekOffset] = useState(0); // 0 = This Week, -1 = Last Week, -2 = 2 weeks ago...

  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [showChart, setShowChart] = useState(true);
  const itemsPerPage = 6;

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
      setCurrentPage(1);
    }
  }, [isOpen]);

  // Reset page to 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, timeframeFilter, sortBy, dayOffset, weekOffset]);


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

  // Helper to parse ISO date string safely
  const parseItemDate = (isoStr?: string) => {
    if (!isoStr) return new Date();
    const formatted = !isoStr.endsWith("Z") && !isoStr.includes("+") ? `${isoStr}Z` : isoStr;
    return new Date(formatted);
  };

  // Calculate Display Label for Day Stepper
  const dayStepperInfo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + dayOffset);
    const dateStr = d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

    let label = dateStr;
    if (dayOffset === 0) label = `Today (${dateStr})`;
    else if (dayOffset === -1) label = `Yesterday (${dateStr})`;
    else if (dayOffset === 1) label = `Tomorrow (${dateStr})`;

    return { label, date: d };
  }, [dayOffset]);

  // Calculate Display Label for Week Stepper
  const weekStepperInfo = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() + weekOffset * 7);
    const start = new Date(end);
    start.setDate(start.getDate() - 6);

    const startStr = start.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endStr = end.toLocaleDateString(undefined, { month: "short", day: "numeric" });

    let title = `${startStr} - ${endStr}`;
    if (weekOffset === 0) title = `This Week (${startStr} - ${endStr})`;
    else if (weekOffset === -1) title = `Last Week (${startStr} - ${endStr})`;
    else if (weekOffset < -1) title = `${Math.abs(weekOffset)} Weeks Ago (${startStr} - ${endStr})`;

    return { title, start, end };
  }, [weekOffset]);

  // 1. Timeframe Filter with Day & Week Steppers
  const timeframeFilteredItems = useMemo(() => {
    const allItems = historyData?.items || [];
    if (timeframeFilter === "all") return allItems;

    if (timeframeFilter === "day") {
      const targetYear = dayStepperInfo.date.getFullYear();
      const targetMonth = dayStepperInfo.date.getMonth();
      const targetDay = dayStepperInfo.date.getDate();

      return allItems.filter((item) => {
        const itemDate = parseItemDate(item.created_at);
        return (
          itemDate.getFullYear() === targetYear &&
          itemDate.getMonth() === targetMonth &&
          itemDate.getDate() === targetDay
        );
      });
    }

    if (timeframeFilter === "week") {
      const startMs = new Date(
        weekStepperInfo.start.getFullYear(),
        weekStepperInfo.start.getMonth(),
        weekStepperInfo.start.getDate()
      ).getTime();

      const endMs = new Date(
        weekStepperInfo.end.getFullYear(),
        weekStepperInfo.end.getMonth(),
        weekStepperInfo.end.getDate(),
        23,
        59,
        59,
        999
      ).getTime();

      return allItems.filter((item) => {
        const itemTime = parseItemDate(item.created_at).getTime();
        return itemTime >= startMs && itemTime <= endMs;
      });
    }

    if (timeframeFilter === "month") {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const monthAgo = new Date(todayStart);
      monthAgo.setDate(monthAgo.getDate() - 30);
      return allItems.filter((item) => parseItemDate(item.created_at) >= monthAgo);
    }

    return allItems;
  }, [historyData?.items, timeframeFilter, dayStepperInfo, weekStepperInfo]);

  // 2. Search Filter
  const searchFilteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return timeframeFilteredItems;
    return timeframeFilteredItems.filter((item) => {
      return (
        (item.target_role && item.target_role.toLowerCase().includes(q)) ||
        (item.target_company && item.target_company.toLowerCase().includes(q)) ||
        (item.filename && item.filename.toLowerCase().includes(q))
      );
    });
  }, [timeframeFilteredItems, searchQuery]);

  // 3. Sorting
  const sortedItems = useMemo(() => {
    const itemsCopy = [...searchFilteredItems];
    itemsCopy.sort((a, b) => {
      if (sortBy === "newest") {
        return parseItemDate(b.created_at).getTime() - parseItemDate(a.created_at).getTime();
      } else if (sortBy === "oldest") {
        return parseItemDate(a.created_at).getTime() - parseItemDate(b.created_at).getTime();
      } else if (sortBy === "score_high") {
        return (b.overall_score || 0) - (a.overall_score || 0);
      } else if (sortBy === "score_low") {
        return (a.overall_score || 0) - (b.overall_score || 0);
      } else if (sortBy === "role_az") {
        return (a.target_role || "").localeCompare(b.target_role || "");
      }
      return 0;
    });
    return itemsCopy;
  }, [searchFilteredItems, sortBy]);

  // 4. Pagination Calculation
  const totalPages = Math.max(1, Math.ceil(sortedItems.length / itemsPerPage));
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedItems, currentPage, itemsPerPage]);

  // 5. 7-Day Activity Bar Chart Data Calculation
  const activity7Days = useMemo(() => {
    const allItems = historyData?.items || [];
    const days: { label: string; dateStr: string; count: number; avgScore: number; dayOffset: number }[] = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const year = d.getFullYear();
      const month = d.getMonth();
      const day = d.getDate();

      const dayItems = allItems.filter((item) => {
        const itemDate = parseItemDate(item.created_at);
        return (
          itemDate.getFullYear() === year &&
          itemDate.getMonth() === month &&
          itemDate.getDate() === day
        );
      });

      const label =
        i === 0
          ? "Today"
          : i === 1
          ? "Yesterday"
          : d.toLocaleDateString(undefined, { weekday: "short" });

      const avgScore =
        dayItems.length > 0
          ? Math.round(
              dayItems.reduce((sum, item) => sum + (item.overall_score || 0), 0) / dayItems.length
            )
          : 0;

      days.push({
        label,
        dateStr: `${year}-${month + 1}-${day}`,
        count: dayItems.length,
        avgScore,
        dayOffset: -i,
      });
    }

    const maxCount = Math.max(...days.map((d) => d.count), 1);
    return { days, maxCount };
  }, [historyData?.items]);

  const daily = historyData?.summary?.daily_summary;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-teal-500/20 shrink-0">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Resume Tailoring Analytics & History
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track daily goals, view 7-day activity trends, and reload past sessions in 1-click.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowChart(!showChart)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer ${
                showChart
                  ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
              }`}
              title="Toggle Analytics Chart"
            >
              <BarChart2 className="h-4 w-4" />
              <span className="hidden xs:inline">{showChart ? "Hide Chart" : "Show Chart"}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-slate-200/60 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-600 dark:text-rose-400 font-medium">
              {error}
            </div>
          )}

          {/* 🎯 Daily Application Target Tracker & Goal Progress */}
          {daily && (
            <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-teal-200 dark:border-indigo-900/60 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white dark:from-indigo-950/40 dark:via-purple-950/20 dark:to-slate-900 space-y-3.5 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md shadow-teal-600/20 shrink-0">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-[#0F172A] dark:text-teal-300 flex items-center gap-2">
                      Daily Application Target
                      {daily.goal_achieved && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-bold flex items-center gap-1 shadow-xs">
                          <Trophy className="h-3 w-3" /> Goal Accomplished!
                        </span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
                      Today: <span className="font-bold text-teal-600 dark:text-teal-400">{daily.today_completed}</span> / {daily.daily_target} jobs tailored ({daily.progress_percentage}%)
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Resets daily at 12:00 AM (midnight) local time
                    </p>
                  </div>
                </div>

                {/* Target Selector Dropdown */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Target:</span>
                  <select
                    value={daily.daily_target}
                    disabled={isUpdatingTarget}
                    onChange={(e) => handleTargetChange(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-xl border border-teal-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-xs"
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

          {/* 📊 7-Day Activity & Match Score Analytics Bar Chart (Clickable Day Bars) */}
          {showChart && historyData && (
            <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 space-y-4 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-teal-500" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    7-Day Tailoring Activity & Match Trends (Click Bar to Filter Date)
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold">
                    <span className="h-2.5 w-2.5 rounded bg-teal-500 inline-block" /> Tailored Resumes
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-semibold">
                    <span className="h-2.5 w-2.5 rounded bg-emerald-500 inline-block" /> Avg Match %
                  </span>
                </div>
              </div>

              {/* Responsive SVG Bar Chart */}
              <div className="pt-2 pb-1">
                <div className="grid grid-cols-7 gap-2 items-end h-32 px-2 border-b border-slate-200 dark:border-slate-800">
                  {activity7Days.days.map((day, idx) => {
                    const barHeightPercent = day.count > 0 ? Math.max(20, Math.round((day.count / activity7Days.maxCount) * 100)) : 8;
                    const isSelectedDay = timeframeFilter === "day" && dayOffset === day.dayOffset;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setTimeframeFilter("day");
                          setDayOffset(day.dayOffset);
                        }}
                        className={`flex flex-col items-center h-full justify-end group relative cursor-pointer outline-none rounded-xl transition-all p-1 ${
                          isSelectedDay ? "ring-2 ring-teal-500 bg-teal-500/10" : ""
                        }`}
                      >
                        {/* Tooltip on Hover */}
                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-bold py-1 px-2 rounded-lg shadow-lg pointer-events-none whitespace-nowrap z-20">
                          {day.label}: {day.count} tailored {day.avgScore > 0 ? `(${day.avgScore}% avg)` : ""}
                        </div>

                        {/* Top Score Badge */}
                        {day.count > 0 && (
                          <span className="text-[10px] font-black text-teal-600 dark:text-teal-400 mb-1 group-hover:scale-110 transition-transform">
                            {day.count}
                          </span>
                        )}

                        {/* Bar Graphic */}
                        <div
                          className={`w-full max-w-[36px] rounded-t-xl transition-all duration-300 ${
                            isSelectedDay
                              ? "bg-gradient-to-t from-emerald-600 via-teal-500 to-indigo-500 shadow-lg scale-105"
                              : day.count > 0
                              ? "bg-gradient-to-t from-indigo-600 via-indigo-500 to-purple-500 group-hover:from-indigo-500 group-hover:to-emerald-400 shadow-md"
                              : "bg-slate-200/60 dark:bg-slate-800/50"
                          }`}
                          style={{ height: `${barHeightPercent}%` }}
                        />
                      </button>
                    );
                  })}
                </div>

                {/* Day Labels Row */}
                <div className="grid grid-cols-7 gap-2 text-center pt-2">
                  {activity7Days.days.map((day, idx) => (
                    <div key={idx} className="space-y-0.5">
                      <span className={`text-[11px] font-bold block truncate ${
                        timeframeFilter === "day" && dayOffset === day.dayOffset
                          ? "text-teal-600 dark:text-teal-400 font-extrabold"
                          : "text-slate-700 dark:text-slate-300"
                      }`}>
                        {day.label}
                      </span>
                      {day.avgScore > 0 ? (
                        <span className="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 block">
                          {day.avgScore}%
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400 block">-</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Aggregate Stats Summary Row */}
          {historyData?.summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                <span className="text-lg font-black text-teal-600 dark:text-teal-400">
                  {historyData.summary.daily_summary.today_completed}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-center">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  Shown Items
                </span>
                <span className="text-lg font-black text-purple-600 dark:text-purple-400">
                  {sortedItems.length}
                </span>
              </div>
            </div>
          )}

          {/* 🔍 Search, Timeframe Tabs & Sorting Toolbar */}
          <div className="space-y-3 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Timeframe Filter Tabs */}
              <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs shrink-0 overflow-x-auto">
                {(
                  [
                    { id: "all", label: "All History" },
                    { id: "day", label: "By Day" },
                    { id: "week", label: "By Week" },
                    { id: "month", label: "This Month" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTimeframeFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap ${
                      timeframeFilter === tab.id
                        ? "bg-white dark:bg-slate-800 text-teal-600 dark:text-teal-400 shadow-sm border border-slate-200/80 dark:border-slate-700"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Sorting & Search Inputs */}
              <div className="flex items-center gap-2 flex-1">
                {/* Search Bar */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search role, company, or file..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
                  />
                </div>

                {/* Sort Dropdown */}
                <div className="relative shrink-0">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer shadow-xs"
                  >
                    <option value="newest">📅 Newest First</option>
                    <option value="oldest">📅 Oldest First</option>
                    <option value="score_high">🏆 Highest Score</option>
                    <option value="score_low">📉 Lowest Score</option>
                    <option value="role_az">🔤 Job Title (A-Z)</option>
                  </select>
                </div>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={loadHistory}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-all cursor-pointer shadow-xs shrink-0"
                  title="Refresh history"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* 🗓️ Interactive Day Stepper Navigation Bar */}
            {timeframeFilter === "day" && (
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-teal-50/80 dark:bg-slate-900/40 border border-teal-200 dark:border-slate-800/80 text-xs shadow-xs animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => setDayOffset((prev) => prev - 1)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <ChevronLeft className="h-4 w-4 text-teal-500" />
                  <span>Prev Day</span>
                </button>

                <div className="text-center font-black text-[#0F172A] dark:text-teal-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-teal-500" />
                  <span>{dayStepperInfo.label}</span>
                  {dayOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => setDayOffset(0)}
                      className="text-[10px] px-2.5 py-0.5 rounded-full bg-teal-600 text-white font-bold hover:bg-teal-500 transition-all cursor-pointer ml-1 shadow-xs"
                    >
                      Reset to Today
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={dayOffset >= 0}
                  onClick={() => setDayOffset((prev) => Math.min(0, prev + 1))}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next Day</span>
                  <ChevronRight className="h-4 w-4 text-teal-500" />
                </button>
              </div>
            )}

            {/* 🗓️ Interactive Week Stepper Navigation Bar */}
            {timeframeFilter === "week" && (
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-purple-50/80 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/80 text-xs shadow-xs animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <ChevronLeft className="h-4 w-4 text-purple-500" />
                  <span>Prev Week</span>
                </button>

                <div className="text-center font-black text-purple-900 dark:text-purple-300 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-purple-500" />
                  <span>{weekStepperInfo.title}</span>
                  {weekOffset !== 0 && (
                    <button
                      type="button"
                      onClick={() => setWeekOffset(0)}
                      className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-600 text-white font-bold hover:bg-purple-500 transition-all cursor-pointer ml-1 shadow-xs"
                    >
                      Reset to This Week
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  disabled={weekOffset >= 0}
                  onClick={() => setWeekOffset((prev) => Math.min(0, prev + 1))}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next Week</span>
                  <ChevronRight className="h-4 w-4 text-purple-500" />
                </button>
              </div>
            )}
          </div>

          {/* History Items List */}
          {isLoading ? (
            <div className="p-12 text-center space-y-3">
              <div className="h-6 w-6 border-2 border-teal-600/30 border-t-indigo-600 rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-500">Loading analysis history...</p>
            </div>
          ) : paginatedItems.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/20 space-y-2">
              <History className="h-8 w-8 text-slate-400 mx-auto opacity-50" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {searchQuery || timeframeFilter !== "all"
                  ? `No history entries found for ${
                      timeframeFilter === "day"
                        ? dayStepperInfo.label
                        : timeframeFilter === "week"
                        ? weekStepperInfo.title
                        : "your selected filter"
                    }.`
                  : "No resume analysis history found yet."}
              </p>
              <p className="text-[11px] text-slate-400">
                Use the &lt; / &gt; buttons to switch dates or view All History!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedItems.map((item) => {
                const d = parseItemDate(item.created_at);
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
                    className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 hover:border-teal-400 dark:hover:border-teal-600 transition-all duration-150 space-y-3 shadow-sm group"
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
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            {dateStr}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <FileText className="h-3 w-3 shrink-0 text-slate-400" />
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
                          className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {loadingItemId === item.id ? (
                            <div className="h-3 w-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5 text-teal-200" />
                          )}
                          Open in Workspace
                        </button>

                        {/* Direct Download links if available */}
                        {item.download_id && (
                          <>
                            <a
                              href={`${API_BASE_URL}/api/v1/resume/download/${item.download_id}`}
                              download
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1 shadow-xs"
                              title="Download DOCX File"
                            >
                              <WordLogoIcon className="h-3.5 w-3.5" />
                              <span className="text-[10px] font-bold">DOCX</span>
                            </a>
                            <a
                              href={`${API_BASE_URL}/api/v1/resume/download/${item.download_id}/pdf`}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center gap-1 shadow-xs"
                              title="Download PDF File"
                            >
                              <PdfLogoIcon className="h-3.5 w-3.5" />
                              <span className="text-[10px] font-bold">PDF</span>
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

          {/* 📄 Pagination Bar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800 flex-wrap gap-2 text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-semibold">
                Page {currentPage} of {totalPages} ({sortedItems.length} total entries)
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`h-7 w-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        currentPage === p
                          ? "bg-teal-600 text-white shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 font-bold transition-all flex items-center gap-1 shadow-xs cursor-pointer"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
