"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ragService } from "@/services/rag-service";
import { queryKeys } from "@/lib/query-keys";
import { getErrorMessage } from "@/utils/errors";

export function useDocuments() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.documents.list({ skip: 0, limit: 100 }),
    queryFn: () => ragService.listDocuments({ skip: 0, limit: 100 }),
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => ragService.deleteDocument(documentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast.success("Document deleted");
    },
    onError: (error) => {
      toast.error("Delete failed", { description: getErrorMessage(error) });
    },
  });

  const ingestMutation = useMutation({
    mutationFn: (uploadId: string) => ragService.ingest(uploadId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.uploads.all });
      toast.success("Document added to the knowledge base");
    },
    onError: (error) => {
      toast.error("Ingest failed", { description: getErrorMessage(error) });
    },
  });

  return { listQuery, deleteMutation, ingestMutation };
}
