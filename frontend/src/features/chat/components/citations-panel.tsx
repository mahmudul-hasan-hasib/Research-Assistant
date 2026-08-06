"use client";

import { BookOpen } from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import type { Citation } from "@/types/api";

interface CitationsPanelProps {
  citations: Citation[];
}

export function CitationsPanel({ citations }: CitationsPanelProps) {
  if (citations.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border bg-muted/40 p-3"
    >
      <div className="mb-2 flex items-center gap-2">
        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Citations
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {citations.map((citation) => (
          <button
            key={`${citation.index}-${citation.chunk_id}`}
            type="button"
            title={citation.snippet}
            className="group flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:border-primary/50"
          >
            <Badge variant="secondary" className="h-4 w-4 shrink-0 justify-center rounded-full p-0 text-[10px]">
              {citation.index}
            </Badge>
            <span className="max-w-[16rem] truncate font-medium">{citation.document_name}</span>
            {citation.page != null && (
              <span className="text-muted-foreground">p.{citation.page}</span>
            )}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
