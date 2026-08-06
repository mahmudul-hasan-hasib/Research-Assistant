"use client";

import { FileText, Inbox, Loader2, Trash2, Wand2 } from "lucide-react";

import { StatusChip } from "./status-chip";
import { useDocuments } from "../hooks/use-documents";
import { useUploads } from "../hooks/use-uploads";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, formatRelativeTime } from "@/utils/format";

export function UploadsPanel() {
  const { listQuery, deleteUpload } = useUploads();
  const { ingestMutation } = useDocuments();

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div>
          <h3 className="text-base font-semibold">Uploaded files</h3>
          <p className="text-sm text-muted-foreground">
            {listQuery.data?.total ?? 0} files stored in your workspace
          </p>
        </div>

        {listQuery.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-11 w-full" />
            ))}
          </div>
        ) : (listQuery.data?.items.length ?? 0) === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No uploads yet. Files you upload appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead className="hidden sm:table-cell">Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                  <TableHead className="w-[168px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(listQuery.data?.items ?? []).map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="max-w-[16rem] truncate font-medium">{upload.original_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground sm:table-cell">
                      {formatBytes(upload.size_bytes)}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={upload.status} />
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground lg:table-cell">
                      {formatRelativeTime(upload.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {upload.status === "ready" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8"
                            disabled={ingestMutation.isPending}
                            onClick={() => ingestMutation.mutate(upload.id)}
                          >
                            {ingestMutation.isPending ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="h-3.5 w-3.5" />
                            )}
                            Ingest
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          aria-label={`Delete ${upload.original_name}`}
                          onClick={() => deleteUpload(upload.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
