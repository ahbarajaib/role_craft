"use client";

import React from "react";
import { X } from "lucide-react";
import { PdfLogoIcon } from "@/components/file_format_icons";

export interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  downloadUrl: string;
  pdfBlobUrl: string | null;
  isLoading: boolean;
  error: string | null;
  fallbackDownloadUrl: string;
}

export function PdfPreviewModal({
  isOpen,
  onClose,
  downloadUrl,
  pdfBlobUrl,
  isLoading,
  error,
  fallbackDownloadUrl,
}: PdfPreviewModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60">
          <div className="flex items-center gap-2">
            <PdfLogoIcon className="h-5 w-5 shrink-0" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Live PDF Preview</h3>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={downloadUrl}
              download
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <PdfLogoIcon className="h-4 w-4 shrink-0" /> Download PDF
            </a>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Viewer Body */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 p-2 flex items-center justify-center relative overflow-hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-3 text-slate-500 dark:text-slate-400">
              <div className="h-8 w-8 border-3 border-teal-500/20 border-t-indigo-500 rounded-full animate-spin" />
              <p className="text-xs font-medium">Rendering live PDF preview...</p>
            </div>
          ) : error ? (
            <div className="text-center p-8 space-y-3">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{error}</p>
              <a
                href={fallbackDownloadUrl}
                download
                className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-sm"
              >
                <PdfLogoIcon className="h-4 w-4 shrink-0" /> Download PDF File
              </a>
            </div>
          ) : pdfBlobUrl ? (
            <object
              data={pdfBlobUrl}
              type="application/pdf"
              className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900"
            >
              <iframe
                src={pdfBlobUrl}
                className="w-full h-full rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900"
                title="Resume PDF Preview"
              />
            </object>
          ) : null}
        </div>
      </div>
    </div>
  );
}

