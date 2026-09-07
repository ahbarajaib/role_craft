"use client";

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  showCount?: boolean;
  containerClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      helperText,
      error,
      showCount = false,
      maxLength,
      value,
      containerClassName,
      id,
      disabled,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const textareaId = id || generatedId;
    const currentLength = typeof value === "string" ? value.length : 0;

    return (
      <div className={cn("w-full flex flex-col gap-1.5", containerClassName)}>
        {label && (
          <div className="flex items-center justify-between">
            <label
              htmlFor={textareaId}
              className="text-xs font-bold text-slate-700 select-none"
            >
              {label}
            </label>
            {showCount && maxLength && (
              <span className="text-[10px] text-slate-400 font-medium tabular-nums">
                {currentLength} / {maxLength}
              </span>
            )}
          </div>
        )}

        <textarea
          id={textareaId}
          ref={ref}
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          className={cn(
            "w-full min-h-[100px] p-3 text-sm bg-white text-slate-900 placeholder:text-slate-400",
            "rounded-xl border border-slate-200 transition-all duration-200",
            "focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20",
            "disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed resize-y",
            error && "border-rose-400 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900",
            className
          )}
          {...props}
        />

        {error ? (
          <p className="text-[11px] font-semibold text-rose-500 animate-fade-in">
            {error}
          </p>
        ) : helperText ? (
          <p className="text-[11px] text-slate-500 font-medium">{helperText}</p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = "Textarea";
