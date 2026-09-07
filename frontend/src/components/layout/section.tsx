"use client";

import React, { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Container, type ContainerProps } from "./container";
import { cn } from "@/lib/utils";

export const sectionVariants = cva("w-full relative", {
  variants: {
    spacing: {
      none: "py-0",
      sm: "py-6 sm:py-8",
      md: "py-10 sm:py-16",
      lg: "py-16 sm:py-24",
      xl: "py-20 sm:py-32",
    },
    background: {
      default: "bg-transparent",
      subtle: "bg-slate-50/70 border-y border-slate-200/60",
      card: "bg-white border-y border-slate-200",
      mesh: "hero-mesh",
      dark: "bg-slate-900 text-white",
    },
  },
  defaultVariants: {
    spacing: "md",
    background: "default",
  },
});

export interface SectionProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof sectionVariants> {
  contained?: boolean;
  containerSize?: ContainerProps["size"];
  containerPadding?: ContainerProps["padding"];
  containerClassName?: string;
}

export const Section = forwardRef<HTMLElement, SectionProps>(
  (
    {
      className,
      spacing,
      background,
      contained = true,
      containerSize = "lg",
      containerPadding = "md",
      containerClassName,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <section
        ref={ref}
        className={cn(sectionVariants({ spacing, background, className }))}
        {...props}
      >
        {contained ? (
          <Container
            size={containerSize}
            padding={containerPadding}
            className={containerClassName}
          >
            {children}
          </Container>
        ) : (
          children
        )}
      </section>
    );
  }
);

Section.displayName = "Section";
