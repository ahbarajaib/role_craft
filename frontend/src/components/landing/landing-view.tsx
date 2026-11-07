"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  LifeBuoy,
  Phone,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/auth_provider";
import { DailyGoalCard } from "@/components/daily_goal_card";
import FeaturesShowcase from "@/components/features_showcase";
import TestimonialsSection from "@/components/testimonials_section";
import FaqSection from "@/components/faq_section";
import AuthModal from "@/components/auth_modal";
import { ProfileModal } from "@/components/profile_modal";
import HistoryModal from "@/components/history_modal";
import SubscriptionModal from "@/components/subscription_modal";
import { MobileBottomNav } from "@/components/mobile_bottom_nav";
import IssueReportModal from "@/components/issue_report_modal";
import {
  fetchAnalysisHistory,
  updateDailyTarget,
  type DailyTargetSummary,
} from "@/lib/api";
import {
  FREE_TIER_CREDITS,
  PRO_CREDITS,
  ELITE_CREDITS,
} from "@/lib/constants";

export function LandingView() {
  const router = useRouter();
  const { user, token, logout, setShowAuthModal, refreshMe } = useAuth();

  const [dailyGoal, setDailyGoal] = useState<DailyTargetSummary | null>(null);
  const [showDailyGoalBanner, setShowDailyGoalBanner] = useState<boolean>(true);
  const [isUpdatingDailyTarget, setIsUpdatingDailyTarget] = useState<boolean>(false);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportCategory, setReportCategory] = useState<
    "bug" | "formatting" | "ai_quality" | "payment" | "feature_request" | "general"
  >("general");

  // Scroll navbar glass
  const [navScrolled, setNavScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 28);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll reveal observer
  useEffect(() => {
    const els = document.querySelectorAll(".reveal-on-scroll");
    const obs = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("visible");
            obs.unobserve(e.target);
          }
        }),
      { threshold: 0.12 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  // Stat count-up when section enters view
  const [statsVisible, setStatsVisible] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!statsRef.current) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStatsVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  // Daily goal fetch
  useEffect(() => {
    if (token) {
      fetchAnalysisHistory()
        .then((data) => setDailyGoal(data.summary.daily_summary))
        .catch((err) => console.error("Failed to fetch daily goal:", err));
    } else {
      setDailyGoal(null);
    }
  }, [token]);

  const handleQuickUpdateTarget = async (newTarget: number) => {
    if (newTarget < 1 || newTarget > 50 || isUpdatingDailyTarget) return;
    setIsUpdatingDailyTarget(true);
    try {
      const updated = await updateDailyTarget(newTarget);
      setDailyGoal(updated);
    } catch (err) {
      console.error("Failed to update daily target:", err);
    } finally {
      setIsUpdatingDailyTarget(false);
    }
  };

  const toggleDailyGoalBanner = () => {
    setShowDailyGoalBanner((prev) => !prev);
  };

  const openWorkspace = () => {
    router.push("/workspace");
  };

  return (
    <div className="relative min-h-screen text-slate-900 dark:text-slate-100 bg-[#F8FAFC] dark:bg-[#0B0F19] p-3 sm:p-6 lg:p-12 overflow-x-hidden">
      {/* Decorative Glow Orbs */}
      <div className="glow-effect bg-teal-500 w-[600px] h-[600px] -top-48 -left-48 orb-drift-1" style={{ opacity: 0.05 }} />
      <div className="glow-effect bg-violet-400 w-[440px] h-[440px] top-[38%] -right-24 orb-drift-2" style={{ opacity: 0.04 }} />
      <div className="glow-effect bg-blue-400 w-[360px] h-[360px] top-[22%] right-[28%] orb-drift-3" style={{ opacity: 0.03 }} />
      <div className="glow-effect bg-[#FF6B4A] w-[300px] h-[300px] top-[70%] left-[20%] orb-drift-1" style={{ opacity: 0.03 }} />

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header
        className={`sticky top-0 z-30 max-w-full mx-auto flex items-center justify-between gap-2 mb-6 sm:mb-12 pb-4 border-b transition-all duration-300 px-3 sm:px-6 lg:px-12 -mx-3 sm:-mx-6 lg:-mx-12 ${
          navScrolled
            ? "bg-white/85 backdrop-blur-xl border-slate-200/90 shadow-sm shadow-teal-500/5"
            : "border-slate-200/80 bg-transparent"
        }`}
      >
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 cursor-pointer group shrink-0">
          <div className="relative shrink-0 flex items-center justify-center">
            <img
              src="/logo.svg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/logo.png";
              }}
              alt="RoleCraft Logo"
              className="h-9 w-9 sm:h-10 sm:w-10 object-contain transition-transform group-hover:scale-105"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black tracking-tight leading-none flex items-center">
              <span className="text-[#0F172A]">Role</span>
              <span className="text-[#14B8A6]">Craft</span>
            </h1>
            <p className="hidden sm:block text-[10px] text-slate-500 font-extrabold tracking-wider uppercase truncate mt-0.5">
              TAILOR. MATCH. GET HIRED.
            </p>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-0.5 text-xs font-bold text-slate-600">
          {[
            { label: "Features", href: "#features" },
            { label: "How It Works", href: "#how-it-works" },
            { label: "Pricing", href: "#pricing" },
            { label: "FAQ", href: "#faq" },
          ].map(({ label, href }) => (
            <a
              key={label}
              href={href}
              className="relative px-3.5 py-2 rounded-lg text-slate-600 hover:text-teal-700 transition-colors cursor-pointer whitespace-nowrap group/nav"
            >
              {label}
              <span className="absolute bottom-1 left-3.5 right-3.5 h-0.5 bg-gradient-to-r from-teal-500 to-[#14B8A6] rounded-full scale-x-0 group-hover/nav:scale-x-100 transition-transform origin-left duration-200" />
            </a>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Link
            href="/resume-builder"
            className="hidden lg:flex items-center justify-center gap-1.5 px-3.5 h-10 rounded-full text-xs font-bold bg-white hover:bg-teal-50 text-teal-700 border border-teal-200 hover:border-teal-400 shadow-sm transition-all cursor-pointer"
            title="Create & Edit Structured Resume with ATS Templates"
          >
            <Sparkles className="h-3.5 w-3.5 text-teal-500 shrink-0" />
            <span>Resume Builder</span>
          </Link>

          <button
            type="button"
            onClick={openWorkspace}
            className="hidden lg:flex items-center justify-center gap-1.5 px-3.5 h-10 !rounded-full text-xs font-black transition-all cursor-pointer shadow-xs btn-primary"
          >
            <Sparkles className="h-3.5 w-3.5 text-[#FF6B4A] shrink-0" />
            <span>⚡ Workspace</span>
          </button>

          {/* Daily Goal Quick Progress Pill */}
          {user && dailyGoal && (
            <button
              type="button"
              onClick={() => setIsHistoryModalOpen(true)}
              className={`touch-target flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 h-10 rounded-full border text-xs font-bold transition-all cursor-pointer shadow-2xs hover:scale-105 select-none ${
                dailyGoal.goal_achieved
                  ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 ring-1 ring-emerald-500/20"
                  : "bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-800 border-slate-200 hover:border-teal-300"
              }`}
            >
              <span className="text-xs sm:text-sm leading-none">{dailyGoal.goal_achieved ? "🎉" : "🎯"}</span>
              <span className="font-extrabold text-[11px] text-slate-900 dark:text-slate-100">
                {dailyGoal.today_completed}/{dailyGoal.daily_target}
              </span>
            </button>
          )}

          {/* User Auth Area */}
          {user ? (
            <div className="relative z-40">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="touch-target flex items-center justify-center gap-1.5 sm:gap-2 bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 px-2.5 sm:px-3 h-10 rounded-full border border-slate-200 dark:border-slate-800 shadow-sm text-xs transition-all cursor-pointer select-none"
              >
                <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 shadow-sm">
                  {(user.name || user.email)[0].toUpperCase()}
                </div>
                <span className="hidden sm:inline font-bold text-slate-800 dark:text-slate-200 max-w-[120px] truncate">
                  {user.name || user.email.split("@")[0]}
                </span>
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-extrabold text-[10px] border border-emerald-500/20 whitespace-nowrap">
                  {user.credits} CR
                </span>
                <ChevronDown className={`hidden sm:block h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${isProfileMenuOpen ? "rotate-180" : ""}`} />
              </button>

              {isProfileMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsProfileMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-50 space-y-2">
                    <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.name || "User"}</p>
                      <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        openWorkspace();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-bold text-teal-700 hover:bg-teal-50 flex items-center justify-between"
                    >
                      <span>⚡ Open Workspace</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Profile &amp; Settings
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsSubscriptionModalOpen(true);
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Subscription &amp; Credits
                    </button>
                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        logout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-4 py-2 rounded-full text-xs font-black btn-primary"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* ── LANDING CONTENT ─────────────────────────────────────────────────── */}
      <div className="relative max-w-[1440px] mx-auto space-y-12 sm:space-y-16 py-2 sm:py-4 animate-fade-in">
        {/* Prominent Daily Goal Focus Card */}
        {user && dailyGoal && showDailyGoalBanner && (
          <DailyGoalCard
            dailyGoal={dailyGoal}
            onUpdateTarget={handleQuickUpdateTarget}
            isUpdatingTarget={isUpdatingDailyTarget}
            onOpenHistory={() => setIsHistoryModalOpen(true)}
            onHide={toggleDailyGoalBanner}
          />
        )}

        {/* HERO 2-COLUMN SECTION */}
        <section className="space-y-12 pt-2 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            {/* Left Column: Headline & Action CTAs */}
            <div className="lg:col-span-6 space-y-6 lg:space-y-7 text-left">
              <div className="relative inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50/90 border border-teal-200/80 text-teal-700 font-extrabold text-[10px] sm:text-[11px] uppercase tracking-wider shadow-2xs overflow-hidden">
                <span className="absolute inset-0 ai-badge-shimmer pointer-events-none" />
                <Sparkles className="h-3.5 w-3.5 text-teal-600 animate-pulse" />
                <span>Built for Indian professionals switching companies</span>
              </div>

              <h1 className="text-4xl sm:text-5xl xl:text-6xl font-black text-slate-900 tracking-tight leading-[1.12]">
                Tailor Your Resume<br />
                to Any Role in{" "}
                <span
                  className="bg-gradient-to-r from-teal-500 via-cyan-500 to-violet-500 bg-clip-text text-transparent"
                  style={{ backgroundSize: "200% auto", animation: "shimmer-text 4s linear infinite" }}
                >
                  1&#8209;Click
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 font-medium leading-relaxed max-w-xl">
                Paste any job description. RoleCraft rewrites only the right sections of your resume — keywords, tone,
                relevance — without touching your formatting.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  onClick={openWorkspace}
                  className="px-7 py-3.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white font-extrabold text-sm shadow-lg shadow-teal-600/30 transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Zap className="h-4 w-4 text-amber-300" />
                  <span>Tailor My Resume Free →</span>
                </button>
                <a
                  href="#how-it-works"
                  className="px-5 py-3.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer hover:border-slate-300"
                >
                  <span>See How It Works</span>
                  <span className="text-[10px] text-slate-700">▶</span>
                </a>
              </div>

              {/* Hero Social Proof */}
              <div className="flex flex-col gap-2 pt-1">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-2.5">
                    {[
                      { initials: "RS", from: "#0F172A", to: "#14B8A6" },
                      { initials: "PN", from: "#4F46E5", to: "#7C3AED" },
                      { initials: "AV", from: "#0EA5E9", to: "#06B6D4" },
                      { initials: "KM", from: "#0F766E", to: "#059669" },
                    ].map((u, idx) => (
                      <div
                        key={idx}
                        className="h-7 w-7 rounded-full border-2 border-white flex items-center justify-center text-[10px] font-black text-white shadow-sm"
                        style={{ background: `linear-gradient(135deg, ${u.from}, ${u.to})` }}
                      >
                        {u.initials}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="flex items-center gap-0.5">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-xs font-extrabold text-slate-800">4.9</span>
                    <span className="text-xs text-slate-400 font-medium">from early adopters</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 font-medium italic pl-0.5">
                  <span className="text-teal-600 font-black not-italic">&ldquo;</span>
                  Got 4 interview callbacks in my first week.
                  <span className="text-teal-600 font-black not-italic">&rdquo;</span>
                  <span className="text-slate-400 not-italic font-semibold ml-1.5">— Rohan S., SWE</span>
                </p>
              </div>
            </div>

            {/* Right Column: Hero Preview */}
            <div className="hidden lg:block lg:col-span-6 relative">
              <div className="relative rounded-3xl bg-white/95 border border-slate-200 shadow-2xl p-5 sm:p-7 backdrop-blur-md">
                <div className="space-y-3.5 text-left text-slate-800">
                  <div className="space-y-0.5">
                    <h3 className="text-base font-black text-slate-900">Rahul Sharma</h3>
                    <p className="text-[11px] font-semibold text-slate-500">Senior Full Stack Engineer, 6 yrs exp</p>
                  </div>
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">Professional Summary</span>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Accomplished Full Stack Developer with 6+ years of experience architecting resilient distributed cloud systems and AI-powered workflow automation.
                    </p>
                  </div>
                  <div className="space-y-1 pt-1 border-t border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-600">Technical Skills</span>
                    <div className="text-[10px] space-y-0.5 text-slate-600 font-medium">
                      <div><strong className="text-slate-800">Languages:</strong> JavaScript, TypeScript, Python, SQL</div>
                      <div><strong className="text-slate-800">Frameworks:</strong> React, Next.js, Node.js, FastAPI</div>
                    </div>
                  </div>
                </div>

                {/* Floating ATS Match Score Badge */}
                <div className="absolute top-4 right-4 sm:-right-4 w-48 sm:w-52 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xl space-y-2 z-20">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ATS Match Score</div>
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-3xl font-black text-emerald-600 tracking-tight">98%</span>
                    <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Excellent Match
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Live Trust Metrics Row */}
          <div ref={statsRef} className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-md">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className={`text-2xl font-black text-slate-900 leading-tight ${statsVisible ? "stat-number-in" : "opacity-0"}`}>60 sec</div>
                <div className="text-xs font-semibold text-slate-500">To tailor per job</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-md">
                <Phone className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className={`text-2xl font-black text-slate-900 leading-tight ${statsVisible ? "stat-number-in" : "opacity-0"}`}>0 hrs</div>
                <div className="text-xs font-semibold text-slate-500">Wasted manual rewrites</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md">
                <Zap className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className={`text-2xl font-black text-slate-900 leading-tight ${statsVisible ? "stat-number-in" : "opacity-0"}`}>&lt;15s</div>
                <div className="text-xs font-semibold text-slate-500">Full 1-Click Tailor</div>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-md">
                <Shield className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className={`text-2xl font-black text-slate-900 leading-tight ${statsVisible ? "stat-number-in" : "opacity-0"}`}>100%</div>
                <div className="text-xs font-semibold text-slate-500">DOCX Layout Integrity</div>
              </div>
            </div>
          </div>
        </section>

        {/* FOUNDER STORY + WHO IS THIS FOR */}
        <section className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 reveal-on-scroll">
          <div className="rounded-3xl border border-teal-100 bg-gradient-to-br from-teal-50/80 to-white p-7 flex flex-col justify-between space-y-5 shadow-sm">
            <div className="space-y-3">
              <span className="text-[10px] font-black uppercase tracking-widest text-teal-600">Why I Built This</span>
              <p className="text-base sm:text-lg font-semibold text-slate-800 leading-relaxed">
                &ldquo;I was applying to jobs and spending 2+ hours rewriting my resume for every application. If I sent the same resume everywhere, I heard nothing back. So I built RoleCraft — paste the job description and it updates your resume in under 60 seconds, without touching the formatting.&rdquo;
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-teal-600 flex items-center justify-center text-white font-black text-sm shrink-0">A</div>
              <div>
                <div className="text-sm font-bold text-slate-900">Ahbar</div>
                <div className="text-xs text-slate-500">Founder, RoleCraft</div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-7 space-y-5 shadow-sm">
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Who Is This For?</span>
              <h3 className="text-lg font-black text-slate-900">RoleCraft is built for you if&hellip;</h3>
            </div>
            <ul className="space-y-3">
              <li className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                <span className="text-sm text-slate-700 font-medium">You have 2–10+ years of experience and are switching companies</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                <span className="text-sm text-slate-700 font-medium">You&apos;re applying to 5+ jobs a week and can&apos;t manually rewrite your resume each time</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">✓</span>
                <span className="text-sm text-slate-700 font-medium">You&apos;ve sent 50 applications and gotten 2 callbacks — and you know your resume is the problem</span>
              </li>
            </ul>
          </div>
        </section>

        {/* HOW IT WORKS SECTION */}
        <section id="how-it-works" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <div className="section-eyebrow">
              <Sparkles className="h-3 w-3 text-teal-600" />
              <span>Simple. Fast. Effective.</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              How RoleCraft Works in 3 Simple Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {/* Step 1 */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="px-3 py-1 rounded-full bg-[#E6F7F4] text-teal-800 font-black text-xs">Step 01</span>
                <div>
                  <h3 className="text-lg font-black text-[#0F172A]">Upload Base Resume</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                    Upload your Word (.docx) or PDF resume. RoleCraft parses XML tags to preserve all fonts, layouts, and styles.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="rounded-3xl border border-teal-300/60 bg-white p-6 shadow-md flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="px-3 py-1 rounded-full bg-[#E6F7F4] text-teal-800 font-black text-xs">Step 02</span>
                <div>
                  <h3 className="text-lg font-black text-[#0F172A]">Extract Competencies</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                    Paste the target job description. The AI extracts core requirements, priority ATS keywords, and missing gaps.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="px-3 py-1 rounded-full bg-[#E6F7F4] text-teal-800 font-black text-xs">Step 03</span>
                <div>
                  <h3 className="text-lg font-black text-[#0F172A]">1-Click Tailor &amp; Download</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed mt-1">
                    Click &quot;Auto-Tailor&quot; to update your resume sections to match the job description and download the file instantly.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KEY CAPABILITIES */}
        <section id="features" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Everything You Need to Get More Interviews
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium">
              Simple tools that do the hard work of tailoring your resume, so you don&apos;t have to.
            </p>
          </div>
          <FeaturesShowcase />
        </section>

        {/* TESTIMONIALS */}
        <section className="space-y-8">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              What People Are Saying
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium">
              Early feedback from professionals who tried RoleCraft.
            </p>
          </div>
          <TestimonialsSection />
        </section>

        {/* PRICING */}
        <section id="pricing" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Transparent Monthly Plans
            </h2>
            <p className="text-sm sm:text-base text-slate-600 font-medium">
              Choose the tier that fits your job search pace. Upgrade or cancel anytime.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {/* Free */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Free Tier</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black text-slate-900">₹0</span>
                  <span className="text-xs text-slate-400 font-semibold">/ forever</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600 font-medium pt-4 border-t border-slate-100">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong className="text-slate-800">{FREE_TIER_CREDITS} Credits</strong> / Month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Standard AI Resume Analysis</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Basic Keyword Matching</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={openWorkspace}
                className="w-full py-3 rounded-xl bg-[#E6F7F4] hover:bg-[#ccfbf1] text-teal-900 font-bold text-xs transition-all cursor-pointer border border-[#99F6E4]"
              >
                Start Free
              </button>
            </div>

            {/* Pro */}
            <div className="pricing-popular rounded-3xl p-6 sm:p-7 flex flex-col justify-between space-y-6 relative border-2 border-teal-500">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-gradient-to-r from-teal-600 to-teal-500 text-white font-extrabold text-[10px] uppercase tracking-widest shadow-lg whitespace-nowrap">
                ✦ Most Popular
              </div>
              <div className="space-y-4">
                <span className="text-xs font-black uppercase text-teal-700 tracking-widest">Pro Plan</span>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-4xl font-black text-slate-900">₹399</span>
                  <span className="text-xs text-slate-500 font-semibold">/ month</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-700 font-medium pt-4 border-t border-teal-200/60">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong className="text-slate-900">{PRO_CREDITS} Credits</strong> / Month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>1-Click Full Resume Auto-Tailor</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>AI-powered bullet point rewriter</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>100% DOCX &amp; PDF Downloads</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setIsSubscriptionModalOpen(true)}
                className="w-full py-3.5 rounded-xl btn-primary text-xs cursor-pointer"
              >
                Upgrade to Pro Plan
              </button>
            </div>

            {/* Elite */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-7 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <span className="text-xs font-black uppercase text-teal-700 tracking-widest">Elite Plan</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-slate-900">₹599</span>
                  <span className="text-xs text-slate-500 font-semibold">/ month</span>
                </div>
                <ul className="space-y-2.5 text-xs text-slate-600 font-medium pt-4 border-t border-slate-100">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span><strong className="text-slate-900">{ELITE_CREDITS} Credits</strong> / Month</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Everything in Pro Plan</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>LinkedIn, Bayt &amp; Naukri Copier Extensions</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => setIsSubscriptionModalOpen(true)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#0F172A] via-teal-800 to-[#14B8A6] text-white font-bold text-xs shadow-sm cursor-pointer"
              >
                Upgrade to Elite Plan
              </button>
            </div>
          </div>
        </section>

        {/* HIGH-IMPACT FINAL CTA BANNER */}
        <section className="relative overflow-hidden rounded-3xl p-8 sm:p-14 cta-dark shadow-2xl max-w-5xl mx-auto text-center space-y-6 reveal-on-scroll">
          <div className="relative z-10 space-y-3 max-w-2xl mx-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-teal-300 text-[11px] font-black uppercase tracking-wider backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-[#FF6B4A]" />
              <span>Start In 15 Seconds</span>
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Stop Sending the Same Resume to Every Job
            </h2>
            <p className="text-sm sm:text-base text-slate-300 font-medium leading-relaxed">
              Join professionals across India tailoring smarter. Upload your resume and try it free in under a minute.
            </p>
          </div>

          <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
            <button
              type="button"
              onClick={openWorkspace}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white font-black text-sm shadow-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="h-4 w-4 text-white" />
              <span>⚡ Tailor My Resume Free</span>
            </button>
            <Link
              href="/resume-builder"
              className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-sm border border-white/20 backdrop-blur-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Open Resume Builder</span>
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="space-y-8 scroll-mt-24">
          <div className="text-center space-y-3 max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              Frequently Asked Questions
            </h2>
          </div>
          <FaqSection />
        </section>

        {/* FOOTER */}
        <footer className="pt-12 pb-8 text-center space-y-6">
          <div className="gradient-divider mb-8" />
          <div className="flex items-center justify-center gap-3">
            <img
              src="/logo.svg"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = "/logo.png";
              }}
              alt="RoleCraft Logo"
              className="h-9 w-9 object-contain"
            />
            <span className="text-lg font-black text-gradient">RoleCraft</span>
          </div>
          <p className="text-xs text-slate-500 font-medium max-w-md mx-auto">
            Craft every resume for the role. Recruiter-grade AI tailoring with 100% visual DOCX formatting preservation.
          </p>
          <div className="flex items-center justify-center gap-6 text-xs font-semibold text-slate-500 flex-wrap">
            <a href="#how-it-works" className="hover:text-teal-600 transition-colors">How It Works</a>
            <Link href="/guide" className="hover:text-teal-600 transition-colors font-bold text-teal-700">Official Guide</Link>
            <a href="#features" className="hover:text-teal-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-teal-600 transition-colors">Pricing</a>
            <button onClick={openWorkspace} className="hover:text-teal-600 transition-colors cursor-pointer">Workspace</button>
            <button
              onClick={() => {
                setReportCategory("general");
                setIsReportModalOpen(true);
              }}
              className="hover:text-teal-600 transition-colors cursor-pointer flex items-center gap-1"
            >
              <LifeBuoy className="h-3 w-3" />
              <span>Report Issue / Feedback</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 font-medium pt-2">
            © 2026 RoleCraft Inc. All rights reserved. Built for job seekers worldwide.
          </p>
        </footer>
      </div>

      {/* Modals for Landing */}
      <AuthModal />
      {user && (
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          user={user}
          token={token}
          onProfileUpdated={() => {
            if (refreshMe) refreshMe();
          }}
        />
      )}
      <HistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        onRestoreSession={() => openWorkspace()}
      />
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        initialReason="general"
      />
      <IssueReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialCategory={reportCategory}
        activeDocumentId={user?.base_resume_id || null}
      />

      <MobileBottomNav
        activeNavTab="landing"
        onSelectNavTab={(tab) => {
          if (tab === "workspace") openWorkspace();
        }}
        onOpenGoals={() => {
          if (!token) setShowAuthModal(true);
          else setIsHistoryModalOpen(true);
        }}
        onOpenProfile={() => {
          if (!token) setShowAuthModal(true);
          else setIsProfileMenuOpen(true);
        }}
        user={user}
        dailyGoal={dailyGoal}
      />
    </div>
  );
}
