"use client";

import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { DocumentStatus, UploadStatus } from "@/types/api";
import { statusLabel, statusTone } from "@/utils/status";

export function StatusChip({ status }: { status: UploadStatus | DocumentStatus }) {
  const Icon =
    status === "ready" ? CheckCircle2 : status === "failed" ? XCircle : status === "processing" ? Loader2 : CircleDashed;

  return (
    <Badge variant={statusTone(status)} className="gap-1">
      <Icon className="h-3 w-3" />
      {statusLabel(status)}
    </Badge>
  );
}
