"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { ragService } from "@/services/rag-service";
import { uploadService } from "@/services/upload-service";
import { queryKeys } from "@/lib/query-keys";
import { useChatStore } from "@/stores/chat-store";

/** Dashboard aggregates server state via React Query (Part 3.4). */
export function useDashboardData() {
  const documentsQuery = useQuery({
    queryKey: queryKeys.documents.list({ skip: 0, limit: 100 }),
    queryFn: () => ragService.listDocuments({ skip: 0, limit: 100 }),
  });

  const uploadsQuery = useQuery({
    queryKey: queryKeys.uploads.list({ skip: 0, limit: 100 }),
    queryFn: () => uploadService.list({ skip: 0, limit: 100 }),
  });

  const queryCount = useChatStore((state) => state.queryCount);

  const recentActivity = useMemo(() => {
    const documentEvents =
      documentsQuery.data?.items.map((document) => ({
        id: `doc-${document.id}`,
        kind: "document" as const,
        name: document.name,
        status: document.status,
        createdAt: document.created_at,
      })) ?? [];

    const uploadEvents =
      uploadsQuery.data?.items.map((upload) => ({
        id: `upload-${upload.id}`,
        kind: "upload" as const,
        name: upload.original_name,
        status: upload.status,
        createdAt: upload.created_at,
      })) ?? [];

    return [...documentEvents, ...uploadEvents]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
  }, [documentsQuery.data, uploadsQuery.data]);

  return {
    totalDocuments: documentsQuery.data?.total ?? 0,
    documentsLoading: documentsQuery.isPending,
    totalUploads: uploadsQuery.data?.total ?? 0,
    uploadsLoading: uploadsQuery.isPending,
    queryCount,
    recentActivity,
    activityLoading: documentsQuery.isPending || uploadsQuery.isPending,
  };
}
