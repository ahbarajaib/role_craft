"use client";

import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 font-bold select-none cursor-pointer transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-md shadow-teal-500/20 active:scale-[0.98]",
        secondary:
          "bg-teal-50/90 hover:bg-teal-100 text-teal-800 border border-teal-200/90 shadow-xs active:scale-[0.98]",
        coral:
          "bg-gradient-to-r from-[#ff6b4a] to-[#f95738] hover:from-[#f95738] hover:to-[#e8492a] text-white shadow-md shadow-[#ff6b4a]/25 active:scale-[0.98]",
        glow:
          "bg-gradient-to-r from-slate-900 via-teal-950 to-teal-900 text-white border border-teal-500/30 hover:border-teal-400/60 shadow-lg shadow-teal-500/20 active:scale-[0.98]",
        outline:
          "border border-slate-200 bg-white hover:bg-slate-50/80 hover:border-teal-300 text-slate-700 shadow-2xs active:scale-[0.98]",
        ghost:
          "text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-[0.98]",
        destructive:
          "bg-rose-500 hover:bg-rose-600 text-white shadow-xs shadow-rose-500/20 active:scale-[0.98]",
        subtle:
          "bg-slate-100 hover:bg-slate-200/80 text-slate-700 active:scale-[0.98]",
      },
      size: {
        xs: "h-7 px-2.5 text-xs rounded-lg",
        sm: "h-8 px-3 text-xs rounded-xl",
        md: "h-10 px-4 text-sm rounded-xl",
        lg: "h-12 px-6 text-base rounded-2xl",
        icon: "h-9 w-9 p-0 rounded-xl shrink-0",
        "icon-sm": "h-7 w-7 p-0 rounded-lg shrink-0",
        "icon-xs": "h-6 w-6 p-0 rounded-md shrink-0",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
      fullWidth: false,
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  loadingText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      fullWidth,
      isLoading = false,
      loadingText,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading}
        className={cn(buttonVariants({ variant, size, fullWidth, className }))}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            {loadingText || children}
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
