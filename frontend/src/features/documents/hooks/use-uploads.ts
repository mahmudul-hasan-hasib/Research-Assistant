"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { uploadService } from "@/services/upload-service";
import { queryKeys } from "@/lib/query-keys";
import { getErrorMessage } from "@/utils/errors";

export function useUploads() {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: queryKeys.uploads.list({ skip: 0, limit: 100 }),
    queryFn: () => uploadService.list({ skip: 0, limit: 100 }),
  });

  const deleteUpload = async (uploadId: string) => {
    try {
      await uploadService.remove(uploadId);
      void queryClient.invalidateQueries({ queryKey: queryKeys.uploads.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
      toast.success("Upload removed");
    } catch (error) {
      toast.error("Delete failed", { description: getErrorMessage(error) });
    }
  };

  return { listQuery, deleteUpload };
}
