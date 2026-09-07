"use client";

import React from "react";
import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  variant?: "default" | "subtle" | "gradient";
  label?: string;
}

export function Separator({
  className,
  orientation = "horizontal",
  variant = "default",
  label,
  ...props
}: SeparatorProps) {
  if (orientation === "vertical") {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn(
          "w-px self-stretch bg-slate-200",
          variant === "subtle" && "bg-slate-100",
          variant === "gradient" && "bg-gradient-to-b from-transparent via-teal-300 to-transparent",
          className
        )}
        {...props}
      />
    );
  }

  if (label) {
    return (
      <div
        role="separator"
        className={cn("relative flex items-center justify-center my-4 w-full", className)}
        {...props}
      >
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-slate-200" />
        </div>
        <div className="relative bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          {label}
        </div>
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn(
        "h-px w-full bg-slate-200",
        variant === "subtle" && "bg-slate-100",
        variant === "gradient" &&
          "bg-gradient-to-r from-transparent via-teal-300 to-transparent",
        className
      )}
      {...props}
    />
  );
}
