"use client";

import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const cardVariants = cva(
  "relative overflow-hidden transition-all duration-200 ease-out",
  {
    variants: {
      variant: {
        default:
          "bg-white border border-slate-200/90 shadow-xs rounded-2xl",
        glass:
          "bg-white/90 backdrop-blur-md border border-slate-200/80 shadow-md shadow-slate-900/5 rounded-2xl",
        interactive:
          "bg-white border border-slate-200 shadow-xs hover:shadow-xl hover:shadow-teal-500/10 hover:border-teal-300 rounded-2xl cursor-pointer active:scale-[0.995]",
        feature:
          "feature-card rounded-2xl",
        subtle:
          "bg-slate-50/80 border border-slate-200/70 rounded-2xl",
        mint:
          "bg-[#E6F7F4]/60 border border-[#99F6E4] rounded-2xl",
        dark:
          "bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-xl",
      },
      padding: {
        none: "",
        sm: "p-4",
        md: "p-5 sm:p-6",
        lg: "p-6 sm:p-8",
      },
    },
    defaultVariants: {
      variant: "default",
      padding: "none",
    },
  }
);

export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant, padding, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(cardVariants({ variant, padding, className }))}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = "Card";

export const CardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("p-5 sm:p-6 pb-3 flex flex-col space-y-1.5", className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-base sm:text-lg font-black tracking-tight text-slate-900 leading-tight",
      className
    )}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs sm:text-sm text-slate-500 font-medium", className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("p-5 sm:p-6 pt-0", className)} {...props} />
));
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "p-5 sm:p-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-3",
      className
    )}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";
