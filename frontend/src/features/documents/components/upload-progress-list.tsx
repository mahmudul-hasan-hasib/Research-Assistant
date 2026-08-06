"use client";

import { CheckCircle2, Loader2, X, XCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { UploadJob } from "../hooks/use-upload-files";
import { formatBytes } from "@/utils/format";

interface UploadProgressListProps {
  jobs: UploadJob[];
  onRemove: (id: string) => void;
  onClearCompleted: () => void;
}

export function UploadProgressList({ jobs, onRemove, onClearCompleted }: UploadProgressListProps) {
  if (jobs.length === 0) return null;

  const active = jobs.filter((job) => job.status === "uploading" || job.status === "queued").length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {active > 0 ? `Uploading ${active} file${active > 1 ? "s" : ""}…` : "Uploads"}
        </p>
        {active === 0 && (
          <Button variant="ghost" size="sm" onClick={onClearCompleted}>
            Clear
          </Button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {jobs.map((job) => (
          <motion.div
            key={job.id}
            layout
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="rounded-lg border bg-card p-3"
          >
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-sm font-medium">{job.file.name}</p>
                  {job.status === "complete" && (
                    <Badge variant="success" className="shrink-0">
                      Done
                    </Badge>
                  )}
                  {job.status === "error" && (
                    <Badge variant="danger" className="shrink-0">
                      Failed
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatBytes(job.file.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label={`Remove ${job.file.name}`}
                onClick={() => onRemove(job.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {job.status === "uploading" && (
              <div className="mt-2 flex items-center gap-2">
                <Progress value={job.progress} className="h-1.5 flex-1" />
                <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
                  {job.progress}%
                </span>
              </div>
            )}
            {job.status === "queued" && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Queued
              </div>
            )}
            {job.status === "complete" && (
              <p className="mt-1 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Uploaded successfully
              </p>
            )}
            {job.status === "error" && job.error && (
              <p className="mt-1 flex items-start gap-1.5 text-xs text-destructive">
                <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {job.error}
              </p>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
