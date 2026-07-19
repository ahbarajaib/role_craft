import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { searchAndScoreJobs, JobSearchRequest, ScoredJob } from "@/lib/jobs_api";
import { Search, MapPin, Briefcase, ExternalLink, X, Loader2, Sparkles } from "lucide-react";

interface JobSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
}

export default function JobSearchModal({ isOpen, onClose, documentId }: JobSearchModalProps) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");

  const searchMutation = useMutation({
    mutationFn: (request: JobSearchRequest) => searchAndScoreJobs(request),
  });

  if (!isOpen) return null;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query || !location) return;

    searchMutation.mutate({
      document_id: documentId,
      query,
      location,
      limit: 5
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Search className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-white">Find & Score Jobs</h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3 mb-6 shrink-0">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Briefcase className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="Job title, keywords, or company"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin className="h-4 w-4 text-slate-500" />
              </div>
              <input
                type="text"
                placeholder="City, state, or 'Remote'"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={searchMutation.isPending || !query || !location}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900/40 text-white disabled:text-indigo-300 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {searchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search Jobs
            </button>
          </form>

          {/* Results Area */}
          <div className="space-y-4">
            {searchMutation.isPending && (
              <div className="text-center py-10 space-y-3">
                <div className="inline-block p-4 rounded-full bg-indigo-500/10">
                  <Loader2 className="h-8 w-8 text-indigo-400 animate-spin" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Scraping jobs and running AI ATS scoring...</p>
              </div>
            )}

            {searchMutation.isError && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                Failed to search jobs. {(searchMutation.error as Error).message}
              </div>
            )}

            {searchMutation.isSuccess && searchMutation.data.jobs.length === 0 && (
              <div className="text-center py-10 text-slate-400 text-sm">
                No jobs found matching your criteria. Try adjusting your search.
              </div>
            )}

            {searchMutation.isSuccess && searchMutation.data.jobs.length > 0 && (
              <div className="space-y-4">
                {searchMutation.data.jobs.map((job, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-slate-700 transition-colors flex gap-4">

                    {/* Score Circle */}
                    <div className="shrink-0 flex flex-col items-center justify-center w-16">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center border-2 font-bold text-lg
                        ${job.score >= 80 ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' :
                          job.score >= 50 ? 'border-amber-500 text-amber-400 bg-amber-500/10' :
                          'border-rose-500 text-rose-400 bg-rose-500/10'}`}
                      >
                        {job.score}
                      </div>
                      <span className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Match</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-white truncate pr-4">{job.title}</h3>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                        <span className="font-semibold text-slate-300">{job.company}</span>
                        {job.location && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                            <span>{job.location}</span>
                          </>
                        )}
                      </div>

                      <div className="mt-3 text-sm text-slate-400 line-clamp-2 italic">
                        "{job.snippet}"
                      </div>

                      <div className="mt-3 p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-2">
                        <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-indigo-200/80 leading-relaxed">
                          <strong className="text-indigo-300 mr-1">AI Rationale:</strong>
                          {job.rationale}
                        </p>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="shrink-0 pt-1">
                      <a
                        href={job.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 inline-flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                        title="Open Application"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
