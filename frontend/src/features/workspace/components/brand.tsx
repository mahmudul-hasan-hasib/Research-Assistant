"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";

import { cn } from "@/utils/cn";

export function Brand({ collapsed = false, className }: { collapsed?: boolean; className?: string }) {
  return (
    <Link href="/dashboard" className={cn("flex items-center gap-2", className)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <Sparkles className="h-4 w-4" />
      </div>
      {!collapsed && (
        <span className="text-base font-semibold tracking-tight text-foreground">Insight</span>
      )}
    </Link>
  );
}
