"use client";

import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";
  placement?: "center" | "bottom-sheet";
}

const maxWidthMap = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  full: "max-w-[95vw]",
};

export function Dialog({
  isOpen,
  onClose,
  children,
  className,
  maxWidth = "2xl",
  placement = "center",
}: DialogProps) {
  // ESC key listener
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        "fixed inset-0 z-[1050] flex bg-slate-950/70 backdrop-blur-sm animate-fade-in",
        placement === "bottom-sheet"
          ? "items-end sm:items-center justify-center p-0 sm:p-4"
          : "items-center justify-center p-3 sm:p-4"
      )}
      onClick={onClose}
    >
      <div
        className={cn(
          "relative w-full bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-fade-in-up",
          placement === "bottom-sheet"
            ? "rounded-t-3xl sm:rounded-3xl"
            : "rounded-3xl",
          maxWidthMap[maxWidth],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className,
  children,
  onClose,
}: {
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  return (
    <div
      className={cn(
        "relative p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between gap-4",
        className
      )}
    >
      <div className="flex-1 min-w-0">{children}</div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

export function DialogTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      className={cn(
        "text-base sm:text-lg font-black tracking-tight text-slate-900",
        className
      )}
    >
      {children}
    </h2>
  );
}

export function DialogDescription({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "text-xs sm:text-sm text-slate-500 font-medium mt-1 leading-relaxed",
        className
      )}
    >
      {children}
    </p>
  );
}

export function DialogContent({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "p-5 sm:p-6 overflow-y-auto ios-scroll flex-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function DialogFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "p-4 sm:p-6 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-3 flex-wrap",
        className
      )}
    >
      {children}
    </div>
  );
}
