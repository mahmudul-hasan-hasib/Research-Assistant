"use client";

import { useQueryClient } from "@tanstack/react-query";

import { UploadDropzone } from "./upload-dropzone";
import { UploadProgressList } from "./upload-progress-list";
import { useUploadFiles } from "../hooks/use-upload-files";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "sonner";

export function UploadSection() {
  const queryClient = useQueryClient();

  const { jobs, uploadFiles, removeJob, clearCompleted } = useUploadFiles(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.uploads.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.documents.all });
  });

  const busy = jobs.some((job) => job.status === "uploading" || job.status === "queued");

  return (
    <div className="space-y-4">
      <UploadDropzone
        busy={busy}
        onFiles={(files) => {
          const { accepted, rejected } = uploadFiles(files);
          if (accepted > 0) toast.success(`Queued ${accepted} file${accepted > 1 ? "s" : ""}`);
          if (rejected > 0) toast.error(`${rejected} file${rejected > 1 ? "s" : ""} rejected`);
        }}
      />
      <UploadProgressList jobs={jobs} onRemove={removeJob} onClearCompleted={clearCompleted} />
    </div>
  );
}
