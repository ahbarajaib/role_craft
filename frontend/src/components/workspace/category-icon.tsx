"use client";

import React from "react";
import { BookOpen, ClipboardList, Code, Cpu, Layers } from "lucide-react";

export function CategoryIcon({ category, className }: { category: string; className?: string }) {
  switch (category) {
    case "technology":
      return <Code className={className} />;
    case "skill":
      return <Cpu className={className} />;
    case "concept":
      return <BookOpen className={className} />;
    case "responsibility":
      return <ClipboardList className={className} />;
    default:
      return <Layers className={className} />;
  }
}

