"use client";

import { useCallback, useState } from "react";

import type { Upload } from "@/types/api";
import { uploadService } from "@/services/upload-service";
import { getErrorMessage } from "@/utils/errors";
import { validateFile } from "@/utils/files";

export type UploadJobStatus = "queued" | "uploading" | "complete" | "error";

export interface UploadJob {
  id: string;
  file: File;
  status: UploadJobStatus;
  progress: number;
  upload?: Upload;
  error?: string;
}

let jobCounter = 0;

function nextId(): string {
  jobCounter += 1;
  return `upload-${jobCounter}-${Date.now()}`;
}

export function useUploadFiles(onComplete?: (upload: Upload) => void) {
  const [jobs, setJobs] = useState<UploadJob[]>([]);

  const updateJob = useCallback((id: string, patch: Partial<UploadJob>) => {
    setJobs((current) => current.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }, []);

  const uploadOne = useCallback(
    async (jobId: string, file: File) => {
      updateJob(jobId, { status: "uploading", progress: 0 });
      try {
        const upload = await uploadService.upload(file, (progress) => {
          updateJob(jobId, { progress: progress.percent });
        });
        updateJob(jobId, { status: "complete", progress: 100, upload });
        onComplete?.(upload);
      } catch (error) {
        updateJob(jobId, { status: "error", error: getErrorMessage(error) });
      }
    },
    [onComplete, updateJob],
  );

  const uploadFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files);
      const accepted: File[] = [];
      const rejected: { file: File; reason: string }[] = [];

      for (const file of list) {
        const result = validateFile(file);
        if (result.ok) accepted.push(file);
        else rejected.push({ file, reason: result.reason ?? "File not allowed" });
      }

      const created: UploadJob[] = accepted.map((file) => ({
        id: nextId(),
        file,
        status: "queued",
        progress: 0,
      }));

      setJobs((current) => [
        ...created,
        ...rejected.map(({ file, reason }) => ({
          id: nextId(),
          file,
          status: "error" as const,
          progress: 0,
          error: reason,
        })),
        ...current,
      ]);

      created.forEach((job) => {
        void uploadOne(job.id, job.file);
      });

      return { accepted: accepted.length, rejected: rejected.length };
    },
    [uploadOne],
  );

  const removeJob = useCallback((id: string) => {
    setJobs((current) => current.filter((job) => job.id !== id));
  }, []);

  const clearCompleted = useCallback(() => {
    setJobs((current) => current.filter((job) => job.status === "queued" || job.status === "uploading"));
  }, []);

  return { jobs, uploadFiles, removeJob, clearCompleted };
}
