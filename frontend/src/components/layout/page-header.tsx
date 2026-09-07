"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  backLink?: {
    href: string;
    label?: string;
  };
  gradientTitle?: boolean;
  align?: "left" | "center";
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  backLink,
  gradientTitle = false,
  align = "left",
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "w-full flex flex-col gap-4 mb-8 sm:mb-10",
        align === "center" && "items-center text-center",
        className
      )}
    >
      {backLink && (
        <Link
          href={backLink.href}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-teal-600 transition-colors w-fit group mb-1"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>{backLink.label || "Back"}</span>
        </Link>
      )}

      <div
        className={cn(
          "w-full flex flex-col sm:flex-row gap-4",
          align === "center"
            ? "items-center justify-center"
            : "sm:items-center sm:justify-between"
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-2 max-w-2xl",
            align === "center" && "items-center text-center mx-auto"
          )}
        >
          {eyebrow && <div className="shrink-0">{eyebrow}</div>}

          <h1
            className={cn(
              "text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-tight",
              gradientTitle ? "text-gradient" : "text-slate-900"
            )}
          >
            {title}
          </h1>

          {description && (
            <p className="text-sm sm:text-base text-slate-600 font-medium leading-relaxed">
              {description}
            </p>
          )}
        </div>

        {actions && (
          <div
            className={cn(
              "flex items-center gap-2.5 flex-wrap shrink-0",
              align === "center" ? "justify-center" : "self-start sm:self-auto"
            )}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
