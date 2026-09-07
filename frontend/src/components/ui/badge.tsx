"use client";

import React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 font-extrabold uppercase tracking-wider select-none shrink-0 transition-colors duration-150",
  {
    variants: {
      variant: {
        default:
          "bg-[#E6F7F4] text-teal-900 border border-[#99F6E4] shadow-2xs",
        primary:
          "bg-teal-600 text-white shadow-xs border border-teal-700",
        coral:
          "bg-[#FFF1EE] text-[#D94826] border border-[#FFCFC4] shadow-2xs",
        secondary:
          "bg-slate-100 text-slate-700 border border-slate-200/80",
        outline:
          "bg-transparent border border-slate-300 text-slate-700",
        success:
          "bg-emerald-50 text-emerald-900 border border-emerald-200",
        warning:
          "bg-amber-50 text-amber-900 border border-amber-200",
        destructive:
          "bg-rose-50 text-rose-900 border border-rose-200",
        glow:
          "bg-gradient-to-r from-teal-500/10 via-emerald-500/10 to-indigo-500/10 text-teal-950 border border-teal-300/60 shadow-xs",
      },
      size: {
        sm: "px-2 py-0.5 text-[10px] rounded-md leading-none",
        md: "px-2.5 py-1 text-[11px] rounded-lg leading-tight",
        lg: "px-3.5 py-1.5 text-xs rounded-full leading-normal",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "md",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
  dotColor?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Badge({
  className,
  variant,
  size,
  dot = false,
  dotColor,
  leftIcon,
  rightIcon,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, size, className }))}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full shrink-0",
            dotColor || (variant === "coral" ? "bg-[#ff6b4a]" : "bg-teal-500")
          )}
        />
      )}
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      {children}
      {rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </span>
  );
}
