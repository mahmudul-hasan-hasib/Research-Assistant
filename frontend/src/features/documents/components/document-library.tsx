"use client";

import { Eye, FileText, Inbox, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { StatusChip } from "./status-chip";
import { DocumentMetadataDialog } from "./document-metadata-dialog";
import { useDocuments } from "../hooks/use-documents";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatBytes, formatRelativeTime } from "@/utils/format";
import { useDebouncedValue } from "@/hooks/use-debounce";
import type { Document } from "@/types/api";

export function DocumentLibrary() {
  const { listQuery, deleteMutation } = useDocuments();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [selected, setSelected] = useState<Document | null>(null);

  const documents = useMemo(() => {
    const items = listQuery.data?.items ?? [];
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (document) =>
        document.name.toLowerCase().includes(query) ||
        document.mime.toLowerCase().includes(query) ||
        document.parser.toLowerCase().includes(query),
    );
  }, [listQuery.data, debouncedSearch]);

  return (
    <>
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold">Document library</h3>
              <p className="text-sm text-muted-foreground">
                {listQuery.data?.total ?? 0} documents in your knowledge base
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search documents…"
                className="pl-9"
                aria-label="Search documents"
              />
            </div>
          </div>

          {listQuery.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-11 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Inbox className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {debouncedSearch
                  ? "No documents match your search."
                  : "No documents yet. Upload a file to get started."}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Size</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Added</TableHead>
                    <TableHead className="w-[88px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="max-w-[16rem] truncate font-medium">{document.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {document.mime}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground sm:table-cell">
                        {formatBytes(document.size_bytes)}
                      </TableCell>
                      <TableCell>
                        <StatusChip status={document.status} />
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground lg:table-cell">
                        {formatRelativeTime(document.created_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`View ${document.name} metadata`}
                            onClick={() => setSelected(document)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            aria-label={`Delete ${document.name}`}
                            disabled={deleteMutation.isPending}
                            onClick={() => deleteMutation.mutate(document.id)}
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

      <DocumentMetadataDialog document={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </>
  );
}
