"use client";

import type { Document } from "@/types/api";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { formatBytes, formatDateTime } from "@/utils/format";

interface DocumentMetadataDialogProps {
  document: Document | null;
  onOpenChange: (open: boolean) => void;
}

export function DocumentMetadataDialog({ document, onOpenChange }: DocumentMetadataDialogProps) {
  const open = Boolean(document);

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="pr-8">Document details</DialogTitle>
          <DialogDescription>Metadata for the selected document.</DialogDescription>
        </DialogHeader>

        {document && (
          <div className="space-y-4">
            <div>
              <p className="truncate text-sm font-semibold">{document.name}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">{document.mime}</Badge>
                <Badge variant="outline">{formatBytes(document.size_bytes)}</Badge>
                <Badge variant={document.status === "ready" ? "success" : document.status === "failed" ? "danger" : "info"}>
                  {document.status}
                </Badge>
              </div>
            </div>

            <Separator />

            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Parser</dt>
                <dd className="text-right font-medium">{document.parser}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Source type</dt>
                <dd className="text-right font-medium">{document.source_type}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Chunks</dt>
                <dd className="text-right font-medium tabular-nums">{document.chunk_count}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Created</dt>
                <dd className="text-right font-medium">{formatDateTime(document.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Updated</dt>
                <dd className="text-right font-medium">{formatDateTime(document.updated_at)}</dd>
              </div>
            </dl>

            {document.error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
                {document.error}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
