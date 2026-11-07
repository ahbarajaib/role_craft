import { create } from "zustand";
import type { ResumeAnalysisResult } from "@/lib/api";
import type { StructuredResume, TailorResponse } from "@/lib/structured_resume_api";

export type DiffViewMode = "tailored" | "split";
export type KeywordFilterTab = "all" | "matched" | "supported" | "missing";
export type ReportCategory = "bug" | "formatting" | "ai_quality" | "payment" | "feature_request" | "general";

export interface WorkspaceState {
  // Document and JD
  file: File | null;
  documentId: string | null;
  guestResumeText: string | null;
  guestMode: boolean;
  isRunningGuestAnalysis: boolean;
  jobDescription: string;
  customTargetRole: string;
  targetRoleDraft: string;
  isEditingTargetRole: boolean;

  // Analysis Result
  analysisResult: ResumeAnalysisResult | null;
  error: string | null;
  successNotification: string | null;

  // Rewrites & Tailoring
  rewrittenSections: Record<string, string>;
  previousRewrittenSections: Record<string, string>;
  appliedWovenKeywords: string[];
  isKeywordsWoven: boolean;
  manuallyRemovedSkills: string[];
  excludedBullets: Record<string, number[]>;
  tailoringSectionToggles: Record<string, boolean>;

  // Diff & Patching
  diffViewMode: DiffViewMode;
  diffModeActive: boolean;
  downloadId: string | null;
  downloadUrl: string | null;
  isPatchingApplied: boolean;

  // Cover Letter
  coverLetterText: string | null;
  coverLetterDownloadId: string | null;
  isGeneratingCoverLetter: boolean;
  isUpdatingCoverLetter: boolean;
  isEditingCoverLetter: boolean;

  // Master & Structured Resume
  baseResumeLoaded: boolean;
  isSavingBase: boolean;
  masterResume: StructuredResume | null;
  tailorResult: TailorResponse | null;

  // Section Rewrite Modal
  isRewriteModalOpen: boolean;
  activeRewriteSection: string | null;
  rewriteData: any | null;
  draftRewrittenText: string;
  userInstructions: string;
  modalPositioningMode: string;
  metricPercentage: string;
  metricScale: string;

  // Modals & Panels
  isSubscriptionModalOpen: boolean;
  subscriptionModalReason: "out_of_credits" | "general";
  subscriptionInitialPlan: "pro" | "elite";
  isAutoTailoring: boolean;
  autoTailorStepIndex: number | undefined;
  autoTailorProgress: number | undefined;
  autoTailorComplete: boolean;
  isAutoTailorSettingsOpen: boolean;
  isKeywordWeaveModalOpen: boolean;
  keywordsForWeaveModal: { kw: string; type: "missing" | "supported" }[];
  selectedKeywordsToWeave: string[];
  isPdfPreviewOpen: boolean;
  isProfileModalOpen: boolean;
  isProfileMenuOpen: boolean;
  isHistoryModalOpen: boolean;
  isCompletionModalOpen: boolean;
  isTailorPreviewOpen: boolean;
  isReportModalOpen: boolean;
  reportCategory: ReportCategory;
  reportInitialError: string | null;

  // Workspace UI flags
  isCartOpen: boolean;
  isBottomBarVisible: boolean;
  showDetailedInsights: boolean;
  keywordFilterTab: KeywordFilterTab;
  keywordSearchQuery: string;
  expandedSections: Record<string, boolean>;
  expandedImprovements: Record<string, boolean>;
  inlineLoadingSections: Record<string, boolean>;
  isImprovingAll: boolean;
  isWeavingKeywords: boolean;

  // Actions
  setFile: (file: File | null) => void;
  setDocumentId: (id: string | null) => void;
  setGuestResumeText: (text: string | null) => void;
  setGuestMode: (mode: boolean) => void;
  setIsRunningGuestAnalysis: (running: boolean) => void;
  setJobDescription: (jd: string) => void;
  setCustomTargetRole: (role: string) => void;
  setTargetRoleDraft: (draft: string) => void;
  setIsEditingTargetRole: (editing: boolean) => void;
  setAnalysisResult: (result: ResumeAnalysisResult | null) => void;
  setError: (error: string | null) => void;
  setSuccessNotification: (msg: string | null) => void;

  setRewrittenSections: (sections: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setPreviousRewrittenSections: (sections: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  setAppliedWovenKeywords: (keywords: string[] | ((prev: string[]) => string[])) => void;
  setIsKeywordsWoven: (woven: boolean) => void;
  toggleManuallyRemovedSkill: (skill: string) => void;
  setExcludedBulletsForSection: (section: string, excluded: number[]) => void;
  setTailoringSectionToggles: (toggles: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;

  setDiffViewMode: (mode: DiffViewMode) => void;
  setDiffModeActive: (active: boolean) => void;
  setDownloadId: (id: string | null) => void;
  setDownloadUrl: (url: string | null) => void;
  setIsPatchingApplied: (applied: boolean) => void;

  setCoverLetterText: (text: string | null) => void;
  setCoverLetterDownloadId: (id: string | null) => void;
  setIsGeneratingCoverLetter: (generating: boolean) => void;
  setIsUpdatingCoverLetter: (updating: boolean) => void;
  setIsEditingCoverLetter: (editing: boolean) => void;

  setBaseResumeLoaded: (loaded: boolean) => void;
  setIsSavingBase: (saving: boolean) => void;
  setMasterResume: (resume: StructuredResume | null) => void;
  setTailorResult: (tailor: TailorResponse | null) => void;

  setIsRewriteModalOpen: (open: boolean) => void;
  setActiveRewriteSection: (section: string | null) => void;
  setRewriteData: (data: any | null) => void;
  setDraftRewrittenText: (text: string) => void;
  setUserInstructions: (instructions: string) => void;
  setModalPositioningMode: (mode: string) => void;
  setMetricPercentage: (val: string) => void;
  setMetricScale: (val: string) => void;

  openUpgradeModal: (reason?: "out_of_credits" | "general", plan?: "pro" | "elite") => void;
  closeUpgradeModal: () => void;

  setIsAutoTailoring: (tailoring: boolean) => void;
  setAutoTailorStepIndex: (idx: number | undefined) => void;
  setAutoTailorProgress: (progress: number | undefined) => void;
  setAutoTailorComplete: (complete: boolean) => void;
  setIsAutoTailorSettingsOpen: (open: boolean) => void;

  setIsKeywordWeaveModalOpen: (open: boolean) => void;
  setKeywordsForWeaveModal: (keywords: { kw: string; type: "missing" | "supported" }[]) => void;
  setSelectedKeywordsToWeave: (keywords: string[]) => void;
  toggleKeywordToWeave: (kw: string) => void;

  setIsPdfPreviewOpen: (open: boolean) => void;
  setIsProfileModalOpen: (open: boolean) => void;
  setIsProfileMenuOpen: (open: boolean) => void;
  setIsHistoryModalOpen: (open: boolean) => void;
  setIsCompletionModalOpen: (open: boolean) => void;
  setIsTailorPreviewOpen: (open: boolean) => void;

  openIssueReport: (category?: ReportCategory, errorContext?: string | null) => void;
  closeIssueReport: () => void;

  setIsCartOpen: (open: boolean) => void;
  setIsBottomBarVisible: (visible: boolean) => void;
  setShowDetailedInsights: (show: boolean) => void;
  setKeywordFilterTab: (tab: KeywordFilterTab) => void;
  setKeywordSearchQuery: (query: string) => void;

  toggleExpandedSection: (sectionName: string) => void;
  toggleExpandedImprovement: (improvementKey: string) => void;
  setInlineLoadingSection: (sectionName: string, loading: boolean) => void;
  setIsImprovingAll: (improving: boolean) => void;
  setIsWeavingKeywords: (weaving: boolean) => void;

  resetWorkspace: () => void;
  restoreFromSession: (saved: Partial<WorkspaceState>) => void;
}

const initialWorkspaceState = {
  file: null,
  documentId: null,
  guestResumeText: null,
  guestMode: false,
  isRunningGuestAnalysis: false,
  jobDescription: "",
  customTargetRole: "",
  targetRoleDraft: "",
  isEditingTargetRole: false,

  analysisResult: null,
  error: null,
  successNotification: null,

  rewrittenSections: {},
  previousRewrittenSections: {},
  appliedWovenKeywords: [],
  isKeywordsWoven: false,
  manuallyRemovedSkills: [],
  excludedBullets: {},
  tailoringSectionToggles: {},

  diffViewMode: "tailored" as DiffViewMode,
  diffModeActive: false,
  downloadId: null,
  downloadUrl: null,
  isPatchingApplied: false,

  coverLetterText: null,
  coverLetterDownloadId: null,
  isGeneratingCoverLetter: false,
  isUpdatingCoverLetter: false,
  isEditingCoverLetter: false,

  baseResumeLoaded: false,
  isSavingBase: false,
  masterResume: null,
  tailorResult: null,

  isRewriteModalOpen: false,
  activeRewriteSection: null,
  rewriteData: null,
  draftRewrittenText: "",
  userInstructions: "",
  modalPositioningMode: "team_lead_transition",
  metricPercentage: "",
  metricScale: "",

  isSubscriptionModalOpen: false,
  subscriptionModalReason: "general" as const,
  subscriptionInitialPlan: "pro" as const,
  isAutoTailoring: false,
  autoTailorStepIndex: undefined,
  autoTailorProgress: undefined,
  autoTailorComplete: false,
  isAutoTailorSettingsOpen: false,
  isKeywordWeaveModalOpen: false,
  keywordsForWeaveModal: [],
  selectedKeywordsToWeave: [],
  isPdfPreviewOpen: false,
  isProfileModalOpen: false,
  isProfileMenuOpen: false,
  isHistoryModalOpen: false,
  isCompletionModalOpen: false,
  isTailorPreviewOpen: false,
  isReportModalOpen: false,
  reportCategory: "bug" as ReportCategory,
  reportInitialError: null,

  isCartOpen: false,
  isBottomBarVisible: false,
  showDetailedInsights: false,
  keywordFilterTab: "all" as KeywordFilterTab,
  keywordSearchQuery: "",
  expandedSections: {},
  expandedImprovements: {},
  inlineLoadingSections: {},
  isImprovingAll: false,
  isWeavingKeywords: false,
};

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  ...initialWorkspaceState,

  setFile: (file) => set({ file }),
  setDocumentId: (documentId) => set({ documentId }),
  setGuestResumeText: (guestResumeText) => set({ guestResumeText }),
  setGuestMode: (guestMode) => set({ guestMode }),
  setIsRunningGuestAnalysis: (isRunningGuestAnalysis) => set({ isRunningGuestAnalysis }),
  setJobDescription: (jobDescription) => set({ jobDescription }),
  setCustomTargetRole: (customTargetRole) => set({ customTargetRole }),
  setTargetRoleDraft: (targetRoleDraft) => set({ targetRoleDraft }),
  setIsEditingTargetRole: (isEditingTargetRole) => set({ isEditingTargetRole }),
  setAnalysisResult: (analysisResult) => set({ analysisResult }),
  setError: (error) => set({ error }),
  setSuccessNotification: (successNotification) => set({ successNotification }),

  setRewrittenSections: (arg) =>
    set((state) => ({
      rewrittenSections: typeof arg === "function" ? arg(state.rewrittenSections) : arg,
    })),
  setPreviousRewrittenSections: (arg) =>
    set((state) => ({
      previousRewrittenSections: typeof arg === "function" ? arg(state.previousRewrittenSections) : arg,
    })),
  setAppliedWovenKeywords: (arg) =>
    set((state) => ({
      appliedWovenKeywords: typeof arg === "function" ? arg(state.appliedWovenKeywords) : arg,
    })),
  setIsKeywordsWoven: (isKeywordsWoven) => set({ isKeywordsWoven }),
  toggleManuallyRemovedSkill: (skill) =>
    set((state) => {
      const lower = skill.toLowerCase();
      const exists = state.manuallyRemovedSkills.includes(lower);
      return {
        manuallyRemovedSkills: exists
          ? state.manuallyRemovedSkills.filter((s) => s !== lower)
          : [...state.manuallyRemovedSkills, lower],
      };
    }),
  setExcludedBulletsForSection: (section, excluded) =>
    set((state) => ({
      excludedBullets: { ...state.excludedBullets, [section]: excluded },
      isPatchingApplied: false,
    })),
  setTailoringSectionToggles: (arg) =>
    set((state) => ({
      tailoringSectionToggles: typeof arg === "function" ? arg(state.tailoringSectionToggles) : arg,
    })),

  setDiffViewMode: (diffViewMode) => set({ diffViewMode }),
  setDiffModeActive: (diffModeActive) => set({ diffModeActive }),
  setDownloadId: (downloadId) => set({ downloadId }),
  setDownloadUrl: (downloadUrl) => set({ downloadUrl }),
  setIsPatchingApplied: (isPatchingApplied) => set({ isPatchingApplied }),

  setCoverLetterText: (coverLetterText) => set({ coverLetterText }),
  setCoverLetterDownloadId: (coverLetterDownloadId) => set({ coverLetterDownloadId }),
  setIsGeneratingCoverLetter: (isGeneratingCoverLetter) => set({ isGeneratingCoverLetter }),
  setIsUpdatingCoverLetter: (isUpdatingCoverLetter) => set({ isUpdatingCoverLetter }),
  setIsEditingCoverLetter: (isEditingCoverLetter) => set({ isEditingCoverLetter }),

  setBaseResumeLoaded: (baseResumeLoaded) => set({ baseResumeLoaded }),
  setIsSavingBase: (isSavingBase) => set({ isSavingBase }),
  setMasterResume: (masterResume) => set({ masterResume }),
  setTailorResult: (tailorResult) => set({ tailorResult }),

  setIsRewriteModalOpen: (isRewriteModalOpen) => set({ isRewriteModalOpen }),
  setActiveRewriteSection: (activeRewriteSection) => set({ activeRewriteSection }),
  setRewriteData: (rewriteData) => set({ rewriteData }),
  setDraftRewrittenText: (draftRewrittenText) => set({ draftRewrittenText }),
  setUserInstructions: (userInstructions) => set({ userInstructions }),
  setModalPositioningMode: (modalPositioningMode) => set({ modalPositioningMode }),
  setMetricPercentage: (metricPercentage) => set({ metricPercentage }),
  setMetricScale: (metricScale) => set({ metricScale }),

  openUpgradeModal: (reason = "general", plan = "pro") =>
    set({
      subscriptionModalReason: reason,
      subscriptionInitialPlan: plan,
      isSubscriptionModalOpen: true,
    }),
  closeUpgradeModal: () => set({ isSubscriptionModalOpen: false }),

  setIsAutoTailoring: (isAutoTailoring) => set({ isAutoTailoring }),
  setAutoTailorStepIndex: (autoTailorStepIndex) => set({ autoTailorStepIndex }),
  setAutoTailorProgress: (autoTailorProgress) => set({ autoTailorProgress }),
  setAutoTailorComplete: (autoTailorComplete) => set({ autoTailorComplete }),
  setIsAutoTailorSettingsOpen: (isAutoTailorSettingsOpen) => set({ isAutoTailorSettingsOpen }),

  setIsKeywordWeaveModalOpen: (isKeywordWeaveModalOpen) => set({ isKeywordWeaveModalOpen }),
  setKeywordsForWeaveModal: (keywordsForWeaveModal) => set({ keywordsForWeaveModal }),
  setSelectedKeywordsToWeave: (selectedKeywordsToWeave) => set({ selectedKeywordsToWeave }),
  toggleKeywordToWeave: (kw) =>
    set((state) => {
      const exists = state.selectedKeywordsToWeave.includes(kw);
      return {
        selectedKeywordsToWeave: exists
          ? state.selectedKeywordsToWeave.filter((k) => k !== kw)
          : [...state.selectedKeywordsToWeave, kw],
      };
    }),

  setIsPdfPreviewOpen: (isPdfPreviewOpen) => set({ isPdfPreviewOpen }),
  setIsProfileModalOpen: (isProfileModalOpen) => set({ isProfileModalOpen }),
  setIsProfileMenuOpen: (isProfileMenuOpen) => set({ isProfileMenuOpen }),
  setIsHistoryModalOpen: (isHistoryModalOpen) => set({ isHistoryModalOpen }),
  setIsCompletionModalOpen: (isCompletionModalOpen) => set({ isCompletionModalOpen }),
  setIsTailorPreviewOpen: (isTailorPreviewOpen) => set({ isTailorPreviewOpen }),

  openIssueReport: (category = "bug", errorContext = null) =>
    set({
      reportCategory: category,
      reportInitialError: errorContext,
      isReportModalOpen: true,
    }),
  closeIssueReport: () => set({ isReportModalOpen: false }),

  setIsCartOpen: (isCartOpen) => set({ isCartOpen }),
  setIsBottomBarVisible: (isBottomBarVisible) => set({ isBottomBarVisible }),
  setShowDetailedInsights: (showDetailedInsights) => set({ showDetailedInsights }),
  setKeywordFilterTab: (keywordFilterTab) => set({ keywordFilterTab }),
  setKeywordSearchQuery: (keywordSearchQuery) => set({ keywordSearchQuery }),

  toggleExpandedSection: (sectionName) =>
    set((state) => ({
      expandedSections: {
        ...state.expandedSections,
        [sectionName]: !state.expandedSections[sectionName],
      },
    })),
  toggleExpandedImprovement: (improvementKey) =>
    set((state) => ({
      expandedImprovements: {
        ...state.expandedImprovements,
        [improvementKey]: !state.expandedImprovements[improvementKey],
      },
    })),
  setInlineLoadingSection: (sectionName, loading) =>
    set((state) => ({
      inlineLoadingSections: {
        ...state.inlineLoadingSections,
        [sectionName]: loading,
      },
    })),
  setIsImprovingAll: (isImprovingAll) => set({ isImprovingAll }),
  setIsWeavingKeywords: (isWeavingKeywords) => set({ isWeavingKeywords }),

  resetWorkspace: () => set({ ...initialWorkspaceState }),
  restoreFromSession: (saved) => set((state) => ({ ...state, ...saved })),
}));

